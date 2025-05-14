# SNSTR Test Suite

This directory contains the test suite for the SNSTR Nostr client library. The tests are organized to validate different components and NIPs (Nostr Implementation Possibilities) implementations.

## Directory Structure

- **Root Tests**: Core functionality tests for basic library features
  - `nostr.test.ts` - Tests for the main Nostr client
  - `relay.test.ts` - Tests for relay connection handling
  - `crypto.test.ts` - Tests for cryptographic utilities
  - `filters.test.ts` - Tests for filter functionality
  - `integration.test.ts` - End-to-end integration tests
  - `nostr-publish.test.ts` - Tests for publication functionality
  - `nip05.test.ts` - Tests for NIP-05 (Mapping Nostr keys to DNS-based internet identifiers)
  - `nip07.test.ts` - Tests for NIP-07 (Web browser extension)
  - `nip11.test.ts` - Tests for NIP-11 (Relay Information Document)

- **Nested Directories**:
  - `/event` - Tests for event-related functionality
  - `/client` - Tests for client-related functionality
    - `relay-reconnect.test.ts` - Tests for relay reconnection

- **NIP-specific Directories**: Additional tests organized by NIP number
  - `/nip04` - Tests for NIP-04 (Encrypted Direct Messages)
  - `/nip19` - Tests for NIP-19 (bech32-encoded entities)
  - `/nip44` - Tests for NIP-44 (Encrypted Messages with Versioned Encryption)
  - `/nip46` - Tests for NIP-46 (Nostr Connect)
  - `/nip47` - Tests for NIP-47 (Wallet Connect)
  - `/nip57` - Tests for NIP-57 (Lightning Zaps)

## Running Tests

To run all tests:

```bash
npm test
```

To run a specific test file:

```bash
npm test -- tests/nostr.test.ts
```

To run a specific test suite or test:

```bash
npm test -- -t "Nostr Client"
```

## Test Coverage

To generate a test coverage report:

```bash
npm run test:coverage
```

## Writing New Tests

When adding new tests:

1. For core functionality, add tests to the appropriate root test file
2. For NIP-specific features, add tests to the corresponding NIP directory
3. If implementing a new NIP, create a new directory following the naming convention `nip{number}`
4. Add a README.md to each NIP directory explaining the specific tests

## Test Conventions

- Use descriptive test names that explain what is being tested
- Group related tests using Jest's `describe` blocks
- Follow the AAA (Arrange, Act, Assert) pattern
- Mock external dependencies when appropriate
- Create ephemeral test resources that clean up after tests complete 