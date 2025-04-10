# Test Standardization Guide

This document outlines the recommended structure and organization for test files in the SNSTR library. Following these guidelines will ensure consistency across all tests and make the test suite more maintainable.

## Test Directory Structure

Tests should follow a mirrored structure to the source code:

```
tests/
├── nip04/                     # Tests for NIP-04 implementation
│   ├── encryption.test.ts     # Tests for encryption functionality
│   └── vectors.test.ts        # Tests against standard vectors
├── nip05/                     # Tests for NIP-05 implementation
│   └── nip05.test.ts          # All NIP-05 tests
├── nip19.test.ts              # For simpler NIPs, a single test file is fine
├── integration.test.ts        # Cross-NIP integration tests
└── utils/                     # Tests for utility functions
    └── crypto.test.ts         # Tests for cryptographic utilities
```

### When to Use Directories vs Single Files

- **Single File**: For simple NIPs with limited functionality, use a single test file (e.g., `nip19.test.ts`)
- **Directory**: For complex NIPs with multiple features, use a directory with multiple test files (e.g., `tests/nip47/`)
- **Special Files**: For integration tests or tests that span multiple NIPs, use appropriately named files in the root of the tests directory

## File Naming Conventions

- Test files should be named with `.test.ts` suffix
- File names should clearly indicate what they're testing:
  - `feature.test.ts` for specific feature tests
  - `integration.test.ts` for integration tests
  - `vectors.test.ts` for vector-based tests
  - `e2e.test.ts` for end-to-end tests

## Test File Structure

Each test file should follow this structure:

```typescript
/**
 * Tests for NIP-XX: Brief description of what's being tested
 */

import { /* imports */ } from '../src/nipXX';
import { /* test utilities */ } from './utils';

// Group related tests with describe blocks
describe('NIP-XX: Feature name', () => {
  // Setup before tests if needed
  beforeAll(() => {
    // Setup code
  });

  // Test a specific functionality
  test('should do something specific', () => {
    // Arrange
    const input = 'test-input';
    
    // Act
    const result = someFunction(input);
    
    // Assert
    expect(result).toBe('expected-output');
  });

  // Test edge cases and failures
  test('should handle error cases', () => {
    expect(() => {
      someFunction('invalid-input');
    }).toThrow('Expected error message');
  });

  // Clean up after tests if needed
  afterAll(() => {
    // Cleanup code
  });
});

// For vector-based tests
describe('NIP-XX: Test vectors', () => {
  // Define test vectors
  const testVectors = [
    { input: 'input1', expected: 'output1' },
    { input: 'input2', expected: 'output2' },
    // More test vectors...
  ];

  // Use test.each for vector-based testing
  test.each(testVectors)(
    'vector %#: %j should produce %j',
    ({ input, expected }) => {
      const result = someFunction(input);
      expect(result).toBe(expected);
    }
  );
});
```

## Test Guidelines

### Organization

- Group related tests with `describe` blocks
- Use nested `describe` blocks for subfeatures
- Name tests clearly using `test('should...')` format
- Follow the AAA pattern (Arrange, Act, Assert)

### Test Coverage

- Test normal operation paths
- Test edge cases
- Test error conditions
- Include vector-based tests for crypto operations
- Test with different input types and sizes

### Mocking

- Mock external services when necessary (like fetch)
- Use Jest's mocking capabilities: `jest.mock()`, `jest.spyOn()`
- Reset mocks between tests: `jest.resetAllMocks()`

### For Relay Tests

- Use the ephemeral relay for testing
- Clean up resources after each test
- Avoid external network connections
- Tests should be deterministic and not rely on external state

## Test Scripts in package.json

The following scripts should be maintained for running tests:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:integration": "jest tests/integration.test.ts",
    "test:nip04": "jest tests/nip04",
    "test:nip44": "jest tests/nip44",
    "test:nip19": "jest tests/nip19.test.ts",
    "test:nip05": "jest tests/nip05.test.ts",
    "test:nip46": "jest tests/nip46",
    "test:nip47": "jest tests/nip47",
    "test:nip57": "jest tests/nip57"
  }
}
```

## Test Documentation

Each test directory should include a README.md file explaining:

- What aspects of the NIP are being tested
- Any special test setup required
- Explanation of test fixtures or test vectors
- Coverage goals and current status

For complex NIPs, include a README.md in the test directory:

```markdown
# NIP-XX Tests

This directory contains tests for the NIP-XX implementation.

## Test Coverage

- ✅ Feature A
- ✅ Feature B 
- ✅ Error Handling
- ✅ Official Test Vectors

## Running the Tests

```bash
npm run test:nipXX
```

## Test Files

- `feature-a.test.ts`: Tests for Feature A
- `feature-b.test.ts`: Tests for Feature B
- `vectors.test.ts`: Tests using official test vectors
```

## Implementation Checklist

When implementing tests for a NIP, ensure:

- [ ] Tests cover all exported functions and classes
- [ ] Tests include both success and failure cases
- [ ] Test files follow the naming conventions
- [ ] Integration tests with other NIPs if applicable
- [ ] Test script added to package.json
- [ ] README.md added if using a test directory
- [ ] Mocks are properly reset between tests

## Migration Plan

For existing tests:

1. Restructure test files to follow the standardized organization
2. Add missing test cases for full coverage
3. Add README.md files to test directories
4. Ensure all tests use the ephemeral relay (no external connections)
5. Standardize test naming and structure

This standardization will make the test suite more maintainable, easier to navigate, and more effective at catching regressions. 