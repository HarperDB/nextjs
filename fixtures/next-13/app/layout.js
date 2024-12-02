export const metadata = {
	title: 'HarperDB - Next.js v13 App',
};

export default function RootLayout({ children }) {
	return (
		<html>
			<body>{children}</body>
		</html>
	);
}
