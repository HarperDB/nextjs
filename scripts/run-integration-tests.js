import { spawnSync, spawn } from 'node:child_process';
import assert from 'node:assert';

const NEXT_VERSIONS = [9, 10, 11, 12, 13, 14, 15];
const NODE_VERSIONS = [16, 18, 20, 22];

function getContainerEngine() {
	for (const engine of ['podman', 'docker']) {
		if (spawnSync(engine, ['--version'], { stdio: 'ignore' }).status === 0) {
			return engine;
		}
	}
}

// Determine Container Engine
const containerEngine = getContainerEngine();

console.log(`🐳 Using container engine: ${containerEngine}`);

let overallExitCode = 0;

console.log(`🎯 Running tests with the following matrix:
   Next.js versions: ${NEXT_VERSIONS.join(', ')}
   Node.js versions: ${NODE_VERSIONS.join(', ')}
`);

function runIntegrationTest(nextVersion, nodeVersion) {
	return new Promise((resolve, reject) => {
		console.log(`🚀 Testing with Next.js: v${nextVersion} and Node.js: v${nodeVersion}`);

		const imageName = `integration-test-image-next-${nextVersion}-node-${nodeVersion}`;
		const containerName = `integration-test-container-next-${nextVersion}-node-${nodeVersion}`;

		function stopAndRemove() {
			if (spawnSync(containerEngine, ['ps', '-aq', '-f', `name=${containerName}`]).stdout !== '') {
				spawnSync(containerEngine, ['stop', containerName], { stdio: 'ignore' });
				spawnSync(containerEngine, ['rm', containerName], { stdio: 'ignore' });
			}
		}

		stopAndRemove();

		console.log(`🏗️  Building ${imageName}...`);

		spawnSync(
			containerEngine,
			[
				'build',
				'--build-arg',
				`NEXT_MAJOR=${nextVersion}`,
				'--build-arg',
				`NODE_MAJOR=${nodeVersion}`,
				'-t',
				imageName,
				'test/integration',
			],
			{ stdio: 'inherit' }
		);

		console.log(`🧪 Running tests...`);

		const runProcess = spawn(containerEngine, ['run', '-p', '3000:3000', '--name', containerName, imageName]);

		runProcess.on('exit', (code) => {
			console.log(`🧹 Cleaning up...`);
			stopAndRemove();
			resolve(code);
		});

		runProcess.on('error', (err) => {
			console.error('Process error:', err);
			stopAndRemove();
			reject(err);
		});

		// Gotta figure out the actual test flow here, but this is the idea.
		// Start the container which (eventually) runs a Next.js app
		// Then execute some test file against that app which probably uses fetch to verify pages are correct
		// Then when that test file is done, shutdown the container and report the results.
		runProcess.stdout.on('data', (data) => {
			console.log(`stdout: ${data}`);
			fetch('http://localhost:3000')
				.then((res) => res.text())
				.then((body) => {
					assert(body === `Next.js v${nextVersion}`);
					stopAndRemove();
				})
				.catch((err) => {
					console.error('Error fetching:', err);
					stopAndRemove();
					reject(err);
				});
		});

		runProcess.stderr.on('data', (data) => {
			console.log(`stderr: ${data}`);
		});
	});
}

const results = {};

for (const nextVersion of NEXT_VERSIONS) {
	const nextVersionKey = `Next.js v${nextVersion}`;
	results[nextVersionKey] = {};
	for (const nodeVersion of NODE_VERSIONS) {
		const nodeVersionKey = `Node.js v${nodeVersion}`;
		const exitCode = await runIntegrationTest(nextVersion, nodeVersion);
		console.log(`🏁 Test finished with exit code: ${exitCode}`);
		// Replace this with 0 when the container actually has a 0 exit
		if (exitCode === 137) {
			results[nextVersionKey][nodeVersionKey] = '✅';
		} else {
			results[nextVersionKey][nodeVersionKey] = '❌';
			overallExitCode = 1;
		}
	}
}

console.log(`📊 Test Summary:`);
console.table(results);

process.exit(overallExitCode);
