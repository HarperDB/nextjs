import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import child_process from 'node:child_process';
import assert from 'node:assert';
import { createRequire } from 'node:module';

import shellQuote from 'shell-quote';

/**
 * @typedef {Object} ExtensionOptions - The configuration options for the extension. These are all configurable via `config.yaml`.
 * @property {string=} buildCommand - A custom build command. Default to `next build`.
 * @property {string=} buildOnly - Build the Next.js app and exit. Defaults to `false`.
 * @property {boolean=} dev - Enable dev mode. Defaults to `false`.
 * @property {string=} installCommand - A custom install command. Defaults to `npm install`.
 * @property {number=} port - A port for the Next.js server. Defaults to the HarperDB HTTP Port.
 * @property {number=} securePort - A (secure) port for the https Next.js server. Defaults to the HarperDB HTTP Secure Port.
 * @property {boolean=} prebuilt - Instruct the extension to skip executing the `buildCommand`. Defaults to `false`.
 * @property {string=} subPath - A sub path for serving request from. Defaults to `''`.
 */

/**
 * Assert that a given option is a specific type
 *
 * @param {string} name The name of the option
 * @param {any=} option The option value
 * @param {string} expectedType The expected type (i.e. `'string'`, `'number'`, `'boolean'`, etc.)
 */
function assertType(name, option, expectedType) {
	if (option) {
		const found = typeof option;
		assert.strictEqual(found, expectedType, `${name} must be type ${expectedType}. Received: ${found}`);
	}
}

/**
 * Resolves the incoming extension options into a config for use throughout the extension
 * @param {ExtensionOptions} options - The options object to be resolved into a configuration
 * @returns {Required<ExtensionOptions>}
 */
function resolveConfig(options) {
	// Environment Variables take precedence
	switch (process.env.HARPERDB_NEXTJS_MODE) {
		case 'dev':
			options.dev = true;
			break;
		case 'build':
			options.buildOnly = true;
			options.dev = false;
			options.prebuilt = false;
			break;
		case 'prod':
			options.dev = false;
			break;
		default:
			break;
	}

	assertType('buildCommand', options.buildCommand, 'string');
	assertType('dev', options.dev, 'boolean');
	assertType('installCommand', options.installCommand, 'string');
	assertType('port', options.port, 'number');
	assertType('securePort', options.securePort, 'number');
	assertType('prebuilt', options.prebuilt, 'boolean');
	assertType('subPath', options.subPath, 'string');

	// Remove leading and trailing slashes from subPath
	if (options.subPath?.[0] === '/') {
		options.subPath = options.subPath.slice(1);
	}
	if (options.subPath?.[options.subPath?.length - 1] === '/') {
		options.subPath = options.subPath.slice(0, -1);
	}

	return {
		buildCommand: options.buildCommand ?? 'npx next build',
		buildOnly: options.buildOnly ?? false,
		dev: options.dev ?? false,
		installCommand: options.installCommand ?? 'npm install',
		port: options.port,
		securePort: options.securePort,
		prebuilt: options.prebuilt ?? false,
		subPath: options.subPath ?? '',
		cache: options.cache ?? false,
	};
}

class NextJSAppVerificationError extends Error {}

const nextJSAppCache = {};

/**
 * This function verifies if the input is a Next.js app through a couple of
 * verification methods. It does not return nor throw anything. It will either
 * succeed (and return the path to the Next.js main file), or log an error to
 * `logger.fatal` and exit the process with exit code 1.
 *
 * Additionally, it memoizes previous verifications.
 *
 * @param {string} componentPath
 * @returns {string} The path to the Next.js main file
 */
