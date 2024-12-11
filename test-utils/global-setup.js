const { spawn, execSync, exec } = require('node:child_process');
const { Transform } = require('node:stream');
const { join } = require('node:path');
const { symlinkSync } = require('node:fs');
const { setTimeout } = require('node:timers/promises');

const ROOT = join(__dirname, '..');

function getComponents() {
	const componentsString = execSync(`npx harperdb get_components json=true`, { encoding: 'utf-8' });
	return JSON.parse(componentsString);
}

function getConfiguration() {
	const configurationString = execSync(`npx harperdb get_configuration json=true`, { encoding: 'utf-8' });
	return JSON.parse(configurationString);
}

module.exports = async function globalSetup(config) {
	execSync('npx harperdb start', { stdio: 'inherit' });
	await setTimeout(2000);

	const components = getComponents();
	if (!components.entries.some(({ name }) => name === 'harperdb-base-component')) {
		const configuration = getConfiguration();
		const componentsRoot = configuration.componentsRoot;

		symlinkSync(join(ROOT, 'fixtures', 'harperdb-base-component'), join(componentsRoot, 'harperdb-base-component'));

		execSync(`npx harperdb restart`);

		await setTimeout(5000);
	}

	execSync('npx harperdb stop', { stdio: 'inherit' });

	await new Promise((resolve, reject) => {
		console.log('npx harperdb run', config.rootDir);
		const harperdbProcess = spawn('npx', ['harperdb', 'run', config.rootDir]);
	
		harperdbProcess.on('error', reject);
		harperdbProcess.on('exit', resolve);
	
		harperdbProcess.stdout.pipe(new Transform({
			transform(chunk, encoding, callback) {
				if (/HarperDB \d+.\d+.\d+ successfully started/.test(chunk.toString())) {
					resolve();
				}
				callback(null, chunk);
			}
		})).pipe(process.stdout);
	});
}