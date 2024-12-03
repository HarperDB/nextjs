import { defineConfig, devices } from '@playwright/test';

const NEXT_MAJORS = ['13', '14', '15'];
const NODE_MAJORS = ['18', '20', '22'];

export default defineConfig({
	testDir: 'test',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	workers: 3,
	retries: 2,
	expect: {
		timeout: 30000,
	},
	projects: NEXT_MAJORS.flatMap((nextMajor) =>
		NODE_MAJORS.map((nodeMajor) => ({
			name: `Next.js v${nextMajor} - Node.js v${nodeMajor}`,
			use: { versions: { nextMajor, nodeMajor }, ...devices['Desktop Chrome'] },
			testMatch: [`test/next-${nextMajor}.test.js`],
		}))
	),
});
