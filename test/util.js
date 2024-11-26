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

	console.log(`🏗️  Building ${imageName}...`);

	child_process.spawnSync(
		containerEngine,
		['build', '--build-arg', `NEXT_MAJOR=${nextMajor}`, '--build-arg', `NODE_MAJOR=${nodeMajor}`, '-t', imageName, '.'],
		{ cwd: FIXTURE_PATH_URL, stdio: process.env.DEBUG === '1' ? 'inherit' : 'ignore' }
	);

	console.log(`🏗️  Build complete!`);

	return imageName;
}

function runContainer({ nextMajor, nodeMajor, imageName, containerEngine }) {
	if (!containerEngine) {
		containerEngine = getContainerEngine();
	}

	const containerName = `hdb-next-integration-test-container-next-${nextMajor}-node-${nodeMajor}`;

	clearContainer({ containerEngine, containerName });

	const runProcess = child_process.spawn(
		containerEngine,
		['run', '-p', '9925:9925', '-p', '9926:9926', '--name', containerName, imageName] /*, {
		stdio: process.env.DEBUG ? 'inherit' : 'ignore' 
	}*/
	);

	return { containerName, runProcess };
}

export class Fixture extends EventEmitter {
	constructor({ nextMajor, nodeMajor }) {
		super();

		this.containerEngine = getContainerEngine();

		this.imageName = buildContainer({ nextMajor, nodeMajor, containerEngine: this.containerEngine });

		const { containerName, runProcess } = runContainer({
			imageName: this.imageName,
			containerName: this.containerName,
			containerEngine: this.containerEngine,
		});

		this.containerName = containerName;
		this.runProcess = runProcess;

		this.runProcess.stdout.on('data', (data) => {
			if (data.toString().includes('HarperDB 4.4.5 successfully started')) {
				this.emit('ready');
			}
		});
	}

	cleanup() {
		clearContainer({ containerEngine: this.containerEngine, containerName: this.containerName });
	}
}
