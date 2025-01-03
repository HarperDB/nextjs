/* eslint-env node */
/* global logger */

import { existsSync, statSync, readFileSync, openSync, writeSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { parse as urlParse } from 'node:url';
import { spawnSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { tmpdir } from 'node:os';

import shellQuote from 'shell-quote';

class HarperDBNextJSExtensionError extends Error {}

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
	if (option && typeof option !== expectedType) {
		throw new HarperDBNextJSExtensionError(`${name} must be type ${expectedType}. Received: ${typeof option}`);
	}
}

/**
 * Resolves the incoming extension options into a config for use throughout the extension.
 *
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

	logger.debug('@harperdb/nextjs extension configuration:\n' + JSON.stringify(config, undefined, 2));

	return config;
}

/**
 * This function verifies if the input is a Next.js app through a couple of
 * verification methods. See the implementation for details.
 *
 * @param {string} componentPath
 * @returns {string} The path to the Next.js main file
 */
function assertNextJSApp(componentPath) {
	logger.debug(`Verifying ${componentPath} is a Next.js application`);

	try {
		if (!existsSync(componentPath)) {
			throw new HarperDBNextJSExtensionError(`The folder ${componentPath} does not exist`);
		}

		if (!statSync(componentPath).isDirectory) {
			throw new HarperDBNextJSExtensionError(`The path ${componentPath} is not a folder`);
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
		const configExists = ['js', 'mjs', 'ts'].some((ext) => existsSync(join(componentPath, `next.config.${ext}`)));

		// Check for dependency
		let dependencyExists = false;
		const packageJSONPath = join(componentPath, 'package.json');
		if (existsSync(packageJSONPath)) {
			const packageJSON = JSON.parse(readFileSync(packageJSONPath));
			for (let dependencyList of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
				if (packageJSON[dependencyList]?.['next']) {
					dependencyExists = true;
				}
			}
		}

		if (!configExists && !dependencyExists) {
			throw new HarperDBNextJSExtensionError(
				`Could not determine if ${componentPath} is a Next.js project. It is missing both a Next.js config file and the "next" dependency in package.json`
			);
		}
	} catch (error) {
		if (error instanceof HarperDBNextJSExtensionError) {
			logger.fatal(`Component path is not a Next.js application: ` + error.message);
		} else {
			logger.fatal(`Unexpected Error thrown during Next.js Verification: ` + error.toString());
		}

		throw error;
	}
}

/**
 *
 * @param {ExtensionOptions} options
 * @returns
 */
export function startOnMainThread(options = {}) {
	const config = resolveConfig(options);

	return {
		async setupDirectory(_, componentPath) {
			assertNextJSApp(componentPath);

			// Some Next.js apps will include cwd relative operations throughout the application (generally in places like `next.config.js`).
			// So set the cwd to the component path by default.
			process.chdir(componentPath);

			if (config.buildOnly) {
				await build(config, componentPath, options.server);
				logger.info('@harperdb/nextjs extension build only mode is enabled, exiting');
				process.exit(0);
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
			// Assert the component path is a Next.js app. This will throw if it is not.
			assertNextJSApp(componentPath);

			// Setup (build) the component.

			// Prebuilt mode requires validating the `.next` directory exists
			if (config.prebuilt && !existsSync(join(componentPath, '.next'))) {
				throw new HarperDBNextJSExtensionError('Prebuilt mode is enabled, but the .next folder does not exist');
			}

			// In non prebuilt or dev modes, build the Next.js app.
			// This only needs to happen once, on a single thread.
			// All threads need to wait for this to complete.
			if (!config.prebuilt && !config.dev) {
				await build(config, componentPath, options.server);
			}

			// Start the Next.js server
			await serve(config, componentPath, options.server);

			return true;
		},
	};
}

/**
 * Build the Next.js application located at `componentPath`.
 * Uses a lock file to ensure only one thread builds the application.
 *
 * @param {Required<ExtensionOptions>} config
 * @param {string} componentPath
 * @param {unknown} server
 */
async function build(config, componentPath, server) {
	// Theoretically, all threads should have roughly the same start time
	const startTime = Date.now();
	const buildLockPath = join(tmpdir(), '.harperdb-nextjs-build.lock');

	while (true) {
		try {
			// Open lock
			const buildLockFD = openSync(buildLockPath, 'wx');
			writeSync(buildLockFD, process.pid.toString());
		} catch (error) {
			if (error.code === 'EEXIST') {
				try {
					// Check if the lock is stale
					if (statSync(buildLockPath).mtimeMs < startTime - 100) {
						// The lock was created before (with a 100ms tolerance) any of the threads started building.
						// Safe to consider it stale and remove it.
						unlinkSync(buildLockPath);
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

		try {
			// Check if the .next/BUILD_ID file is fresh
			if (statSync(join(componentPath, '.next', 'BUILD_ID')).mtimeMs > startTime) {
				unlinkSync(buildLockPath);
				break;
			}
		} catch (error) {
			// If the build id file does not exist, continue to building
			if (error.code !== 'ENOENT') {
				// All other errors should be thrown
				throw error;
			}
		}

		// Build
		const [command, ...args] = shellQuote.parse(config.buildCommand);

		const timerStart = performance.now();

		const { stdout, stderr, status, error } = spawnSync(command, args, {
			cwd: componentPath,
			encoding: 'utf-8',
		});

		if (status === 0) {
			if (stdout) logger.info(stdout);
			const duration = performance.now() - timerStart;
			logger.info(`The Next.js build took ${((duration % 60000) / 1000).toFixed(2)} seconds`);
			server.recordAnalytics(
				duration,
				'nextjs_build_time_in_milliseconds',
				componentPath.toString().slice(0, -1).split('/').pop()
			);
		} else {
			if (stderr) logger.error(stderr);
			if (error) logger.error(error);
		}

		// Release lock and exit
		unlinkSync(buildLockPath);
		break;
	}
}

/**
 * Serve the Next.js application located at `componentPath`.
 * The app must be built before calling this function.
 *
 * @param {Required<ExtensionOptions>} config
 * @param {string} componentPath
 */
async function serve(config, componentPath, server) {
	const componentRequire = createRequire(componentPath);

	const next = (await import(componentRequire.resolve('next'))).default;

	const app = next({ dir: componentPath, dev: config.dev });

	await app.prepare();

	const requestHandler = app.getRequestHandler();

	const servers = server.http(
		(request, next) => {
			return request._nodeResponse === undefined
				? next(request)
				: requestHandler(request._nodeRequest, request._nodeResponse, urlParse(request._nodeRequest.url, true));
		},
		{ port: config.port, securePort: config.securePort }
	);

	// Next.js v9 doesn't have an upgrade handler
	if (config.dev && app.getUpgradeHandler) {
		const upgradeHandler = app.getUpgradeHandler();
		servers[0].on('upgrade', (req, socket, head) => {
			if (req.url !== '/_next/webpack-hmr') {
				return upgradeHandler(req, socket, head);
			}
		});
	}
}