function assertNextJSApp(componentPath) {
	try {
		if (nextJSAppCache[componentPath]) {
			return nextJSAppCache[componentPath];
		}

		if (!fs.existsSync(componentPath)) {
			throw new NextJSAppVerificationError(`The folder ${componentPath} does not exist`);
		}

		if (!fs.statSync(componentPath).isDirectory) {
			throw new NextJSAppVerificationError(`The path ${componentPath} is not a folder`);
		}

		// Couple options to check if its a Next.js project
		// 1. Check for Next.js config file (next.config.{js|mjs|ts})
		//    - This file is not required for a Next.js project
		// 2. Check package.json for Next.js dependency
		//    - It could be listed in `dependencies` or `devDependencies` (and maybe even `peerDependencies` or `optionalDependencies`)
		//    - Also not required. Users can use `npx next ...`
		// 3. Check for `.next` folder
		//    - This could be a reasonable fallback if we want to support pre-built Next.js apps

		// A combination of options 1 and 2 should be sufficient for our purposes.
		// Edge case: app does not have a config and are using `npx` (or something similar) to execute Next.js

		// Check for Next.js Config
		const configExists = ['js', 'mjs', 'ts'].some((ext) =>
			fs.existsSync(path.join(componentPath, `next.config.${ext}`))
		);

		// Check for dependency
		let nextJSExists;
		const packageJSONPath = path.join(componentPath, 'package.json');
		if (fs.existsSync(packageJSONPath)) {
			const packageJSON = JSON.parse(fs.readFileSync(packageJSONPath));
			for (let dependencyList of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
				if (packageJSON[dependencyList]?.['next']) {
					nextJSExists = true;
				}
			}
		}

		if (!configExists && !nextJSExists) {
			throw new NextJSAppVerificationError(
				`Could not determine if ${componentPath} is a Next.js project. It is missing both a Next.js config file and the "next" dependency in package.json`
			);
		}

		nextJSAppCache[componentPath] = nextJSExists;

		return nextJSExists;
	} catch (error) {
		if (error instanceof NextJSAppVerificationError) {
			logger.fatal(`Component path is not a Next.js application: `, error.message);
		} else {
			logger.fatal(`Unexpected Error thrown during Next.js Verification: `, error);
		}

		throw error;
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
function executeCommand(commandInput, componentPath) {
	return new Promise((resolve, reject) => {
		const [command, ...args] = shellQuote.parse(commandInput);

		const cp = child_process.spawn(command, args, {
			cwd: componentPath,
			env: {
				...process.env,
				PATH: `${process.env.PATH}:${componentPath}/node_modules/.bin`,
			},
			stdio: logger.log_level === 'debug' ? 'inherit' : 'ignore',
		});

		cp.on('error', (error) => {
			if (error.code === 'ENOENT') {
				logger.fatal(`Command: \`${commandInput}\` not found. Make sure it is included in PATH.`);
			}
			reject(error);
		});

		cp.on('exit', (exitCode) => {
			logger.debug(`Command: \`${commandInput}\` exited with ${exitCode}`);
			resolve(exitCode);
		});
	});
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
export function startOnMainThread(options = {}) {
	const config = resolveConfig(options);

	logger.debug('Next.js Extension Configuration:', JSON.stringify(config, undefined, 2));

	return {
		async setupDirectory(_, componentPath) {
			logger.info(`Next.js Extension is setting up ${componentPath}`);

			assertNextJSApp(componentPath);

			const componentRequire = createRequire(componentPath);

			try {
				componentRequire.resolve('next');
			} catch (error) {
				logger.error(error);
				if (!config.prebuilt) {
					await executeCommand(config.installCommand, componentPath);
					try {
						componentRequire.resolve('next');
					} catch (error) {
						logger.error(error);
						logger.error('Next.js not found after installing dependencies');
					}
				}
			}

			if (!config.prebuilt && !config.dev) {
				await executeCommand(config.buildCommand, componentPath);

				if (config.buildOnly) process.exit(0);
			}

			return true;
		},
	};
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
export function start(options = {}) {
	const config = resolveConfig(options);

	return {
		async handleDirectory(_, componentPath) {
			logger.info(`Next.js Extension is creating Next.js Request Handlers for ${componentPath}`);

			assertNextJSApp(componentPath);

			const componentRequire = createRequire(componentPath);

			const next = (await import(componentRequire.resolve('next'))).default;

			const app = next({ dir: componentPath, dev: config.dev });

			await app.prepare();

			const requestHandler = app.getRequestHandler();

			const servers = options.server.http(
				async (request, nextHandler) => {
					if (config.subPath && !request._nodeRequest.url.startsWith(`/${config.subPath}/`)) {
						return nextHandler(request);
					}
					let nodeRequest = request._nodeRequest;
					nodeRequest.url = config.subPath
						? nodeRequest.url.replace(new RegExp(`^\/${config.subPath}\/`), '/')
						: nodeRequest.url;
					return requestHandler(nodeRequest, request._nodeResponse, url.parse(nodeRequest.url, true));
				},
				{ port: config.port, securePort: config.securePort }
			);

			if (config.dev) {
				const upgradeHandler = app.getUpgradeHandler();
				servers[0].on('upgrade', (req, socket, head) => {
					return upgradeHandler(req, socket, head);
				});
			}

			return true;
		},
	};
}
