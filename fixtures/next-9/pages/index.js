import Link from 'next/link';

export default function Index() {
	return (
		<div>
			<h1>Next.js v9</h1>
			<img src='/static/hdb-logo.png' alt='HarperDB Logo' />
			<Link href="/page-2">Page 2</Link>
		</div>
	);
}
