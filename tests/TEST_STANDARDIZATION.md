# Test Standardization Guide

This document outlines the recommended structure and organization for test files in the SNSTR library. Following these guidelines will ensure consistency across all tests and make the test suite more maintainable.

## Test Directory Structure

Tests should be organized by NIP number, with subdirectories for specific components:

```
tests/
├── nip01/                              # Tests for NIP-01 (core protocol) implementation
│   ├── nostr.test.ts                   # Tests for the main Nostr client
│   ├── event/                          # Tests for event functionality
│   │   ├── event.test.ts               # Event creation and validation tests
│   │   ├── event-ordering.test.ts      # Event ordering tests
│   │   ├── event-ordering-integration.test.ts # Integration tests for event ordering
│   │   ├── addressable-events.test.ts  # Tests for addressable events
│   │   └── nostr-publish.test.ts       # Tests for event publication
│   └── relay/                          # Tests for relay functionality
│       ├── relay.test.ts               # Core relay functionality tests
│       ├── filters.test.ts             # Filter and subscription tests
│       └── relay-reconnect.test.ts     # Relay reconnection tests
├── nip04/                              # Tests for NIP-04 implementation
│   ├── encryption.test.ts              # Tests for encryption functionality
│   └── vectors.test.ts                 # Tests against standard vectors
├── nip05/                              # Tests for NIP-05 implementation
│   └── nip05.test.ts                   # DNS identity verification tests
├── nip07/                              # Tests for NIP-07 implementation
│   └── nip07.test.ts                   # Browser extension integration tests
├── nip11/                              # Tests for NIP-11 implementation
│   └── nip11.test.ts                   # Relay information document tests
├── nip19/                              # Tests for NIP-19 implementation
│   └── bech32.test.ts                  # Bech32 encoding/decoding tests
├── integration.test.ts                 # Cross-NIP integration tests
└── utils/                              # Tests for utility functions
    └── crypto.test.ts                  # Tests for cryptographic utilities
```

### When to Use Directories vs Single Files

- **NIP Directory**: Each NIP should have its own directory (e.g., `tests/nip01/`, `tests/nip04/`)
- **Component Subdirectories**: For complex NIPs, use subdirectories for specific components (e.g., `event/`, `relay/`)
- **Single File**: For simple components or NIPs with limited functionality, use a single test file
- **Special Files**: For integration tests or tests that span multiple NIPs, use appropriately named files in the root of the tests directory

## File Naming Conventions

- Test files should be named with `.test.ts` suffix
- File names should clearly indicate what they're testing:
  - `component.test.ts` for specific component tests (e.g., `event.test.ts`, `relay.test.ts`)
  - `feature.test.ts` for specific feature tests (e.g., `encryption.test.ts`)
  - `feature-detail.test.ts` for detailed aspects of features (e.g., `event-ordering.test.ts`)
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
    
    // NIP-01 Core Tests
    "test:nip01": "jest tests/nip01",
    "test:nip01:event": "jest tests/nip01/event",
    "test:nip01:relay": "jest tests/nip01/relay",
    "test:event": "jest tests/nip01/event/event.test.ts",
    "test:event:ordering": "jest tests/nip01/event/event-ordering.test.ts",
    "test:event:addressable": "jest tests/nip01/event/addressable-events.test.ts",
    "test:event:all": "jest tests/nip01/event",
    "test:nostr": "jest tests/nip01/nostr.test.ts",
    "test:relay": "jest tests/nip01/relay",
    "test:nip01:relay:connection": "jest tests/nip01/relay/relay.test.ts",
    "test:nip01:relay:filter": "jest tests/nip01/relay/filters.test.ts",
    "test:nip01:relay:reconnect": "jest tests/nip01/relay/relay-reconnect.test.ts",
    "test:nip01:relay:pool": "jest tests/nip01/relay/relayPool.test.ts",
    "test:crypto:core": "jest tests/utils/crypto.test.ts",
    
    // NIP-specific Tests
    "test:nip02": "jest tests/nip02",
    "test:nip04": "jest tests/nip04",
    "test:nip05": "jest tests/nip05",
    "test:nip07": "jest tests/nip07",
    "test:nip09": "jest tests/nip09",
    "test:nip10": "jest tests/nip10",
    "test:nip11": "jest tests/nip11",
    "test:nip17": "jest tests/nip17",
    "test:nip19": "jest tests/nip19",
    "test:nip21": "jest tests/nip21",
    "test:nip44": "jest tests/nip44",
    "test:nip46": "jest tests/nip46",
    "test:nip47": "jest tests/nip47",
    "test:nip50": "jest tests/nip50",
    "test:nip57": "jest tests/nip57",
    "test:nip65": "jest tests/nip65",
    "test:nip66": "jest tests/nip66",
    
    // Test Groups
    "test:all": "npm test",
    "test:core": "jest tests/nip01",
    "test:crypto": "jest tests/utils/crypto.test.ts tests/nip04 tests/nip44",
    "test:identity": "jest tests/nip05 tests/nip07 tests/nip19",
    "test:protocols": "jest tests/nip46 tests/nip47 tests/nip57"
  }
}
```

## Test Documentation

Each NIP test directory should include a README.md file explaining:

- What aspects of the NIP are being tested
- What components are included in this test directory
- Any special test setup required
- Explanation of test fixtures or test vectors
- Coverage goals and current status

For all NIP test directories, include a README.md:

```markdown
# NIP-XX Tests

This directory contains tests for the NIP-XX implementation.

## Components Tested

- ✅ Component A: Brief description
- ✅ Component B: Brief description
- ✅ Error Handling
- ✅ Official Test Vectors

## Running the Tests

```bash
npm run test:nipXX
```

## Test Files

- `component-a.test.ts`: Tests for Component A
- `component-b.test.ts`: Tests for Component B
- `vectors.test.ts`: Tests using official test vectors
```

## Implementation Checklist

When implementing tests for a NIP, ensure:

- [ ] Tests cover all exported functions and classes
- [ ] Tests include both success and failure cases
- [ ] Test files follow the naming conventions
- [ ] Integration tests with other NIPs if applicable
- [ ] Test script added to package.json
- [ ] README.md added to the NIP test directory
- [ ] Mocks are properly reset between tests

## Migration Plan

For existing tests:

1. Restructure test files to follow the standardized organization
2. Add missing test cases for full coverage
3. Add README.md files to test directories
4. Ensure all tests use the ephemeral relay (no external connections)
5. Standardize test naming and structure

This standardization will make the test suite more maintainable, easier to navigate, and more effective at catching regressions. 