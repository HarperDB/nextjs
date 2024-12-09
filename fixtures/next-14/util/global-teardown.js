const { spawn } = require('node:child_process');

module.exports = function globalTeardown(config) {
	return new Promise((resolve, reject) => {
		const harperdbProcess = spawn('npx', ['harperdb', 'stop']);
		harperdbProcess.on('error', reject);
		harperdbProcess.on('exit', resolve);
	});
}