import { defineConfig, devices } from '@playwright/test';
import { VERSION_MATRIX } from './util/constants-and-names';

export default defineConfig({
	testDir: 'test',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	workers: 3,
	retries: 2,
	expect: {
		timeout: 30000,
	},
	projects: [
		...VERSION_MATRIX.map(([nextMajor, nodeMajor]) => ({
			name: `Next.js v${nextMajor} - Node.js v${nodeMajor}`,
			use: { versions: { nextMajor, nodeMajor }, ...devices['Desktop Chrome'] },
			testMatch: [`test/next-${nextMajor}.test.js`],
			dependencies: ['setup'],
		})),
	],
});
