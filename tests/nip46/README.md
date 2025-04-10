# NIP-46 Tests

This directory contains tests for the NIP-46 (Nostr Connect) implementation, which provides a remote signing protocol for securely storing private keys in a separate "bunker" application.

## Test Coverage

- ✅ Basic connection and communication between client and bunker
- ✅ Authentication and challenge verification
- ✅ Event signing through bunker
- ✅ Permission control system
- ✅ Error handling for unauthorized requests
- ✅ Connection failures and retry logic
- ✅ Encryption of communication between client and bunker

## Running the Tests

```bash
# Run all NIP-46 tests
npm run test:nip46

# Run a specific test file
npx jest tests/nip46/permissions.test.ts
```

## Test Files

- `nip46.test.ts`: Core functionality tests for the NIP-46 implementation
- `auth-challenges.test.ts`: Tests for authentication challenge mechanism
- `connection-failures.test.ts`: Tests for connection failure handling and recovery
- `permissions.test.ts`: Tests for the permission system controlling what clients can do

## Test Environment

These tests use the ephemeral relay implementation to avoid external dependencies. The tests create temporary client and bunker instances that communicate over the in-memory relay.

## Test Scenarios

The tests cover various scenarios including:

1. **Normal operation**: Client connects to bunker, gets public key, signs events
2. **Authentication**: Tests that bunkers properly verify clients
3. **Permissions**: Tests that bunkers properly enforce permissions
4. **Error Handling**: Tests various error conditions and recovery mechanisms
5. **Connection Issues**: Tests reconnection behavior when connections are lost

## Implementation Details

The tests verify that the implementation follows the NIP-46 specification, including:

- Proper event encryption between client and bunker
- Correct handling of the request-response pattern
- Appropriate authentication mechanisms
- Permission-based access control
- Secure key management (keys never leave the bunker) 