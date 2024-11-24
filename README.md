# @harperdb/nextjs

A [HarperDB Component](https://docs.harperdb.io/docs/developers/components) for running and developing Next.js apps.

![NPM Version](https://img.shields.io/npm/v/%40harperdb%2Fnextjs)

Most Next.js features are supported as we rely on the Next.js Server provided by Next.js to run your application.

> [!TIP]
> Watch a walkthrough of this component in action here: [Next.js on HarperDB | Step-by-Step Guide for Next Level Next.js Performance](https://youtu.be/GqLEwteFJYY)

## Usage

> [!NOTE]
> This guide assumes you're already familiar with [HarperDb Components](https://docs.harperdb.io/docs/developers/components). Please review the documentation, or check out the HarperDB [Next.js Example](https://github.com/HarperDB/nextjs-example) for more information.

1. Install:

```sh
npm install @harperdb/nextjs
```

2. Add to `config.yaml`:

```yaml
'@harperdb/nextjs':
  package: '@harperdb/nextjs'
  files: '/*'
```

3. Run your app with HarperDB:

```sh
harperdb run nextjs-app
```

Alternatively, you can use the included `harperdb-nextjs` CLI:

```sh
harperdb-nextjs build | dev | start
```

4. Within any server side code paths, you can use [HarperDB Globals](https://docs.harperdb.io/docs/technical-details/reference/globals) after importing the HarperDB package:

```js
// app/actions.js
'use server';

import('harperdb');

export async function listDogs() {
	const dogs = [];
	for await (const dog of tables.Dog.search()) {
		dogs.push({ id: dog.id, name: dog.name });
	}
	return dogs;
}

export async function getDog(id) {
	return tables.Dog.get(id);
}
```

```js
// app/dogs/[id]/page.jsx
import { getDog, listDogs } from '@/app/actions';

export async function generateStaticParams() {
	const dogs = await listDogs();

	return dogs;
}

export default async function Dog({ params }) {
	const dog = await getDog(params.id);

	return (
		<section>
			<h1>{dog.name}</h1>
			<p>Breed: {dog.get('breed')}</p>
			<p>Woof!</p>
		</section>
	);
}
```

## Options

> All configuration options are optional

### `buildCommand: string`

Specify a custom build command. Defaults to `next build`.

> Note: the extension will skip building if the `prebuilt` option is set to `true`

### `buildOnly: boolean`

Build the Next.js application and then exit (including shutting down HarperDB). Defaults to `false`.

### `dev: boolean`

Enables Next.js dev mode. Defaults to `false`.

### `installCommand: string`

Specify an install command. Defaults to `npm install`.

> Note: the extension will skip installing dependencies if it detects a `node_modules` folder in the application component.

### `port: number`

Specify a port for the Next.js server. Defaults to `3000`.

### `prebuilt: boolean`

When enabled, the extension will look for a `.next` directory in the root of the component and skip executing the `buildCommand`. Defaults to `false`.

### `subPath: string`

Specify a sub path to route requests from. For example, with `subPath: 'harperdb'`, any requests within the Next.js app to that path, such as `/harperdb/image.png`, will be rerouted to `/image.png`. Defaults to `''`.

## CLI

This package includes a CLI (`harperdb-nextjs`) that is meant to replace certain functions of the Next.js CLI. It will launch HarperDB and set sensible configuration values.

Available commands include:

### `dev`

Launches the application in Next.js development mode, and enables HMR for instantaneous updates when modifying application code.

### `build`

Builds the application and then exits the process.

### `start`

Launches the application in Next.js production mode.

### `help`

Lists available CLI commands.
