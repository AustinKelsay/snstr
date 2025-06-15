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

# Run granular relay tests
npm run test:nip01:relay:connection  # Run relay connection tests
npm run test:nip01:relay:filter      # Run subscription filter tests
npm run test:nip01:relay:reconnect   # Run relay reconnection tests
npm run test:nip01:relay:pool        # Run relay pool tests
npm run test:nip01:relay:websocket   # Run WebSocket implementation tests
```