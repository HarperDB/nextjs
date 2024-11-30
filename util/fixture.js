import child_process from 'node:child_process';
import path from 'node:path';
import { Transform } from 'node:stream';
import { fileURLToPath } from 'node:url';

export class Fixture {
	static CONTAINER_ENGINE_LIST = ['podman', 'docker'];
	static FIXTURE_PATH = fileURLToPath(new URL('../fixtures/', import.meta.url));

	/** @type {string} */
	#containerEngine;

	constructor({ autoSetup = true, debug = false, nextMajor, nodeMajor }) {
		this.nextMajor = nextMajor;
		this.nodeMajor = nodeMajor;

		this.debug = debug || process.env.DEBUG === '1';

		this.imageName = `hdb-next-integration-test-image-next-${nextMajor}-node-${nodeMajor}`;
		this.containerName = `hdb-next-integration-test-container-next-${nextMajor}-node-${nodeMajor}`;

		if (autoSetup) {
			this.ready = this.clear()
				.then(() => this.build())
				.then(() => this.run());
		}
	}

	get containerEngine() {
		if (this.#containerEngine) {
			return this.#containerEngine;
		}

		for (const containerEngine of Fixture.CONTAINER_ENGINE_LIST) {
			const { status } = child_process.spawnSync(containerEngine, ['--version'], { stdio: 'ignore' });
			if (status === 0) {
				return (this.#containerEngine = containerEngine);
			}
		}

		throw new Error(`No container engine found in ${CONTAINER_ENGINE_LIST.join(', ')}`);
	}

	get #stdio() {
		return ['ignore', this.debug ? 'inherit' : 'ignore', this.debug ? 'inherit' : 'ignore'];
	}

	#runCommand(args = [], options = {}) {
		return new Promise((resolve, reject) => {
			const childProcess = child_process.spawn(this.containerEngine, args, {
				stdio: this.#stdio,
				...options,
			});

			childProcess.on('error', (error) => {
				reject(error);
			});

			childProcess.on('exit', (code) => {
				resolve(code);
			});
		});
	}

	build() {
		return this.#runCommand([
			'build',
			'--build-arg',
			`NEXT_MAJOR=${this.nextMajor}`,
			'--build-arg',
			`NODE_MAJOR=${this.nodeMajor}`,
			'-t',
			this.imageName,
			'-f',
			path.join(Fixture.FIXTURE_PATH, 'Dockerfile'),
			path.join(Fixture.FIXTURE_PATH, '..'),
		]);
	}

	stop() {
		return this.#runCommand(['stop', this.containerName]);
	}

	rm() {
		return this.#runCommand(['rm', this.containerName]);
	}

	clear() {
		return new Promise((resolve, reject) => {
			const psProcess = child_process.spawn(this.containerEngine, ['ps', '-aq', '-f', `name=${this.containerName}`]);

			psProcess.on('error', reject);

			const collectedStdout = psProcess.stdout.pipe(
				new Transform({
					construct(cb) {
						this.chunks = [];
						cb(null);
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
				if (code === 0) {
					if (collectedStdout.chunks.length !== 0) {
						this.stop()
							.then(() => this.rm())
							.then(resolve, reject);
					}
					resolve();
				} else {
					reject(new Error(`\`${this.containerEngine} ps\` exited with code ${code}`));
				}
			});
		});
	}

	run() {
		return new Promise((resolve, reject) => {
			const runProcess = child_process.spawn(
				this.containerEngine,
				['run', '-P', '--name', this.containerName, this.imageName],
				{ stdio: ['ignore', 'pipe', this.debug ? 'inherit' : 'ignore'] }
			);

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

			runProcess.on('error', reject);
			runProcess.on('exit', resolve);
		});
	}

	get portMap() {
		const portMap = new Map();
		for (const port of ['9925', '9926']) {
			const { stdout } = child_process.spawnSync(this.containerEngine, ['port', this.containerName, port]);
			portMap.set(port, stdout.toString().trim());
		}
		return portMap;
	}
}
