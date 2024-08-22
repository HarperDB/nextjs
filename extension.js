import fs from 'node:fs';
import path from 'node:path';
import next from 'next';
import semver from 'semver';
import url from 'node:url';
import child_process from 'node:child_process';
import events from 'node:events';
import assert from 'node:assert';
import shellQuote from 'shell-quote';

/**
 * @typedef {Object} ExtensionOptions
 * @property {boolean=} debug - Enable debug information for the @harperdb/nextjs extension
 * @property {boolean=} dev - Enable dev mode
 * @property {boolean=} prebuilt - Instruct the extension to skip executing the 
 * @property {string=} installCommand - A custom install command. Defaults to `npm run install`
 * @property {string=} buildCommand - A custom build command. Default to `npm run build`
 */

/**
 * Resolves the incoming extension options into a config for use throughout the extension
 * @param {ExtensionOptions} options 
 * @returns {Required<ExtensionOptions>}
 */
function resolveConfig (options) {

	if (options.installCommand) {
		const installCommandType = typeof options.installCommand
		assert.strictEqual(installCommandType, 'string', `installCommand must be type string. received: ${installCommandType}`)
	}

	if (options.buildCommand) {
		const buildCommandType = typeof options.buildCommand
		assert.strictEqual(buildCommandType, 'string', `buildCommand must be type string. received: ${buildCommandType}`)
	}

	return {
		debug: Boolean(options.debug), // defaults to `false`
		dev: Boolean(options.dev), // defaults to `false`
		prebuilt: Boolean(options.prebuilt), // defaults to `false`
		installCommand: options.installCommand ?? 'npm install',
		buildCommand: options.buildCommand ?? 'npm run build'
	};
}

const nextJSAppCache = {};

/**
 * This function will throw an `Error` if it cannot verify the `appPath` is a Next.js project.
 * @param {string} componentPath
 * @returns void
 */
function isNextJSApp (componentPath) {
	if (nextJSAppCache[componentPath]) { return; }

	if(!fs.existsSync(componentPath)) {
		throw new Error(`The folder ${componentPath} does not exist`);
	}
	if(!fs.statSync(componentPath).isDirectory) {
		throw new Error(`The path ${componentPath} is not a folder`);
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
	let configExists = fs.existsSync(path.join(componentPath, 'next.config.js')) || fs.existsSync(path.join(componentPath, 'next.config.ts'));
	// throw new Error(`Next.js config (next.config.{js|ts}) does not exist.`);

	// Check for dependency
	let dependencyExists = false;
	let packageJSONPath = path.join(componentPath, 'package.json');
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
		throw new Error(`Could not determine if ${componentPath} is a Next.js project. It is missing both a Next.js config file and the "next" dependency in package.json`);
	}

	nextJSAppCache[componentPath] = true;
}

/**
 * 
 * @param {string} name The name of the command being executed
 * @param {string} commandInput The command string to be parsed and executed
 * @param {string} componentPath The path to the application component
 * @param {boolean=} debug Print debugging information. Defaults to false
 */
async function executeCommand(name, commandInput, componentPath, debug = false) {
	const [ command, ...args ] = shellQuote.parse(commandInput);
	const cp = child_process.spawn(command, args, { cwd: componentPath, stdio: 'inherit' });
	const exitCode = await events.once(cp, 'exit');
	debug && console.log(`${name} command exited with ${exitCode}`);
}

/**
 * 
 * @param {ExtensionOptions} options 
 * @returns 
 */
export async function startOnMainThread (options) {
	const config = resolveConfig(options);
	
	config.debug && console.log('Next.js Extension - startOnMainThread');

	return {
		async setupDirectory(_, componentPath) {
			config.debug && console.log('Next.js Extension - startOnMainThread - setupDirectory', componentPath);

			try {
				isNextJSApp(componentPath);
			} catch (error) {
				if (error instanceof Error) {
					console.error(`Component path is not a Next.js application: `, error.message);
					process.exit(1);
				}
			}

			if (!fs.existsSync(path.join(componentPath, 'node_modules'))) {
				await executeCommand('Install', config.installCommand, componentPath, config.debug)
			}

			if (!config.prebuilt) {
				// Next.js is weird and you must use the Next.js dependency located in the project directory to build
				await executeCommand('Build', config.buildCommand, componentPath, config.debug)
			}

			return true;
		}
	}
}

/**
 * 
 * @param {ExtensionOptions} options 
 * @returns 
 */
export function start (options) {
	const config = resolveConfig(options);

	config.debug && console.log('Next.js Extension - Start');

	return {
		async handleDirectory(_, componentPath) {
			config.debug && console.log('Next.js Extension - start - handleDirectory', componentPath);

			try {
				isNextJSApp(componentPath);
			} catch (error) {
				if (error instanceof Error) {
					console.error(`Component path is not a Next.js application: `, error.message);
					process.exit(1);
				}
			}

			const app = next({ dir: componentPath, dev: config.dev });
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

			return true;
		}
	}
}