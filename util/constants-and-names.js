import { join } from 'node:path';

export const DEBUG = process.env.DEBUG === '1';

export const ROOT = join(import.meta.dirname, '..');

export const VERSION_MATRIX = [
	// Next.js v9
	['9', '16'],
	// Next.js v13
	['13', '18'],
	['13', '20'],
	['13', '22'],
	// Next.js v14
	['14', '18'],
	['14', '20'],
	['14', '22'],
	// Next.js v15
	['15', '18'],
	['15', '20'],
	['15', '22'],
];

export const NEXT_MAJORS = new Set(VERSION_MATRIX.map(([nextMajor]) => nextMajor));
export const NODE_MAJORS = new Set(VERSION_MATRIX.map(([_, nodeMajor]) => nodeMajor));

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
