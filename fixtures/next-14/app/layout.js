export const metadata = {
	title: 'HarperDB - Next.js v14 App',
};

export default function RootLayout({ children }) {
	return (
		<html>
			<body>{children}</body>
		</html>
	);
}
