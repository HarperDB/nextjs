import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { DEBUG, ROOT, getNodeBaseImageName, getNextImageName } from './constants-and-names.js';
import { CONTAINER_ENGINE } from './container-engine.js';
import { CollectedTransform } from './collected-transform.js';

function validateResult(result) {
	const success = result.code === 0;

	if (DEBUG || !success) {
		console.log(`Image \x1b[94m${result.name}\x1b[0m build process exited with: \x1b[35m${result.code}\x1b[0m\n`);
		result.stdout !== '' && console.log('\x1b[32mstdout\x1b[0m:\n' + result.stdout + '\n');
		result.stderr !== '' && console.log('\x1b[31mstderr\x1b[0m:\n' + result.stderr + '\n');
	}

	if (!success) {
		process.exit(1);
	}
}

function build(name, args, options = {}) {
	return new Promise((resolve, reject) => {
		const buildProcess = spawn(CONTAINER_ENGINE, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], ...options });

		const collectedStdout = buildProcess.stdout.pipe(new CollectedTransform());
		const collectedStderr = buildProcess.stderr.pipe(new CollectedTransform());

		buildProcess.on('error', reject);
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

export function buildNodeImage(nodeMajor, validate = true) {
	const buildPromise = build(getNodeBaseImageName(nodeMajor), [
		'build',
		'--build-arg',
		`NODE_MAJOR=${nodeMajor}`,
		'-t',
		getNodeBaseImageName(nodeMajor),
		'-f',
		join(ROOT, 'util', 'docker', 'base.dockerfile'),
		ROOT,
	]);

	return validate ? buildPromise.then(validateResult) : buildPromise;
}

export function buildNextImage(nextMajor, nodeMajor, validate = true) {
	const buildPromise = build(getNextImageName(nextMajor, nodeMajor), [
		'build',
		'--build-arg',
		`BASE_IMAGE=${getNodeBaseImageName(nodeMajor)}`,
		'--build-arg',
		`NEXT_MAJOR=${nextMajor}`,
		'-t',
		getNextImageName(nextMajor, nodeMajor),
		'-f',
		join(ROOT, 'util', 'docker', 'next.dockerfile'),
		ROOT,
	]);

	return validate ? buildPromise.then(validateResult) : buildPromise;
}
