/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  // No need to exclude integration tests since they use the ephemeral relay
  testPathIgnorePatterns: [],
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