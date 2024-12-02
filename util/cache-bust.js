import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { join } from 'path';
import { pipeline } from 'stream/promises';

export function getCacheBustValue() {
	return new Promise((resolve, reject) => {
		const proc = spawn('git', ['status', '--porcelain'], { cwd: join(import.meta.dirname, '..') })
		proc.on('error', reject);
		const hash = createHash('sha1');
		pipeline(proc.stdout, hash).then(() => resolve(hash.digest('hex'))).catch(reject);
	});
}

export const CACHE_BUST = getCacheBustValue();
