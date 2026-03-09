export default [
  {
    ignores: [
      'node_modules/**',
      'dev-pipeline/state/**',
      'dev-pipeline/bugfix-state/**',
      '.prizmkit/**'
    ]
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    rules: {}
  }
];
