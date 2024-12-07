import { getDog } from '../actions';
import { notFound } from 'next/navigation';

export default async function Dog({ id }) {
	const dog = await getDog(id);

	return dog ? (
		<div>
			<h1>{dog.name}</h1>
			<p>{dog.breed}</p>
			<p>Woof!</p>
		</div>
	) : (
		notFound()
	);
}
