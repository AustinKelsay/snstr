# NIP-01 Tests

This directory contains tests for the NIP-01 implementation, which covers the core protocol functionality of Nostr.

## Components Tested

- ✅ **Nostr Client**: Tests for the main Nostr client implementation including connection management, event publishing, and subscription handling.
- ✅ **Event Handling**: Tests for event creation, validation, signing, and verification.
- ✅ **Relay Communication**: Tests for relay connections, message handling, and subscription filters.
- ✅ **Protocol Compliance**: Tests ensuring compliance with the NIP-01 specification.
- ✅ **Error Handling**: Tests for error cases and edge conditions.

## Running the Tests

```bash
# Run all NIP-01 tests
npm run test:nip01

# Run specific component tests
npm run test:nip01:event    # Run all event-related tests
npm run test:nip01:relay    # Run all relay-related tests
npm run test:nostr          # Run Nostr client tests
npm run test:event          # Run event creation/validation tests
npm run test:event:ordering # Run event ordering tests
npm run test:relay:connection # Run relay connection tests
npm run test:relay:filter   # Run subscription filter tests
```

## Test Files

- `nostr.test.ts`: Tests for the main Nostr client functionality.
- `event/`: Directory containing event-related tests.
  - `event.test.ts`: Tests for event creation, validation, and handling.
  - `event-ordering.test.ts`: Tests for event ordering and sorting.
  - `event-ordering-integration.test.ts`: Integration tests for event ordering.
  - `addressable-events.test.ts`: Tests for addressable events (kinds 30000-39999).
  - `nostr-publish.test.ts`: Tests for event publication functionality.
- `relay/`: Directory containing relay-related tests.
  - `relay.test.ts`: Tests for core relay functionality.
  - `filters.test.ts`: Tests for subscription filters.
  - `relay-reconnect.test.ts`: Tests for relay reconnection behavior.

## Test Coverage

The tests in this directory ensure that all aspects of the core NIP-01 protocol are correctly implemented, including:

1. Event format and validation
2. Event signing and verification
3. JSON serialization and deserialization
4. Relay connection management
5. Subscription creation and management
6. Filter application
7. Error handling and edge cases

These tests form the foundation of the SNSTR library, as NIP-01 defines the core protocol that all other NIPs build upon. 