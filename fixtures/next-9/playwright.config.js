const { defineConfig, devices } = require('@playwright/test');
const { join } = require('node:path');

module.exports = defineConfig({
	testDir: 'test',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	projects: [
		{
			use: { ...devices['Desktop Chrome'] },
		}
	],
	globalSetup: join(__dirname, './util/global-setup.js'),
	globalTeardown: join(__dirname, './util/global-teardown.js'),
});
