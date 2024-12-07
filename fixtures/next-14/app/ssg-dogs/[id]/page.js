import Dog from '../../components/Dog';
import { listDogs } from '../../actions';

// No revalidation. This page renders based on the list of dogs returned by generateStaticParams.
export default async function SSGDog({ params }) {
	return <Dog id={params.id} />;
}

export function generateStaticParams() {
	return listDogs();
}
