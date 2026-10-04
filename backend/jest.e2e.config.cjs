module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testRegex: '.*\\.e2e\\.ts$',
  clearMocks: true,
  // Os cenários fazem múltiplas viagens ao PostgreSQL remoto no Neon.
  testTimeout: 60000,
};
