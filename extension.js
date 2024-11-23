import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import child_process from 'node:child_process';
import assert from 'node:assert';

import shellQuote from 'shell-quote';

/**
 * @typedef {Object} ExtensionOptions - The configuration options for the extension. These are all configurable via `config.yaml`.
 * @property {string=} buildCommand - A custom build command. Default to `next build`.
 * @property {string=} buildOnly - Build the Next.js app and exit. Defaults to `false`.
 * @property {boolean=} dev - Enable dev mode. Defaults to `false`.
 * @property {string=} installCommand - A custom install command. Defaults to `npm install`.
 * @property {boolean=} monorepo - Enable monorepo mode. Defaults to `false`.
 * @property {number=} port - A port for the Next.js server. Defaults to `3000`.
 * @property {boolean=} prebuilt - Instruct the extension to skip executing the `buildCommand`. Defaults to `false`.
 */

// Memoized Configuration
let CONFIG;

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
	if (CONFIG) return CONFIG; // return memoized config

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
	assertType('monorepo', options.monorepo, 'boolean');
	assertType('port', options.port, 'number');
	assertType('prebuilt', options.prebuilt, 'boolean');

	// Memoize config resolution
	return (CONFIG = {
		buildCommand: options.buildCommand ?? 'next build',
		buildOnly: options.buildOnly ?? false,
		dev: options.dev ?? false,
		installCommand: options.installCommand ?? 'npm install',
		monorepo: options.monorepo ?? false,
		port: options.port ?? 3000,
		prebuilt: options.prebuilt ?? false,
	});
}

class NextJSAppVerificationError extends Error {}

const nextJSAppCache = {};

function getNextJSMainField(nextJSPackageJSONPath) {
	// If the Next.js dependency package.json exists, read it and look for `main` property
	// Okay with throwing here, as we expect the package.json to be valid
	const nextJSPackageJSON = JSON.parse(fs.readFileSync(nextJSPackageJSONPath));

	// validate
	if (!nextJSPackageJSON.main) {
		throw new Error(`Next.js package.json at ${nextJSPackageJSONPath} does not have a main field`);
	}

	if (typeof nextJSPackageJSON.main !== 'string') {
		throw new Error(`Next.js package.json at ${nextJSPackageJSONPath} has a non-string main field`);
	}

	// return the contents of the main field
	return path.join(path.dirname(nextJSPackageJSONPath), nextJSPackageJSON.main);
}

function findNextJSDependency(componentPath) {
	// In either a regular project or a monorepo first check if the project has a direct dependency on Next.js
	// Let this throw if read file fails for any reason. The project should have a package.json
	let packageJSONPath = path.join(componentPath, 'package.json');
	let packageJSON = JSON.parse(fs.readFileSync(packageJSONPath));

	for (let dependencyList of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
		if (packageJSON[dependencyList]?.['next']) {
			// First, try and see if the next package is within the node_modules folder of the current path.
			// In a regular project this is what is expected.
			// In a monorepo, it may or may not be here, so don't throw if it's not found.
			let nextJSPackageJSONPath = path.join(componentPath, 'node_modules', 'next', 'package.json');

			if (fs.existsSync(nextJSPackageJSONPath)) {
				return getNextJSMainField(nextJSPackageJSONPath);
			} else {
				// If the Next.js package.json does not exist in the current path, find the closest parent package.json and try again.
				while (!fs.existsSync((packageJSONPath = path.join(path.dirname(packageJSONPath), '..', 'package.json'))));
				{
					if (packageJSONPath === '/') {
						throw new Error('No parent package.json found. Are you sure this is a monorepo?');
					}
				}

				nextJSPackageJSONPath = path.join(path.dirname(packageJSONPath), 'node_modules', 'next', 'package.json');

				if (fs.existsSync(nextJSPackageJSONPath)) {
					return getNextJSMainField(nextJSPackageJSONPath);
				} else {
					throw new Error(`Next.js package.json not found in ${componentPath} or its parent directories`);
				}
			}
		}
	}
}

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
		const configExists =
			fs.existsSync(path.join(componentPath, 'next.config.js')) ||
			fs.existsSync(path.join(componentPath, 'next.config.mjs')) ||
			fs.existsSync(path.join(componentPath, 'next.config.ts'));

		// Check for dependency
		const nextJSPath = findNextJSDependency(componentPath);

		if (!configExists && !nextJSPath) {
			throw new NextJSAppVerificationError(
				`Could not determine if ${componentPath} is a Next.js project. It is missing both a Next.js config file and the "next" dependency in package.json`
			);
		}

		nextJSAppCache[componentPath] = nextJSPath;

		return nextJSPath;
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
function executeCommand(commandInput, componentPath) {
	return new Promise((resolve, reject) => {
		const [command, ...args] = shellQuote.parse(commandInput);

		const cp = child_process.spawn(command, args, {
			cwd: componentPath,
			env: { ...process.env, PATH: `${process.env.PATH}:${componentPath}/node_modules/.bin` },
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

function getMonorepoRootPath(componentPath) {
	let packageJSONPath = path.join(componentPath, 'package.json');
	while (!fs.existsSync((packageJSONPath = path.join(path.dirname(packageJSONPath), '..', 'package.json'))));
	{
		if (packageJSONPath === '/') {
			throw new Error('No parent package.json found. Are you sure this is a monorepo?');
		}
	}

	return path.dirname(packageJSONPath);
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

			const rootPath = config.monorepo ? getMonorepoRootPath(componentPath) : componentPath;

			// TODO: Find a way to simplify assertNextJSApp using rootPath
			assertNextJSApp(componentPath);

			if (!fs.existsSync(path.join(rootPath, 'node_modules'))) {
				await executeCommand(config.installCommand, rootPath);
			}

			if (!config.prebuilt && !config.dev) {
				await executeCommand(config.buildCommand, rootPath);

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

			const nextJSMainPath = assertNextJSApp(componentPath);

			const next = (await import(nextJSMainPath)).default;

			const app = next({ dir: componentPath, dev: config.dev });

			await app.prepare();

			const requestHandler = app.getRequestHandler();

			const servers = options.server.http(
				(request) => {
					return requestHandler(request._nodeRequest, request._nodeResponse, url.parse(request._nodeRequest.url, true));
				},
				{ port: config.port }
			);

			if (config.dev) {
				const upgradeHandler = app.getUpgradeHandler();
				servers[0].on('upgrade', (req, socket, head) => {
					return upgradeHandler(req, socket, head);
				});
			}

			logger.info(`Next.js App available on localhost:${config.port}`);

			return true;
		},
	};
}
