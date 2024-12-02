import { Transform } from 'node:stream';

export class CollectedTransform extends Transform {
	#chunks = [];

	_transform(chunk, _, callback) {
		this.#chunks.push(chunk);
		callback(null, chunk);
	}

	get output() {
		return Buffer.concat(this.#chunks).toString();
	}
}
