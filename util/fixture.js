import child_process from 'node:child_process';
import { Transform } from 'node:stream';
import { getNextImageName } from './get-next-image-name.js';
import { containerEngine } from './get-container-engine.js';

export class Fixture {
	constructor({ autoSetup = true, debug = false, nextMajor, nodeMajor }) {
		this.nextMajor = nextMajor;
		this.nodeMajor = nodeMajor;

		this.debug = debug || process.env.DEBUG === '1';

		this.imageName = getNextImageName(nextMajor, nodeMajor);
		this.containerName = `hdb-next-integration-test-container-next-${nextMajor}-node-${nodeMajor}`;

		if (autoSetup) {
			this.ready = this.clear().then(() => this.run());
		}
	}

	get #stdio() {
		return ['ignore', this.debug ? 'inherit' : 'ignore', this.debug ? 'inherit' : 'ignore'];
	}

	#runCommand(args = [], options = {}) {
		return new Promise((resolve, reject) => {
			const childProcess = child_process.spawn(containerEngine, args, {
				stdio: this.#stdio,
				...options,
			});

			childProcess.on('error', reject);
			childProcess.on('exit', resolve);
		});
	}

	stop() {
		return this.#runCommand(['stop', this.containerName]);
	}

	rm() {
		return this.#runCommand(['rm', this.containerName]);
	}

	clear() {
		return new Promise((resolve, reject) => {
			const psProcess = child_process.spawn(containerEngine, ['ps', '-aq', '-f', `name=${this.containerName}`]);

			psProcess.on('error', reject);

			const collectedStdout = psProcess.stdout.pipe(
				new Transform({
					construct(callback) {
						this.chunks = [];
						callback(null);
					},
					transform(chunk, encoding, callback) {
						this.chunks.push(chunk);
						callback(null, chunk);
					},
				})
			);

			if (this.debug) {
				collectedStdout.pipe(process.stdout);
				psProcess.stderr.pipe(process.stderr);
			}

			psProcess.on('exit', (code) => {
				if (code === 0 && collectedStdout.chunks.length !== 0) {
					return this.stop()
						.then(() => this.rm())
						.then(resolve, reject);
				}
				return resolve(code);
			});
		});
	}

	run() {
		return new Promise((resolve, reject) => {
			const runProcess = child_process.spawn(
				containerEngine,
				['run', '-P', '--name', this.containerName, this.imageName],
				{ stdio: ['ignore', 'pipe', this.debug ? 'inherit' : 'ignore'] }
			);

			runProcess.on('error', reject);
			runProcess.on('exit', resolve);

			const stdout = runProcess.stdout.pipe(
				new Transform({
					transform(chunk, encoding, callback) {
						if (/HarperDB \d+.\d+.\d+ successfully started/.test(chunk.toString())) {
							resolve();
						}
						callback(null, chunk);
					},
				})
			);

			if (this.debug) {
				stdout.pipe(process.stdout);
			}
		});
	}

	get portMap() {
		const portMap = new Map();
		for (const port of ['9925', '9926']) {
			const { stdout } = child_process.spawnSync(containerEngine, ['port', this.containerName, port]);
			portMap.set(port, stdout.toString().trim());
		}
		return portMap;
	}
}
