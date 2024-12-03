export const metadata = {
	title: 'HarperDB - Next.js v15 App',
};

export default function RootLayout({ children }) {
	return (
		<html>
			<body>{children}</body>
		</html>
	);
}
