// Lint rules: the recommended JavaScript and TypeScript checks, plus React's rules of hooks,
// which catch hooks called conditionally and effects missing a dependency.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dist-e2e', 'playwright-report', 'test-results'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // `_unused` names are deliberate (e.g. pulling a field out of an object to drop it).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
    },
  },
  {
    // Tests and tooling run in Node.
    files: ['e2e/**/*.ts', '**/*.test.ts', '*.config.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },
);
