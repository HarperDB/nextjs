import Dog from '../../components/Dog';
import { listDogs } from '../../actions';

export const revalidate = 10;

export default async function ISRDog({ params }) {
	return <Dog id={params.id} />;
}

export function generateStaticParams() {
	return listDogs();
}
