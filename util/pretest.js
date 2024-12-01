import child_process from 'node:child_process';
import { join } from 'node:path';
import { containerEngine } from './getContainerEngine.js';

const DEBUG = process.env.DEBUG === '1';

const STDIO = ['ignore', DEBUG ? 'inherit' : 'ignore', DEBUG ? 'inherit' : 'ignore'];

const NODE_MAJORS = ['18', '20', '22'];

const getNodeBaseImageName = (nodeMajor) => `harperdb-nextjs/node-base-${nodeMajor}`;
// Build Node Base Images
const nodeImagesBuildResults = await Promise.all(
	NODE_MAJORS.map(
		(nodeMajor) =>
			new Promise((resolve, reject) => {
				const buildProcess = child_process.spawn(
					containerEngine,
					[
						'build',
						'--build-arg',
						`NODE_MAJOR=${nodeMajor}`,
						'-t',
						getNodeBaseImageName(nodeMajor),
						'-f',
						join(import.meta.dirname, 'base.dockerfile'),
						join(import.meta.dirname, '..'),
					],
					{ stdio: STDIO }
				);

				buildProcess.on('error', reject);
				buildProcess.on('exit', resolve);
			})
	)
);

console.log(nodeImagesBuildResults);

const NEXT_MAJORS = ['13', '14', '15'];

const getNextImageName = (nextMajor, nodeMajor) => `harperdb-nextjs/test-image-next-${nextMajor}-node-${nodeMajor}`;

const nextImageBuildResults = await Promise.all(
	NEXT_MAJORS.flatMap((nextMajor) =>
		NODE_MAJORS.map(
			async (nodeMajor) =>
				new Promise((resolve, reject) => {
					const buildProcess = child_process.spawn(
						containerEngine,
						[
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
						],
						{
							stdio: STDIO,
						}
					);

					buildProcess.on('error', reject);
					buildProcess.on('exit', resolve);
				})
		)
	)
);

console.log(nextImageBuildResults);
