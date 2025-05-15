# NIP-05 Tests

This directory contains tests for the NIP-05 implementation, which covers DNS-based verification of Nostr identities.

## Components Tested

- ✅ **Identity Verification**: Tests for verifying identities using the NIP-05 DNS protocol.
- ✅ **Name Resolution**: Tests for resolving human-readable names to Nostr public keys.
- ✅ **Relay Discovery**: Tests for discovering user's preferred relays via NIP-05.
- ✅ **Error Handling**: Tests for invalid domain formats, failed DNS lookups, and malformed responses.
- ✅ **Caching Behavior**: Tests for caching of DNS responses and proper invalidation.

## Running the Tests

```bash
# Run all NIP-05 tests
npm run test:nip05
```

## Test Files

- `nip05.test.ts`: Tests for NIP-05 implementation including DNS verification and relay discovery.

## Test Coverage

The tests in this directory ensure that all aspects of the NIP-05 protocol are correctly implemented, including:

1. Parsing and validation of NIP-05 identifiers (name@domain.com)
2. Fetching and parsing the well-known JSON file
3. Verification of public key mappings
4. Discovery of user's preferred relays
5. Error handling for invalid inputs, network failures, and malformed responses
6. Proper caching of DNS responses with appropriate timeouts

NIP-05 is an important component of the Nostr ecosystem as it provides a way to verify identities using the familiar DNS system, making Nostr profiles more user-friendly and trustworthy. 