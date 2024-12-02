import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { containerEngine } from './get-container-engine.js';
import { getNextImageName } from './get-next-image-name.js';
import { CollectedTransform } from './collected-transform.js';

const DEBUG = process.env.DEBUG === '1';

const NODE_MAJORS = ['18', '20', '22'];

const getNodeBaseImageName = (nodeMajor) => `harperdb-nextjs/node-base-${nodeMajor}`;

function build(name, args, options = {}) {
	return new Promise((resolve, reject) => {
		const buildProcess = spawn(containerEngine, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });

		const collectedStdout = buildProcess.stdout.pipe(new CollectedTransform());
		const collectedStderr = buildProcess.stderr.pipe(new CollectedTransform());

		buildProcess.on('error', (error) => reject(error));
		buildProcess.on('close', (code) =>
			resolve({
				name,
				code,
				stdout: collectedStdout.output,
				stderr: collectedStderr.output,
			})
		);
	});
}

// Build Node Base Images
const nodeImagesBuildResults = await Promise.all(
	NODE_MAJORS.map((nodeMajor) =>
		build(getNodeBaseImageName(nodeMajor), [
			'build',
			'--build-arg',
			`NODE_MAJOR=${nodeMajor}`,
			'-t',
			getNodeBaseImageName(nodeMajor),
			'-f',
			join(import.meta.dirname, 'base.dockerfile'),
			join(import.meta.dirname, '..'),
		])
	)
);

validateResults(nodeImagesBuildResults);

const NEXT_MAJORS = ['13', '14', '15'];

for (const nextMajor of NEXT_MAJORS) {
	const nextImageBuildResults = await Promise.all(
		NODE_MAJORS.map((nodeMajor) =>
			build(getNextImageName(nextMajor, nodeMajor), [
				'build',
				'--build-arg',
				`BASE_IMAGE=${getNodeBaseImageName(nodeMajor)}`,
				'--build-arg',
				`NEXT_MAJOR=${nextMajor}`,
				'-t',
				getNextImageName(nextMajor, nodeMajor),
				'-f',
				join(import.meta.dirname, 'next.dockerfile'),
				join(import.meta.dirname, '..'),
			])
		)
	);

	validateResults(nextImageBuildResults);
}

function validateResults(results) {
	let success = true;
	for (const result of results) {
		if (result.code !== 0) success = false;

		if (DEBUG || !success) {
			console.log(`Image \x1b[94m${result.name}\x1b[0m build process exited with: \x1b[35m${result.code}\x1b[0m\n`);
			result.stdout !== '' && console.log('\x1b[32mstdout\x1b[0m:\n' + result.stdout + '\n');
			result.stderr !== '' && console.log('\x1b[31mstderr\x1b[0m:\n' + result.stderr + '\n');
		}
	}

	if (!success) {
		process.exit(1);
	}
}
