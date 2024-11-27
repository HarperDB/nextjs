import { suite, test, before, after } from 'node:test';
import { Fixture } from './util.js';

suite('Next.js v15 - Node.js v18', async () => {
	const ctx = {};

	before(async () => {
		ctx.fixture = new Fixture({ nextMajor: '15', nodeMajor: '18' });
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

	after(async () => {
		await ctx.fixture.clear();
	});
});
