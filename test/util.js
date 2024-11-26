import child_process from 'node:child_process';
import EventEmitter from 'node:events';

const FIXTURE_PATH_URL = new URL('./fixtures/', import.meta.url);

const CONTAINER_ENGINE_LIST = ['podman', 'docker'];

function getContainerEngine() {
	for (const containerEngine of CONTAINER_ENGINE_LIST) {
		const { status } = child_process.spawnSync(containerEngine, ['--version'], { stdio: 'ignore' });
		if (status === 0) {
			return containerEngine;
		}
	}

	throw new Error(`No container engine found in ${CONTAINER_ENGINE_LIST.join(', ')}`);
}

function clearContainer({ containerEngine, containerName }) {
	const { stdout } = child_process.spawnSync(containerEngine, ['ps', '-aq', '-f', `name=${containerName}`]);
	if (stdout !== '') {
		child_process.spawnSync(containerEngine, ['stop', containerName], { stdio: 'ignore' });
		child_process.spawnSync(containerEngine, ['rm', containerName], { stdio: 'ignore' });
	}
}

function buildContainer({ nextMajor, nodeMajor, containerEngine }) {
	if (!containerEngine) {
		containerEngine = getContainerEngine();
	}

	const imageName = `hdb-next-integration-test-image-next-${nextMajor}-node-${nodeMajor}`;

	// console.log(`🏗️  Building ${imageName}...`);

	child_process.spawnSync(
		containerEngine,
		['build', '--build-arg', `NEXT_MAJOR=${nextMajor}`, '--build-arg', `NODE_MAJOR=${nodeMajor}`, '-t', imageName, '.'],
		{ cwd: FIXTURE_PATH_URL, stdio: process.env.DEBUG === '1' ? 'inherit' : 'ignore' }
	);

	// console.log(`🏗️  Build complete!`);

	return imageName;
}

function determinePortMapping({ containerName, containerEngine }) {
	const portMap = new Map();
	for (const port of ['9925', '9926']) {
		const { stdout } = child_process.spawnSync(containerEngine, ['port', containerName, port]);
		portMap.set(port, stdout.toString().trim());
	}
	return portMap;
}

function runContainer({ nextMajor, nodeMajor, imageName, containerEngine }) {
	if (!containerEngine) {
		containerEngine = getContainerEngine();
	}

	const containerName = `hdb-next-integration-test-container-next-${nextMajor}-node-${nodeMajor}`;

	clearContainer({ containerEngine, containerName });

	const runProcess = child_process.spawn(containerEngine, ['run', '-P', '--name', containerName, imageName]);

	return { containerName, runProcess };
}

export class Fixture extends EventEmitter {
	constructor({ nextMajor, nodeMajor }) {
		super();

		this.containerEngine = getContainerEngine();

		this.imageName = buildContainer({ nextMajor, nodeMajor, containerEngine: this.containerEngine });

		const { containerName, runProcess, portMap } = runContainer({
			nextMajor,
			nodeMajor,
			imageName: this.imageName,
			containerEngine: this.containerEngine,
		});

		this.containerName = containerName;
		this.runProcess = runProcess;

		this.runProcess.stdout.on('data', (data) => {
			if (data.toString().includes('HarperDB 4.4.5 successfully started')) {
				this.portMap = determinePortMapping({
					containerName: this.containerName,
					containerEngine: this.containerEngine,
				});

				this.emit('ready');
			}
		});
	}

	cleanup() {
		clearContainer({ containerEngine: this.containerEngine, containerName: this.containerName });
	}
}

// const f = new Fixture({ nextMajor: '15', nodeMajor: '20' });
