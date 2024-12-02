import { spawn, spawnSync } from 'node:child_process';
import { Transform } from 'node:stream';

import { getNextImageName, getNextContainerName, NEXT_MAJORS, NODE_MAJORS, PORTS } from './constants-and-names.js';
import { CONTAINER_ENGINE } from './container-engine.js';
import { CollectedTransform } from './collected-transform.js';

export class Fixture {
	constructor({ autoSetup = true, debug = false, nextMajor, nodeMajor }) {
		if (!NEXT_MAJORS.includes(nextMajor)) {
			throw new Error(`nextMajor must be one of ${NEXT_MAJORS.join(', ')}`);
		}
		this.nextMajor = nextMajor;

		if (!NODE_MAJORS.includes(nodeMajor)) {
			throw new Error(`nodeMajor must be one of ${NODE_MAJORS.join(', ')}`);
		}
		this.nodeMajor = nodeMajor;

		this.debug = debug || process.env.DEBUG === '1';

		this.imageName = getNextImageName(nextMajor, nodeMajor);
		this.containerName = getNextContainerName(nextMajor, nodeMajor);

		if (autoSetup) {
			this.ready = this.clear().then(() => this.run());
		}
	}

	get #stdio() {
		return ['ignore', this.debug ? 'inherit' : 'ignore', this.debug ? 'inherit' : 'ignore'];
	}

	#runCommand(args = [], options = {}) {
		return new Promise((resolve, reject) => {
			const childProcess = spawn(CONTAINER_ENGINE, args, {
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
			const psProcess = spawn(CONTAINER_ENGINE, ['ps', '-aq', '-f', `name=${this.containerName}`]);

			psProcess.on('error', reject);

			const collectedStdout = psProcess.stdout.pipe(new CollectedTransform());

			if (this.debug) {
				collectedStdout.pipe(process.stdout);
				psProcess.stderr.pipe(process.stderr);
			}

			psProcess.on('exit', (code) => {
				if (code === 0 && collectedStdout.output !== '') {
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
			const runProcess = spawn(CONTAINER_ENGINE, ['run', '-P', '--name', this.containerName, this.imageName], {
				stdio: ['ignore', 'pipe', this.debug ? 'inherit' : 'ignore'],
			});

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
		for (const port of PORTS) {
			const { stdout } = spawnSync(CONTAINER_ENGINE, ['port', this.containerName, port]);
			portMap.set(port, stdout.toString().trim());
		}
		return portMap;
	}
}
