// Arg next fixture path
import { parseArgs } from 'node:util';
import { execSync } from 'node:child_process';
import { NEXT_MAJORS, ROOT } from '../constants-and-names.js';
import { symlink } from 'node:fs/promises';
import { join } from 'node:path';

const HELP = `@harperdb/nextjs run fixture locally CLI

Note: The Node.js version is determined by the Node.js version on your machine.

Usage:
  \x1b[36mnpm run run-fixture-locally\x1b[0m \x1b[35m-- --next-major\x1b[0m=\x1b[32m<next-major>\x1b[0m
  \x1b[36mnpm run run-fixture-locally\x1b[0m \x1b[32m<next-major>\x1b[0m

Example: \x1b[33mnpm run run-fixture-locally 14 /hdb \x1b[0m \x1b[2m# Next.js v14 fixture \`fixtures/next-14\`\x1b[0m
`;

const { values, positionals } = parseArgs({
	options: { 'next-major': { type: 'string' }, 'help': { type: 'boolean' } },
	allowPositionals: true,
});

if (values.help) {
	console.log(HELP);
	process.exit(0);
}

const nextMajor = values['next-major'] ?? positionals[0];

if (nextMajor === undefined) {
	console.error('Error: Incorrect arguments.\n');
	console.log(HELP);
	process.exit(1);
}

if (!NEXT_MAJORS.has(nextMajor)) {
	console.error(`Error: Invalid next-major: ${nextMajor}. Supported values: ${Array.from(NEXT_MAJORS).join(', ')}`);
	process.exit(1);
}

// execSync('harperdb start', { stdio: 'inherit' });
const configurationString = execSync(`harperdb get_configuration json=true`, { encoding: 'utf-8' });
const configuration = JSON.parse(configurationString);
const componentsRoot = configuration.componentsRoot;

console.log(`⛓️  Linking fixtures to ${componentsRoot}`);

const linkResults = await Promise.all([
	symlink(join(ROOT, 'fixtures', 'harperdb-base-component'), join(componentsRoot, 'harperdb-base-component')),
	symlink(join(ROOT, 'fixtures', `next-${nextMajor}`), join(componentsRoot, `next-${nextMajor}`)),
]);

execSync(`harperdb restart`, { stdio: 'inherit' });
