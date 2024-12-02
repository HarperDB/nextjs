import { test, expect } from '../util/test-fixture.js';

test.describe.configure({ mode: 'serial' });

test('home page', async ({ nextApp, page }) => {
	await page.goto(nextApp.rest.toString());
	await expect(page.locator('h1')).toHaveText('Next.js v14');
});

test('title', async ({ nextApp, page }) => {
	await page.goto(nextApp.rest.toString());
	await expect(page).toHaveTitle('HarperDB - Next.js v14 App');
});
