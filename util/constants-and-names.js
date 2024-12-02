import { join } from 'node:path';

export const ROOT = join(import.meta.dirname, '..');

export const NEXT_MAJORS = ['13', '14', '15'];

export const NODE_MAJORS = ['18', '20', '22'];

export const PORTS = ['9925', '9926'];

export const CONTAINER_ENGINE_LIST = ['podman', 'docker'];

export function getNodeBaseImageName(nodeMajor) {
	return `harperdb-nextjs/node-base-${nodeMajor}`;
}

export function getNextImageName(nextMajor, nodeMajor) {
	return `harperdb-nextjs/test-image-next-${nextMajor}-node-${nodeMajor}`;
}

export function getNextContainerName(nextMajor, nodeMajor) {
	return `harperdb-nextjs-test-container-next-${nextMajor}-node-${nodeMajor}`;
}
