const { spawn } = require('node:child_process');
const { Transform } = require('node:stream');
const { join } = require('node:path');

module.exports = function globalSetup(config) {
	return new Promise((resolve, reject) => {
		const harperdbProcess = spawn('npx', ['harperdb', 'run', join(__dirname, '..')]);

		harperdbProcess.on('error', reject);
		harperdbProcess.on('exit', resolve);

		harperdbProcess.stdout.pipe(new Transform({
			transform(chunk, encoding, callback) {
				const data = chunk.toString();
				if (/HarperDB \d+.\d+.\d+ successfully started/.test(data)) {
					resolve();
				}
				callback(null, chunk);
			}
		})).pipe(process.stdout);
	});
}