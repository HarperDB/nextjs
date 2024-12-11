const dogs = [
	{ id: '0', name: 'Lincoln', breed: 'Shepherd' },
	{ id: '1', name: 'Max', breed: 'Cocker Spaniel' },
	{ id: '2', name: 'Bella', breed: 'Lab' },
	{ id: '3', name: 'Charlie', breed: 'Great Dane' },
	{ id: '4', name: 'Lucy', breed: 'Newfoundland' },
];

for (const dog of dogs) {
	tables.Dog.put(dog);
}
