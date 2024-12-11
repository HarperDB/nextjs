const required = '16';
const current = process.version.slice(1).split('.')[0];

if (current !== required) {
	console.error(`Error: Node version ${required} is required, but you're running version ${current}`);
	process.exit(1);
}
