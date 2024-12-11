import { test, expect } from '@playwright/test';

const baseURL = 'http://localhost:9926';

test('home page', async ({ page }) => {
	await page.goto(baseURL);
	await expect(page.locator('h1')).toHaveText('Next.js v9');
});

test('title', async ({ page }) => {
	await page.goto(baseURL);
	await expect(page).toHaveTitle('HarperDB - Next.js v9 App');
});

test('page 2', async ({ page }) => {
	await page.goto(baseURL);
	await page.locator('a').click();
	await expect(page.locator('h1')).toHaveText('Page 2');
});
