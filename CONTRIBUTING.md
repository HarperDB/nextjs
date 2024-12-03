# Contributing

## Code Organization

All code should abide by the following organization rules:

- `fixtures/` is for directories that will be utilized in testing.
  - They should be fully executable locally for debugging purposes
  - They should be as minimal as possible
- `test/` is for Playwright based test files that are executed by `npm run test`
  - Test files should use `import { test, expect } from '../util/test-fixture.js';` so that the correct **Fixture** is managed for the test script
  - Test files should execute serially, and relevant to the given Next.js versions
- `util/` is for any non-module source code. This includes scripts (`util/scripts/`), docker configurations (`util/docker/`), or any other utility based code.
  - Prime examples include the source code responsible for [_building_](./util/scripts/pretest.js) the **Fixtures**, or the custom Playwright [test fixture](./util/test-fixture.js)

The key source files for the repo are:

- `cli.js`
- `extension.js`
- `config.yaml`
- `schema.graphql`

## Testing

Testing for this repo uses containers in order to generate stable, isolated environments containing:

- HarperDB
- Node.js
- A HarperDB Base Component (responsible for seeding the database)
- A Next.js application Component (which uses this `@harperdb/nextjs` extension)

To execute tests, run `npm run test`

The first run may take some time as the pretest script is building 12 separate images (3 Node.js ones, 9 Next.js ones). Note, at the moment this operation is parallelized as building is very expensive and can result in the system running out of resources (and crashing the build processes). Subsequent runs utilize the Docker build step cache and are very fast.

After the images are built, [Playwright](https://playwright.dev/) will run the tests. These tests each utilize an image, and will manage a container instance relevant to the given Next.js and Node.js pair.

The tests are configured with generous timeouts and limited to 3 workers at a time to not cause the system to run out of resources.
