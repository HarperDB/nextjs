const dogs = [
	{ id: '0', name: 'Lincoln', breed: 'Shepherd' },
	{ id: '1', name: 'Max', breed: 'Cocker Spaniel' },
	{ id: '2', name: 'Bella', breed: 'Lab' },
	{ id: '3', name: 'Charlie', breed: 'Great Dane' },
	{ id: '4', name: 'Lucy', breed: 'Newfoundland' },
	{ id: '5', name: 'Cooper', breed: 'Pug' },
	{ id: '6', name: 'Daisy', breed: 'Bull Dog' },
	{ id: '7', name: 'Rocky', breed: 'Akita' },
	{ id: '8', name: 'Luna', breed: 'Wolf' },
	{ id: '9', name: 'Buddy', breed: 'Border Collie' },
	{ id: '10', name: 'Bailey', breed: 'Golden Retriever' },
	{ id: '11', name: 'Sadie', breed: 'Belgian Malinois' },
];

for (const dog of dogs) {
	tables.Dog.put(dog);
}
