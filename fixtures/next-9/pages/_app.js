import Head from 'next/head';

export default function App({ Component, pageProps }) {
	return (
		<>
			<Head>
				<title>HarperDB - Next.js v9 App</title>
			</Head>
			<Component {...pageProps} />
		</>
	);
}
