import fs from 'node:fs';
import path from 'node:path';
import next from 'next';
import semver from 'semver';
import url from 'node:url';
import child_process from 'node:child_process';
import events from 'node:events';
import assert from 'node:assert';
import shellQuote from 'shell-quote';

function resolveConfig (options) {
	const config = {
		debug: Boolean(options.debug), // defaults to `false`
		dev: Boolean(options.dev), // defaults to `false`
		prebuilt: Boolean(options.prebuilt) // defaults to `false`
	}

	// installCommand
	if (options.installCommand) {
		const installCommandType = typeof options.installCommand
		assert.strictEqual(installCommandType, 'string', `installCommand must be type string. received: ${installCommandType}`)
	}
	// TODO: Detect package manager
	config.installCommand = options.installCommand ?? 'npm install';

	// buildCommand
	if (options.buildCommand) {
		const buildCommandType = typeof options.buildCommand
		assert.strictEqual(buildCommandType, 'string', `buildCommand must be type string. received: ${buildCommandType}`)
	}

	// TODO: Detect package manager
	config.buildCommand = options.buildCommand ?? 'npm run build';

	return config;
}

const nextJSAppCache = {};
/**
 * This function will throw an `Error` if it cannot verify the `appPath` is a Next.js project.
 * @param {string} appPath
 * @returns void
 */
function isNextJSApp (appPath) {
	if (nextJSAppCache[appPath]) { return; }

	if(!fs.existsSync(appPath)) {
		throw new Error(`The folder ${appPath} does not exist`);
	}
	if(!fs.statSync(appPath).isDirectory) {
		throw new Error(`The path ${appPath} is not a folder`);
	}

	// Couple options to check if its a Next.js project
	// 1. Check for Next.js config file (next.config.{js|ts})
	//    - This file is not required for a Next.js project
	// 2. Check package.json for Next.js dependency
	//    - It could be listed in `dependencies` or `devDependencies` (and maybe even `peerDependencies` or `optionalDependencies`)
	//    - Also not required. Users can use `npx next ...`
	// 3. Check for `.next` folder
	//    - This could be a reasonable fallback if we want to support pre-built Next.js apps
	// 
	// A combination of options 1 and 2 should be sufficient for our purposes.
	// Edge case of a user without a config and using `npx` (or something similar) will exist.

	// Check for Next.js Config
	let configExists = fs.existsSync(path.join(appPath, 'next.config.js')) || fs.existsSync(path.join(appPath, 'next.config.ts'));
	// throw new Error(`Next.js config (next.config.{js|ts}) does not exist.`);

	// Check for dependency
	let dependencyExists = false;
	let packageJSONPath = path.join(appPath, 'package.json');
	if (fs.existsSync(packageJSONPath)) {
		let packageJSON = JSON.parse(fs.readFileSync(packageJSONPath));
		for (let dependencyList of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
			let nextJSVersion = packageJSON[dependencyList]?.['next']
			if (nextJSVersion) {
				if (!semver.satisfies(semver.minVersion(nextJSVersion), '>=14.0.0')) {
					throw new Error(`Next.js version must be >=14.0.0. Found ${nextJSVersion}`);
				}
				dependencyExists = true;
				break;
			}
		}
	}

	if (!configExists && !dependencyExists) {
		throw new Error(`Could not determine if ${appPath} is a Next.js project. It is missing both a Next.js config file and the "next" dependency in package.json`);
	}

	nextJSAppCache[appPath] = true;
}

async function executeCommand(name, commandInput) {
	const [ command, ...args ] = shellQuote.parse(commandInput);
	const cp = child_process.spawn(command, args, { cwd: appPath, stdio: 'inherit' });
	const exitCode = await events.once(cp, 'exit');
	console.log(`${name} command exited with ${exitCode}`);
}

export async function startOnMainThread (options) {
	const config = resolveConfig(options);
	
	config.debug && console.log('Next.js Extension - startOnMainThread');

	return {
		async setupDirectory(_, appPath) {
			config.debug && console.log('Next.js Extension - startOnMainThread - setupDirectory');

			try {
				isNextJSApp(appPath);
			} catch (error) {
				if (error instanceof Error) {
					console.error(`Component path is not a Next.js application: `, error.message);
					process.exit(1);
				}
			}

			if (!fs.existsSync(path.join(appPath, 'node_modules'))) {
				await executeCommand('Install', config.installCommand)
			}

			if (!config.prebuilt) {
				// Next.js is weird and you must use the Next.js dependency located in the project directory to build
				await executeCommand('Build', config.buildCommand)
			}
		}
	}
}

export function start (options) {
	const config = resolveConfig(options);

	config.debug && console.log('Next.js Extension - Start');

	return {
		async handleDirectory(_, appPath) {
			config.debug && console.log('Next.js Extension - start - handleDirectory');

			try {
				isNextJSApp(appPath);
			} catch (error) {
				if (error instanceof Error) {
					console.error(`Component path is not a Next.js application: `, error.message);
					process.exit(1);
				}
			}

			const app = next({ dir: appPath, dev: config.dev });
			await app.prepare();
			// // TODO: Dig Deep on this part
			const handle = app.getRequestHandler();
			options.server.http((request) => {
				return handle(
					request._nodeRequest,
					request._nodeResponse,
					url.parse(request._nodeRequest.url, true)
				)
			})
		}
	}
}