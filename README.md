# @harperdb/nextjs

A HarperDB Component for running (and developing) Next.js apps.

Most Next.js features are supported as we rely on the Next.js Server provided by Next.js to run your application.

## Usage

1. Install:
```sh
npm install @harperdb/nextjs
```
2. Add to `config.yaml`:
```yaml
@harperdb/nextjs:
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

## Options

> All configuration options are optional

### `buildCommand: string`

Specify a custom build command. Defaults to `npm run build`.

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
