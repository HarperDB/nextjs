import { spawnSync } from 'node:child_process';

import { CONTAINER_ENGINE_LIST } from './constants-and-names.js';

export function getContainerEngine() {
	for (const engine of CONTAINER_ENGINE_LIST) {
		const { status } = spawnSync(engine, ['--version'], { stdio: 'ignore' });
		if (status === 0) {
			return engine;
		}
	}

	throw new Error(`No container engine found in ${CONTAINER_ENGINE_LIST.join(', ')}`);
}

export const CONTAINER_ENGINE = getContainerEngine();
