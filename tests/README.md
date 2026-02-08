# SNSTR Test Suite

This directory contains the test suite for the SNSTR Nostr client library. The tests are organized by NIP (Nostr Implementation Possibilities) to validate different components of the library.

## Directory Structure

Tests are organized into directories by NIP number, with subdirectories for specific components where needed:

- **NIP-specific Directories**:
  - `/nip01` - Tests for NIP-01 (Core Protocol Functionality)
    - `nostr.test.ts` - Tests for the main Nostr client
    - `/event` - Tests for event-related functionality
      - `event.test.ts` - Core event tests
      - `event-ordering.test.ts` - Event ordering tests
      - `addressable-events.test.ts` - Tests for addressable events
    - `/relay` - Tests for relay-related functionality
      - `connection.test.ts` - Relay connection tests
      - `filter.test.ts` - Subscription filter tests
      - `reconnect.test.ts` - Tests for relay reconnection
  - `/nip02` - Tests for NIP-02 (Contact List and Petnames)
    - `nip02.test.ts` - Tests for contact list creation and parsing
  - `/nip04` - Tests for NIP-04 (Encrypted Direct Messages)
    - `encryption.test.ts` - Tests for NIP-04 encryption
  - `/nip05` - Tests for NIP-05 (DNS-based Verification)
    - `nip05.test.ts` - Tests for DNS identity verification
  - `/nip07` - Tests for NIP-07 (Browser Extension Integration)
    - `nip07.test.ts` - Tests for browser extension functionality
  - `/nip09` - Tests for NIP-09 (Event Deletion Requests)
    - `nip09.test.ts` - Deletion request creation and parsing
  - `/nip11` - Tests for NIP-11 (Relay Information Document)
    - `nip11.test.ts` - Tests for relay information functionality
  - `/nip19` - Tests for NIP-19 (bech32-encoded entities)
    - `bech32.test.ts` - Tests for basic bech32 encoding/decoding
    - `tlv.test.ts` - Tests for TLV entity handling
    - `validation.test.ts` - Tests for validation and error handling
    - `security.test.ts` - Tests for security features
  - `/nip44` - Tests for NIP-44 (Encrypted Messages with Versioned Encryption)
    - `nip44-compatibility.test.ts` - Tests for version compatibility
    - `nip44-official-vectors.test.ts` - Tests with official NIP-44 vectors
    - `nip44-padding-hmac.test.ts` - Tests for padding and HMAC functionality
    - `nip44-vectors.test.ts` - Tests with custom vectors
  - `/nip46` - Tests for NIP-46 (Nostr Connect)
    - `nip46.test.ts` - Core NIP-46 functionality tests
    - `auth-challenges.test.ts` - Authentication challenge tests
    - `permissions.test.ts` - Permission control tests
    - `connection-failures.test.ts` - Connection handling tests
  - `/nip47` - Tests for NIP-47 (Wallet Connect)
    - `nip47.test.ts` - Core NIP-47 functionality tests
    - `client-validation.test.ts` - Client validation tests
    - `error-handling.test.ts` - Error handling tests
  - `/nip57` - Tests for NIP-57 (Lightning Zaps)
    - `zap.test.ts` - Zap functionality tests
  - `/nip65` - Tests for NIP-65 (Relay List Metadata)
    - `nip65.test.ts` - Relay list parsing and creation
  - `/nip66` - Tests for NIP-66 (Relay Discovery & Monitoring)
    - `nip66.test.ts` - Relay discovery and liveness tests

- **Other Directories**:
  - `/types` - Type definitions and helpers for testing
    - `index.ts` - Test utility types and type-safe accessors
  - `/utils` - Tests for utility functions
    - `crypto.test.ts` - Tests for cryptographic utilities
  
- **Root Tests**:
  - `integration.test.ts` - End-to-end integration tests

## Running Tests

To run all tests:

```bash
npm test
```

To run the Bun-native migration subset:

```bash
bun run test:bun
```

To run tests for a specific NIP:

```bash
npm run test:nip01       # Run all NIP-01 core protocol tests
npm run test:nip02       # Run NIP-02 tests
npm run test:nip04       # Run NIP-04 tests
npm run test:nip05       # Run NIP-05 tests
npm run test:nip09       # Run NIP-09 tests
npm run test:nip19       # Run NIP-19 tests
npm run test:nip44       # Run NIP-44 tests
npm run test:nip46       # Run NIP-46 tests
npm run test:nip47       # Run NIP-47 tests
npm run test:nip57       # Run NIP-57 tests
npm run test:nip65       # Run NIP-65 tests
npm run test:nip66       # Run NIP-66 tests
```

For NIP-01 components specifically:

```bash
npm run test:nip01:event    # Run all event-related tests
npm run test:nip01:relay    # Run all relay-related tests
npm run test:nostr          # Run Nostr client tests
npm run test:event          # Run event creation/validation tests
```

## Test Categories

Tests are also organized into logical categories:

```bash
npm run test:core        # Core functionality (all NIP-01 tests)
npm run test:crypto      # All crypto (utils/crypto + NIP-04 + NIP-44)
npm run test:identity    # Identity-related (NIP-05, NIP-07, NIP-19)
npm run test:protocols   # Protocol implementations (NIP-46, NIP-47, NIP-57)
npm run test:integration # Run integration tests
```

## Test Coverage

To generate a test coverage report:

```bash
npm run test:coverage
```

## Writing New Tests

When adding new tests:

1. For a new NIP implementation, create a new directory following the naming convention `nip{XX}`
2. For components of complex NIPs, create subdirectories (e.g., `event/`, `relay/`)
3. Add a README.md to each NIP directory explaining what is being tested
4. Follow the structure outlined in [TEST_STANDARDIZATION.md](./TEST_STANDARDIZATION.md)

## Test Conventions

- Use descriptive test names that explain what is being tested
- Group related tests using Jest's `describe` blocks
- Follow the AAA (Arrange, Act, Assert) pattern
- Mock external dependencies when appropriate
- Create ephemeral test resources that clean up after tests complete 
- Use the `/types` directory for test-specific type definitions and helpers for type-safety 
