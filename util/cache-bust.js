import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { readdirSync } from 'node:fs';

import { ROOT } from './constants-and-names.js';

export function getCacheBustValue(files) {
	return new Promise((resolve, reject) => {
		const proc = spawn('git', ['status', '--porcelain', ...files], { cwd: ROOT });

		proc.on('error', reject);

		const hash = createHash('sha1');

		pipeline(proc.stdout, hash)
			.then(() => resolve(hash.digest('hex')))
			.catch(reject);
	});
}

export const MODULE_CACHE_BUST = getCacheBustValue([
	'config.yaml',
	'cli.js',
	'extension.js',
	'package.json',
]);

export function getNextFixtureCacheBustValue(nextMajor) {
	return getCacheBustValue(readdirSync(join(ROOT, 'fixtures', `next-${nextMajor}`)));
}
