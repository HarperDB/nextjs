import { spawnSync } from 'child_process';


const CONTAINER_ENGINE_LIST = ['podman', 'docker'];

export function getContainerEngine() {
	for (const engine of CONTAINER_ENGINE_LIST) {
		const { status } = spawnSync(engine, ['--version'], { stdio: 'ignore' });
		if (status === 0) {
			return engine;
		}
	}
	
	throw new Error(`No container engine found in ${CONTAINER_ENGINE_LIST.join(', ')}`);
}

export const containerEngine = getContainerEngine();