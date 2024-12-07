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

test.describe('caching', () => {
	test('isr', async ({ nextApp, page }) => {
		const url = `${nextApp.rest}/ssg-dogs/0`;

		let response = await page.goto(url);
		expect(response.status()).toBe(200);
		await expect(page.locator('h1')).toHaveText('Lincoln');

		let headers = response.headers();
		expect(headers['x-nextjs-cache']).toBe('STALE');
		expect(headers['cache-control']).toBe('s-maxage=10, stale-while-revalidate');

		response = await page.goto(url);
		expect(response.status()).toBe(304);
		await expect(page.locator('h1')).toHaveText('Lincoln');

		headers = response.headers();
		expect(headers['x-nextjs-cache']).toBe('HIT');
		expect(headers['cache-control']).toBe('s-maxage=10, stale-while-revalidate');
	});

	test('ssg', async ({ nextApp, page }) => {
		const url = `${nextApp.rest}/ssg-dogs/0`;

		let response = await page.goto(url);
		expect(response.status()).toBe(200);
		await expect(page.locator('h1')).toHaveText('Lincoln');

		let headers = response.headers();
		expect(headers['x-nextjs-cache']).toBe('HIT');
		expect(headers['cache-control']).toBe('s-maxage=31536000, stale-while-revalidate');

		response = await page.goto(url);
		expect(response.status()).toBe(304);
		await expect(page.locator('h1')).toHaveText('Lincoln');

		headers = response.headers();
		expect(headers['x-nextjs-cache']).toBe('HIT');
		expect(headers['cache-control']).toBe('s-maxage=10, stale-while-revalidate');
	});

	test('ssr', async ({ nextApp, page }) => {
		const url = `${nextApp.rest}/ssr-dogs/0`;

		let response = await page.goto(url);
		expect(response.status()).toBe(200);
		await expect(page.locator('h1')).toHaveText('Lincoln');

		let headers = response.headers();
		expect(headers['cache-control']).toBe('private, no-cache, no-store, max-age=0, must-revalidate');

		response = await page.goto(url);
		expect(response.status()).toBe(200);
		await expect(page.locator('h1')).toHaveText('Lincoln');

		headers = response.headers();
		expect(headers['cache-control']).toBe('private, no-cache, no-store, max-age=0, must-revalidate');
	});
});
