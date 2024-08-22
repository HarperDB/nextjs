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
  files: '/*'
```

## Options

### `dev: boolean`

Enables Next.js dev mode.

> Note: This feature is currently not-supported and is work-in-progress.

### `prebuilt: boolean`

When enabled, the extension will look for a `.next` directory in the root of the component and use that as Next.js application root.

### `installCommand: string`

Specify an install command. Defaults to `npm install`.

> Note: the extension will skip installing dependencies if it detects a `node_modules` folder in the application component.

### `buildCommand: string`

Specify a custom build command. Defaults to `npm run build`.

> Note: the extension will skip building if the `prebuilt` option is set to `true`
