import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import child_process from 'node:child_process';

const fixtures_path = path.join(import.meta.dirname, 'fixtures');
const nextjs_app_path = path.join(fixtures_path, 'nextjs_app');

describe("nextjs_app integration test", () => {
	let dir;
	let hdb;
	before(async () => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hdb-nextjs-extension-'));
		fs.cpSync(nextjs_app_path, dir, { recursive: true });

		hdb = child_process.spawn('npx', ['harperdb', 'run', dir], {
			cwd: dir,
			stdio: 'ignore'
		});
	});

	after(async () => {
		hdb.kill();
	});

	it('should build and serve the Next.js app', () => {

	});
});
