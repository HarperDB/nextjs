import { suite, test, before, after } from 'node:test';
import { Fixture } from '../util/fixture.js';

suite('Next.js v15 - Node.js v20', async () => {
	const ctx = {};

	before(async () => {
		ctx.fixture = new Fixture({ nextMajor: '15', nodeMajor: '20' });
		await ctx.fixture.ready;
		ctx.rest = `http://${ctx.fixture.portMap.get('9926')}`;
	});

	await test('should run base component', async (t) => {
		const response = await fetch(`${ctx.rest}/Dog/0`, {
			headers: {
				'Content-Type': 'application/json',
				'Authorization': 'Basic aGRiX2FkbWluOnBhc3N3b3Jk',
			},
		});
		const json = await response.json();

		t.assert.deepStrictEqual(json, { id: '0', name: 'Lincoln', breed: 'Shepherd' });
	});

	await test('should reach home page', async (t) => {
		const response = await fetch(`${ctx.rest}/`, {
			headers: {
				'Content-Type': 'text/html',
			}
		});

		const text = await response.text();
		t.assert.match(text, /Next\.js v15/);
	});

	after(async () => {
		await ctx.fixture.clear();
	});
});
