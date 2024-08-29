#!/usr/bin/env node
import child_process from 'node:child_process';
import events from 'node:events';

const cwd = process.cwd();
const command = process.argv.length === 2 ? 'help' : process.argv[2];

async function executeHarperDB (mode) {
	const p = child_process.spawn('harperdb', ['run', './'], {
		cwd,
		stdio: 'inherit',
		env: {
			...process.env,
			HARPERDB_NEXTJS_MODE: mode
		}
	});
	const [exitCode] = await events.once(p, 'exit');
	console.log('HarperDB exited with code:', exitCode);
}

const HELP = `
Usage: harperdb-nextjs <command>

Available commands:
  build    - Build the Next.js app only
  dev      - Start HarperDB and run Next.js in development mode
  help     - Display this help message
  start    - Start HarperDB and run Next.js in production mode
`

switch(command) {
	case 'build':
		await executeHarperDB('build');
		break;
	case 'dev':
		await executeHarperDB('dev');
		break;
	case 'start':
		await executeHarperDB('prod');
		break;
	default:
		console.log('Unknown command:', command);
	case 'help':
		console.log('Usage: harperdb-nextjs build|dev|start|help');
		break;
}