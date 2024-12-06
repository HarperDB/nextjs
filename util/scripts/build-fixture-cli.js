import { parseArgs } from 'node:util';
import { NEXT_MAJORS, NODE_MAJORS, VERSION_MATRIX } from '../constants-and-names.js';
import { buildNextImage, buildNodeImage } from '../build-fixture.js';

const HELP = `@harperdb/nextjs build fixture CLI

Usage:
  \x1b[36mnpm run build-fixture\x1b[0m \x1b[35m-- --next-major\x1b[0m=\x1b[32m<next-major>\x1b[0m \x1b[35m--node-major=\x1b[0m\x1b[32m<node-major>\x1b[0m
  \x1b[36mnpm run build-fixture\x1b[0m \x1b[32m<next-major>\x1b[0m \x1b[32m<node-major>\x1b[0m

Example: \x1b[33mnpm run build-fixture 15 20\x1b[0m \x1b[2m# Next.js v15 and Node.js v20\x1b[0m
`;

const { values, positionals } = parseArgs({
	options: { 'next-major': { type: 'string' }, 'node-major': { type: 'string' }, 'help': { type: 'boolean' } },
	allowPositionals: true,
});

if (values.help) {
	console.log(HELP);
	process.exit(0);
}

let { 'next-major': nextMajor, 'node-major': nodeMajor } = values;

if (nextMajor === undefined && nodeMajor === undefined) {
	[nextMajor, nodeMajor] = positionals;
}

if (nextMajor === undefined || nodeMajor === undefined) {
	console.error('Error: Incorrect arguments.\n');
	console.log(HELP);
	process.exit(1);
}

if (!NEXT_MAJORS.has(nextMajor)) {
	console.error(`Error: Invalid next-major: ${nextMajor}. Supported values: ${Array.from(NEXT_MAJORS).join(', ')}`);
	process.exit(1);
}

if (!NODE_MAJORS.has(nodeMajor)) {
	console.error(`Error: Invalid node-major: ${nodeMajor}. Supported values: ${Array.from(NODE_MAJORS).join(', ')}`);
	process.exit(1);
}

if (!VERSION_MATRIX.some(([next, node]) => next === nextMajor && node === nodeMajor)) {
	console.error(
		`Error: Unsupported combination of next-major and node-major: ${nextMajor} and ${nodeMajor}. Supported combinations: ${VERSION_MATRIX.map(([next, node]) => `(${next}, ${node})`).join(' ')}`
	);
	process.exit(1);
}

console.log(`🏗️  Building images for Next.js v${nextMajor} and Node.js v${nodeMajor}`);

buildNodeImage(nodeMajor)
	.then(() => buildNextImage(nextMajor, nodeMajor))
	.then(() => {
		console.log('🏗️  Build completed successfully.');
		process.exit(0);
	})
	.catch((error) => {
		console.error('🏗️  Error: Build failed.');
		console.error(error);
		process.exit(1);
	});
