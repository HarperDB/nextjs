import { VERSION_MATRIX, NODE_MAJORS } from '../constants-and-names.js';
import { buildNodeImage, buildNextImage } from '../build-fixture.js';

// Build Node.js Base Images
for (const nodeMajor of NODE_MAJORS) {
	await buildNodeImage(nodeMajor);
}

// Build Next.js Images
for (const [nextMajor, nodeMajor] of VERSION_MATRIX) {
	await buildNextImage(nextMajor, nodeMajor);
}
