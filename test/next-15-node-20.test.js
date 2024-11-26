import { suite, test, before, after } from 'node:test';
import { deepStrictEqual } from 'node:assert';
import { once } from 'node:events';
import { Fixture } from './util.js';

suite('Next.js v15 - Node.js v20', (t) => {
	before(async () => {
		t.fixture = new Fixture({ nextMajor: 15, nodeMajor: 20 });

		await once(t.fixture, 'ready');
	});

	test('should run base component', async (t) => {
		const response = await fetch('http://localhost:9926/Dog/0', {
			headers: {
				'Content-Type': 'application/json',
				'Authorization': 'Basic aGRiX2FkbWluOnBhc3N3b3Jk',
			},
		});
		const json = await response.json();

		deepStrictEqual(json, { id: '0', name: 'Lincoln', breed: 'Shepherd' });
	});

	after(() => {
		t.fixture.cleanup();
	});
});
