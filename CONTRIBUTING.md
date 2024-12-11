# Contributing

## Code Organization

The key source files for the repo are:

- `cli.js`
- `extension.js`
- `config.yaml`

These are what are included in the published module and what HarperDB relies on for the component to work.

The `fixtures/` directory contains testable examples of using this extension.

The `test-utils/` directory contains some scripts for Playwright that the fixtures use to setup HarperDB for the test run.

## Testing

After many, many hours and a plethora of different attempts, setting up HarperDB and running the fixture Playwright tests was too flaky for automation. Review the repository at this [commit](https://github.com/HarperDB/nextjs/tree/b72c05e29bd5afd4b91425ae709effa05bd3c2fd) for some of the prior art.

Instead, for now, fixtures can be tested by running them locally. Make sure to have HarperDB installed globally on your machine. Generally, to run the tests within a fixture, you only have to run `npm install` and `npm run test` from within the specific fixture directory.
