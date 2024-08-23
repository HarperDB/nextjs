import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import child_process from 'node:child_process';
import events from 'node:events';
import assert from 'node:assert';

import next from 'next';
import semver from 'semver';
import shellQuote from 'shell-quote';

/**
 * @typedef {Object} ExtensionOptions - The configuration options for the extension. These are all configurable via `config.yaml`.
 * @property {boolean=} dev - Enable dev mode
 * @property {boolean=} prebuilt - Instruct the extension to skip executing the 
 * @property {string=} installCommand - A custom install command. Defaults to `npm run install`
 * @property {string=} buildCommand - A custom build command. Default to `npm run build`
 */

let CONFIG;

/**
 * Resolves the incoming extension options into a config for use throughout the extension
 * @param {ExtensionOptions} options - The options object to be resolved into a configuration
 * @returns {Required<ExtensionOptions>}
 */
function resolveConfig (options) {
	if (CONFIG) return CONFIG; // return memoized config

	if (options.installCommand) {
		const installCommandType = typeof options.installCommand
		assert.strictEqual(installCommandType, 'string', `installCommand must be type string. received: ${installCommandType}`)
	}

	if (options.buildCommand) {
		const buildCommandType = typeof options.buildCommand
		assert.strictEqual(buildCommandType, 'string', `buildCommand must be type string. received: ${buildCommandType}`)
	}

	// Memoize config resolution
	return CONFIG = {
		dev: Boolean(options.dev), // defaults to `false`
		prebuilt: Boolean(options.prebuilt), // defaults to `false`
		installCommand: options.installCommand ?? 'npm install',
		buildCommand: options.buildCommand ?? 'npm run build'
	};
}

class NextJSAppVerificationError extends Error {}

const nextJSAppCache = {};

/**
 * This function verifies if the input is a Next.js app through a couple of
 * verification methods. It does not return nor throw anything. It will either
 * silently succeed, or log an error to `logger.fatal` and exit the process
 * with exit code 1.
 * 
 * Additionally, it memoizes previous verifications.
 * 
 * @param {string} componentPath
 * @returns void
 */
function assertNextJSApp (componentPath) {
	try {
		if (nextJSAppCache[componentPath]) { return; }

		if(!fs.existsSync(componentPath)) {
			throw new NextJSAppVerificationError(`The folder ${componentPath} does not exist`);
		}

		if(!fs.statSync(componentPath).isDirectory) {
			throw new NextJSAppVerificationError(`The path ${componentPath} is not a folder`);
		}

		// Couple options to check if its a Next.js project
		// 1. Check for Next.js config file (next.config.{js|ts})
		//    - This file is not required for a Next.js project
		// 2. Check package.json for Next.js dependency
		//    - It could be listed in `dependencies` or `devDependencies` (and maybe even `peerDependencies` or `optionalDependencies`)
		//    - Also not required. Users can use `npx next ...`
		// 3. Check for `.next` folder
		//    - This could be a reasonable fallback if we want to support pre-built Next.js apps



		// A combination of options 1 and 2 should be sufficient for our purposes.
		// Edge case: app does not have a config and are using `npx` (or something similar) to execute Next.js

		// Check for Next.js Config
		const configExists = fs.existsSync(path.join(componentPath, 'next.config.js')) || fs.existsSync(path.join(componentPath, 'next.config.ts'));

		// Check for dependency
		let dependencyExists = false;
		let packageJSONPath = path.join(componentPath, 'package.json');
		if (fs.existsSync(packageJSONPath)) {
			let packageJSON = JSON.parse(fs.readFileSync(packageJSONPath));
			for (let dependencyList of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
				let nextJSVersion = packageJSON[dependencyList]?.['next']
				if (nextJSVersion) {
					if (!semver.satisfies(semver.minVersion(nextJSVersion), '>=14.0.0')) {
						throw new NextJSAppVerificationError(`Next.js version must be >=14.0.0. Found ${nextJSVersion}`);
					}
					dependencyExists = true;
					break;
				}
			}
		}

		if (!configExists && !dependencyExists) {
			throw new NextJSAppVerificationError(`Could not determine if ${componentPath} is a Next.js project. It is missing both a Next.js config file and the "next" dependency in package.json`);
		}

		nextJSAppCache[componentPath] = true;
	} catch (error) {
		if (error instanceof NextJSAppVerificationError) {
			logger.fatal(`Component path is not a Next.js application: `, error.message);
		} else {
			logger.fatal(`Unexpected Error thrown during Next.js Verification: `, error);
		}

		process.exit(1);
	}
}

/**
 * Execute a command as a promise and wait for it to exit before resolving.
 * 
 * Will automatically stream output to stdio when log level is set to debug.
 * @param {string} commandInput The command string to be parsed and executed
 * @param {string} componentPath The path to the application component
 * @param {boolean=} debug Print debugging information. Defaults to false
 */
async function executeCommand(commandInput, componentPath) {
	const [ command, ...args ] = shellQuote.parse(commandInput);
	const cp = child_process.spawn(command, args, {
		cwd: componentPath,
		stdio: logger.log_level === 'debug' ? 'inherit' : 'ignore'
	});

	const [exitCode] = await events.once(cp, 'exit');

	logger.debug(`Command: \`${commandInput}\` exited with ${exitCode}`);
}

/**
 * This method is executed once, on the main thread, and is responsible for
 * returning a Resource Extension that will subsequently be executed once,
 * on the main thread.
 * 
 * The Resource Extension is responsible for installing application component
 * dependencies and running the application build command.
 * 
 * @param {ExtensionOptions} options 
 * @returns 
 */
export function startOnMainThread (options = {}) {
	const config = resolveConfig(options);

	logger.debug('Next.js Extension Configuration:', JSON.stringify(config, undefined, 2));

	return {
		async setupDirectory(_, componentPath) {
			logger.info(`Next.js Extension is setting up ${componentPath}`)

			assertNextJSApp(componentPath);

			if (!fs.existsSync(path.join(componentPath, 'node_modules'))) {
				await executeCommand(config.installCommand, componentPath)
			}

			if (!config.prebuilt) {
				await executeCommand(config.buildCommand, componentPath)
			}

			return true;
		}
	}
}

/**
 * This method is executed on each worker thread, and is responsible for
 * returning a Resource Extension that will subsequently be executed on each
 * worker thread.
 * 
 * The Resource Extension is responsible for creating the Next.js server, and
 * hooking into the global HarperDB server.
 * 
 * @param {ExtensionOptions} options 
 * @returns 
 */
export function start (options = {}) {
	const config = resolveConfig(options);

	return {
		async handleDirectory(_, componentPath) {

			logger.info(`Next.js Extension is creating a Next.js Server for ${componentPath}`);

			assertNextJSApp(componentPath);

			const app = next({ dir: componentPath, dev: config.dev });
			await app.prepare();
			// TODO: Dig Deep on this part
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