import Dog from '../../components/Dog';

export default async function SSRDog({ params }) {
	return <Dog id={params.id} />;
}
