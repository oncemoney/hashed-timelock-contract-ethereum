/*eslint linebreak-style: ["error", "windows"]*/
module.exports = {
  env: {
    'browser': true,
    'node': true,
    'es6': true,
    'mocha': true,
  },
  parserOptions: {
    'ecmaVersion': 2018,
  },
  globals: {
    'ethereum': 'readonly',
    'web3': true,
    'contract': true,
    'artifacts': true,
    'assert': true,
  },
  plugins: [
    'json',
  ],
  extends: [
    '@metamask/eslint-config',
    '@metamask/eslint-config/config/nodejs',
  ],
  overrides: [{
    'files': ['src/index.js'],
    'parserOptions': {
      'sourceType': 'module',
    },
  }],
  ignorePatterns: [
    '!.eslintrc.js',
    'dist',
  ],
  rules: {
    'no-console': 'off',
    'no-unused-vars': [
      'warn',
    ],
    'semi': [
      'error',
      'never',
    ],
  },
}
