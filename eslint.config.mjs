// Lint settings for development only (not part of the game upload).
export default [
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly', document: 'readonly', performance: 'readonly', requestAnimationFrame: 'readonly',
        setTimeout: 'readonly', setInterval: 'readonly', getComputedStyle: 'readonly', FontFace: 'readonly',
        localStorage: 'readonly', navigator: 'readonly', console: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-unreachable': 'error',
      'no-dupe-keys': 'error',
      'no-self-compare': 'error',
      'no-constant-binary-expression': 'error',
    },
  },
];
