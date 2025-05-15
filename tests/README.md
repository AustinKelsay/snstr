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
    - `event.test.ts` - Core event tests
    - `event-ordering.test.ts` - Event ordering tests
    - `addressable-events.test.ts` - Tests for addressable events
    - `event-ordering-integration.test.ts` - Integration tests for event ordering
  - `/client` - Tests for client-related functionality
    - `relay-reconnect.test.ts` - Tests for relay reconnection

- **NIP-specific Directories**: Tests organized by NIP number
  - `/nip04` - Tests for NIP-04 (Encrypted Direct Messages)
    - `encryption.test.ts` - Tests for NIP-04 encryption
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

## Running Tests

To run all tests:

```bash
npm test
```

To run tests for a specific component:

```bash
npm run test:nostr       # Run Nostr client tests
npm run test:relay       # Run relay tests
npm run test:event       # Run event tests
npm run test:event:all   # Run all event directory tests
```

To run tests for a specific NIP:

```bash
npm run test:nip04       # Run NIP-04 tests
npm run test:nip05       # Run NIP-05 tests
npm run test:nip19       # Run NIP-19 tests
npm run test:nip44       # Run NIP-44 tests
npm run test:nip46       # Run NIP-46 tests
npm run test:nip47       # Run NIP-47 tests
npm run test:nip57       # Run NIP-57 tests
```

## Test Categories

Tests are also organized into logical categories:

```bash
npm run test:core        # Core functionality (event, nostr, relay)
npm run test:crypto      # All crypto (core + NIP-04 + NIP-44)
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

1. For core functionality, add tests to the appropriate root test file
2. For NIP-specific features, add tests to the corresponding NIP directory
3. If implementing a new NIP, create a new directory following the naming convention `nip{number}`
4. Follow the structure outlined in [TEST_STANDARDIZATION.md](./TEST_STANDARDIZATION.md)

## Test Conventions

- Use descriptive test names that explain what is being tested
- Group related tests using Jest's `describe` blocks
- Follow the AAA (Arrange, Act, Assert) pattern
- Mock external dependencies when appropriate
- Create ephemeral test resources that clean up after tests complete 