/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  // Skip integration tests by default unless RUN_INTEGRATION_TESTS=true
  testPathIgnorePatterns: [
    process.env.RUN_INTEGRATION_TESTS !== 'true' ? 'integration.test.ts' : ''
  ],
  // Add reasonable test timeout
  testTimeout: 10000,
  // Display detailed coverage information
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 75,
      branches: 50,
      functions: 70,
      lines: 75
    }
  }
}; 