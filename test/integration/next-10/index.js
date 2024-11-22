import http from 'http';

const server = http.createServer((req, res) => {
	res.statusCode = 200;
	res.setHeader('Content-Type', 'text/plain');
	res.end('Next.js v10');
});

const PORT = 3000;
server.listen(PORT, () => {
	console.log(`Server running at http://localhost:${PORT}/`);
});
