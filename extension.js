import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import child_process from 'node:child_process';
import assert from 'node:assert';
import { setTimeout } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';

import shellQuote from 'shell-quote';

/**
 * @typedef {Object} ExtensionOptions - The configuration options for the extension. These are all configurable via `config.yaml`.
 * @property {string=} buildCommand - A custom build command. Default to `next build`.
 * @property {string=} buildOnly - Build the Next.js app and exit. Defaults to `false`.
 * @property {boolean=} dev - Enable dev mode. Defaults to `false`.
 * @property {number=} port - A port for the Next.js server. Defaults to the HarperDB HTTP Port.
 * @property {boolean=} prebuilt - Instruct the extension to skip executing the `buildCommand`. Defaults to `false`.
 * @property {number=} securePort - A (secure) port for the https Next.js server. Defaults to the HarperDB HTTP Secure Port.
 */

/**
 * Assert that a given option is a specific type, if it is defined.
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
	assertType('buildOnly', options.buildOnly, 'boolean');
	assertType('dev', options.dev, 'boolean');
	assertType('port', options.port, 'number');
	assertType('prebuilt', options.prebuilt, 'boolean');
	assertType('securePort', options.securePort, 'number');

	const config = {
		buildCommand: options.buildCommand ?? 'npx next build',
		buildOnly: options.buildOnly ?? false,
		dev: options.dev ?? false,
		port: options.port,
		prebuilt: options.prebuilt ?? false,
		securePort: options.securePort,
	};

	logger.debug('Next.js Extension Configuration:', JSON.stringify(config, undefined, 2));

	return config;
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
			stdio: ['info', 'debug', 'trace'].includes(logger.log_level) ? 'inherit' : 'ignore',
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
	return {
		setupDirectory(_, componentPath) {
			// Some Next.js apps will include cwd relative operations throughout the application (generally in places like `next.config.js`).
			// So set the cwd to the component path by default.
			process.chdir(componentPath);

			return main(options, componentPath);
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
	return {
		handleDirectory(_, componentPath) {
			return main(options, componentPath);
		},
	};
}

async function main(options, componentPath) {
	// 1. Resolve the extension configuration from the parsed options
	const config = resolveConfig(options);

	logger.info(`Next.js Extension is setting up ${componentPath}`);

	// 2. Assert the component path is a Next.js app. This will throw if it is not.
	assertNextJSApp(componentPath);

	// 3. Setup (build) the component.

	// 3a. Prebuilt mode requires validating the `.next` directory exists
	if (config.prebuilt && !fs.existsSync(path.join(componentPath, '.next'))) {
		logger.fatal('Prebuilt mode is enabled, but the .next folder does not exist');
	}

	// 3b. In non prebuilt or dev modes, build the Next.js app.
	// This only needs to happen once, on a single thread.
	// All threads need to wait for this to complete.
	if (!config.prebuilt && !config.dev) {
		// Theoretically, all threads should have roughly the same start time
		const startTime = Date.now();
		const buildLockPath = path.join(componentPath, '.harperdb-nextjs-build.lock');

		while (true) {
			try {
				// Try opening the lock
				const buildLockFD = fs.openSync(buildLockPath, 'wx');
				// Write the PID to the lock file
				fs.writeSync(buildLockFD, process.pid.toString());
			} catch (error) {
				if (error.code === 'EEXIST') {
					// The lock is already open.

					// Ensure it is not stale
					try {
						if (fs.statSync(buildLockPath).mtimeMs < startTime + 100) {
							// The lock was created before (with a 100ms tolerance) any of the threads started building.
							// Safe to consider it stale and remove it.
							fs.unlinkSync(buildLockPath);
						}
					} catch (error) {
						if (error.code === 'ENOENT') {
							// The lock was removed by another thread.
							continue;
						}

						throw error;
					}

					// Wait for a second and try again
					await setTimeout(1000);
					continue;
				}

				throw error;
			}

			// Lock is opened

			try {
				// Check the modification time of the build id file to see if it is stale
				if (fs.statSync(path.join(componentPath, '.next', 'BUILD_ID')).mtimeMs > startTime) {
					// The build id file was modified after the start time.
					// This means the build is fresh and already complete so exit early.
					fs.unlinkSync(buildLockPath);
					break;
				} else {
					// The build id file is stale. Remove the .next directory and build.
					fs.rmSync(path.join(componentPath, '.next'), { recursive: true });
				}
			} catch (error) {
				// If the build id file does not exist, continue to building
				if (error.code !== 'ENOENT') {
					// All other errors should be thrown
					throw error;
				}
			}

			// Finally, build the Next.js app
			const timerStart = performance.now();
			await executeCommand(config.buildCommand, componentPath);
			const timerStop = performance.now();
			const duration = timerStop - timerStart;
			logger.info(`The build took ${((duration % 60000) / 1000).toFixed(2)} seconds`);

			// Send build time to HDB analytics
			let pathString = componentPath.toString().slice(0, -1);
			const projectDirectoryName = pathString.split('/').pop();
			options.server.recordAnalytics(duration, 'nextjs_build_time_in_milliseconds', projectDirectoryName);

			// Release the lock and exit the loop
			fs.unlinkSync(buildLockPath);
			break;
		}
	}

	// 4. If buildOnly is enabled, exit early
	if (config.buildOnly) {
		logger.info('HarperDB Next.js Extension Build Only mode is enabled. Exiting.');
		return true;
	}

	// 5. Start the Next.js server
	const componentRequire = createRequire(componentPath);

	const next = (await import(componentRequire.resolve('next'))).default;

	const app = next({ dir: componentPath, dev: config.dev });

	await app.prepare();

	const requestHandler = app.getRequestHandler();

	const servers = options.server.http(
		(request) => requestHandler(request._nodeRequest, request._nodeResponse, url.parse(nodeRequest.url, true)),
		{ port: config.port, securePort: config.securePort }
	);

	if (config.dev) {
		const upgradeHandler = app.getUpgradeHandler();
		servers[0].on('upgrade', (req, socket, head) => {
			return upgradeHandler(req, socket, head);
		});
	}

	return true;
}
