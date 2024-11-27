import child_process from 'node:child_process';
import EventEmitter, { once } from 'node:events';
import { Transform } from 'node:stream';

class CollectOutput extends Transform {
	constructor() {
		super();
		this.chunks = [];
	}

	_transform(chunk, encoding, callback) {
		this.chunks.push(chunk);
		callback(null, chunk);
	}
}

export class Fixture {
	static CONTAINER_ENGINE_LIST = ['podman', 'docker'];
	static FIXTURE_PATH_URL = new URL('./fixtures/', import.meta.url);

	/** @type {string} */
	#containerEngine;

	#readyResolve;
	#readyReject;

	constructor({ nextMajor, nodeMajor, debug = false, autoSetup = true }) {
		if (!nextMajor || !nodeMajor) {
			throw new Error(`Fixture options nextMajor and nodeMajor are required`);
		}

		this.nextMajor = nextMajor;
		this.nodeMajor = nodeMajor;

		this.debug = debug;

		this.imageName = `hdb-next-integration-test-image-next-${nextMajor}-node-${nodeMajor}`;
		this.containerName = `hdb-next-integration-test-container-next-${nextMajor}-node-${nodeMajor}`;

		if (autoSetup) {
			this.ready = new Promise((resolve, reject) => {
				this.#readyResolve = resolve;
				this.#readyReject = reject;
			});
			this.clear()
				.then(() => this.build())
				.then(() => this.run())
				.then(this.#readyResolve, this.#readyReject);
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

	build() {
		return new Promise((resolve, reject) => {
			const buildProcess = child_process.spawn(
				this.containerEngine,
				[
					'build',
					'--build-arg',
					`NEXT_MAJOR=${this.nextMajor}`,
					'--build-arg',
					`NODE_MAJOR=${this.nodeMajor}`,
					'-t',
					this.imageName,
					'.',
				],
				{
					cwd: Fixture.FIXTURE_PATH_URL,
					stdio: this.#stdio,
				}
			);

			buildProcess.on('error', reject);

			buildProcess.on('exit', (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error(`\`${this.containerEngine} build\` exited with code ${code}`));
				}
			});
		});
	}

	stop() {
		return new Promise((resolve, reject) => {
			const stopProcess = child_process.spawn(this.containerEngine, ['stop', this.containerName], {
				stdio: this.#stdio,
			});

			stopProcess.on('error', reject);

			stopProcess.on('exit', (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error(`\`${this.containerEngine} stop\` exited with code ${code}`));
				}
			});
		});
	}

	rm() {
		return new Promise((resolve, reject) => {
			const rmProcess = child_process.spawn(this.containerEngine, ['rm', this.containerName], { stdio: this.#stdio });

			rmProcess.on('error', reject);

			rmProcess.on('exit', (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error(`\`${this.containerEngine} rm\` exited with code ${code}`));
				}
			});
		});
	}

	clear() {
		return new Promise((resolve, reject) => {
			const psProcess = child_process.spawn(this.containerEngine, ['ps', '-aq', '-f', `name=${this.containerName}`]);

			psProcess.on('error', reject);

			const collectedStdout = psProcess.stdout.pipe(new CollectOutput());

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
			const resolveReady = this.#readyResolve;
			const stdout = runProcess.stdout.pipe(
				new Transform({
					transform(chunk, encoding, callback) {
						if (chunk.toString().includes('HarperDB 4.4.5 successfully started')) {
							resolveReady();
						}
						callback(null, chunk);
					},
				})
			);

			if (this.debug) {
				stdout.pipe(process.stdout);
			}

			runProcess.on('error', reject);

			runProcess.on('exit', (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error(`\`${this.containerEngine} run\` exited with code ${code}`));
				}
			});
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
