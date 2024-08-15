# @harperdb/nextjs

A HarperDB Component for running Next.js apps.

This module makes the HarperDB global resources available for use within a Next.js application.

Currently, it is limited to server-side only.

It is recommended to add `export const dynamic = 'force-dynamic'` to any pages that use the HarperDB globals.

## Usage

1. Install:
```sh
npm install @harperdb/nextjs
```
2. Add to `config.yaml`
```yaml
@harperdb/nextjs:
  package: '@harperdb/nextjs'
  dev: true
```

## Options

### `dev: boolean`

> 💡 Dev mode is hard. If every worker has a Next.js server running, every worker will be rebuilding the next app on changes (and this might not even work because Next.js uses workers itself for building). Need to figure out how to do the building on the main thread, but then still serve the output from all the workers (and include the HMR?).

### `prebuilt: boolean`

When enabled, the extension will look for a `.next` directory in the root of the component and use that as Next.js application root.

> 💡 This could maybe also be specified as a string that is the path to the prebuilt application.

### `installCommand: string`

Specify an install command. Defaults to `npm install`.

> Note: the extension will skip installing dependencies if it detects a `node_modules` folder in the component.

### `buildCommand: string`

Specify a build command. Defaults to `npm run build`.

### `debug: boolean`

Enable debug output for the extension.