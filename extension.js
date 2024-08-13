import fs from 'node:fs';
import path from 'node:path';
import next from 'next';
// TODO: this doesn't seem to support ESM?
import build from 'next/dist/build/index.js';
import semver from 'semver';
import url from 'node:url';

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

export async function startOnMainThread () {
    console.log('Next.js Extension - startOnMainThread');
    try {
        isNextJSApp(process.env.RUN_HDB_APP);
    } catch (error) {
        if (error instanceof Error) {
            console.error(`Component path is not a Next.js application: `, error.message);
        }
    }

    // TODO: This seems to be failing. Probably missing some config options. Check how `next build` calls this and make sure to do the same here
    await build.default(process.env.RUN_HDB_APP);
}

export function start (options) {
    console.log('Next.js Extension - Start');
    try {
        isNextJSApp(process.env.RUN_HDB_APP);
    } catch (error) {
        if (error instanceof Error) {
            console.error(`Component path is not a Next.js application: `, error.message);
        }
    }

    const app = next({ dir: process.env.RUN_HDB_APP });
    // TODO: Dig Deep on this part
    const handle = app.getRequestHandler();
    options.server.http((request) => {
        return handle(
            request._nodeRequest,
            request._nodeResponse,
            url.parse(request._nodeRequest.url, true)
        )
    })
}