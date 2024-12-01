export const base = [
	{
		name: "should enable /Dog rest endpoint",
		testFunction: async (t, ctx) => {
			const response = await fetch(`${ctx.rest}/Dog/0`, {
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Basic aGRiX2FkbWluOnBhc3N3b3Jk',
				},
			});
			const json = await response.json();
	
			t.assert.deepStrictEqual(json, { id: '0', name: 'Lincoln', breed: 'Shepherd' });
		}
	}
]

export const next15 = [
	{
		name: 'should render home page',
		testFunction: async (t, ctx) => {
			const response = await fetch(`${ctx.rest}/`, {
				headers: {
					'Content-Type': 'text/html',
				}
			});
	
			const text = await response.text();
			t.assert.match(text, /Next\.js v15/);
		}
	}
];