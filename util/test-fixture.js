import { test as base } from '@playwright/test';

import { Fixture } from './fixture';

export const test = base.extend({
	versions: [
		{ nextMajor: '', nodeMajor: '' },
		{ option: true, scope: 'worker' },
	],
	nextApp: [
		async ({ versions: { nextMajor, nodeMajor } }, use) => {
			const fixture = new Fixture({ nextMajor, nodeMajor });
			await fixture.ready;

			const rest = fixture.portMap.get('9926');

			if (!rest) {
				throw new Error('Rest port not found');
			}

			await use({ rest: `http://${rest}` });

			await fixture.clear();
		},
		{ scope: 'worker', timeout: 60000 },
	],
});

export { expect } from '@playwright/test';
