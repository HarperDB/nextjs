import globals from 'globals';
import pluginJs from '@eslint/js';

/** @type {import('eslint').Linter.Config[]} */
export default [
	{ ignores: ['fixtures/*', 'test-utils/*'] },
	{ languageOptions: { globals: globals.node } },
	pluginJs.configs.recommended,
];
