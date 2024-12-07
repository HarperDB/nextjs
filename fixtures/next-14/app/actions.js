'use server';

import('harperdb');

export async function listDogs() {
	const dogs = [];
	for await (const dog of tables.Dog.search()) {
		dogs.push({ id: dog.id });
	}
	console.log('dogs', dogs);
	return dogs;
}

export async function getDog(id) {
	return tables.Dog.get(id);
}
