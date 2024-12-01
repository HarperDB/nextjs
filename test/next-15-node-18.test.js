import { suite, test, before, after } from 'node:test';
import { base, next15 } from '../util/tests.js';
import { Fixture } from '../util/fixture.js';

suite('Next.js v15 - Node.js v18', async () => {
	const ctx = {};

	before(async () => {
		ctx.fixture = new Fixture({ nextMajor: '15', nodeMajor: '18' });
		await ctx.fixture.ready;
		ctx.rest = new URL(`http://${ctx.fixture.portMap.get('9926')}`);
	});

	await Promise.all(base.concat(next15).map(async ({ name, testFunction }) => test(name, t => testFunction(t, ctx))));

	after(async () => {
		await ctx.fixture.clear();
	});
});
