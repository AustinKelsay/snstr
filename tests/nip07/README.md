# NIP-07 Tests

This directory contains tests for the NIP-07 implementation, which covers browser extension integration for Nostr clients.

## Components Tested

- ✅ **Browser API Detection**: Tests for detecting and interacting with NIP-07 compatible browser extensions.
- ✅ **Key Management**: Tests for accessing public keys and signing events via extensions.
- ✅ **Event Signing**: Tests for delegating event signing to the extension.
- ✅ **Encryption/Decryption**: Tests for using the extension for NIP-04 encryption operations.
- ✅ **Extension Fallbacks**: Tests for graceful fallbacks when extensions are not available.
- ✅ **Error Handling**: Tests for handling permission denials and other extension errors.

## Running the Tests

```bash
# Run all NIP-07 tests
npm run test:nip07
```

## Test Files

- `nip07.test.ts`: Tests for NIP-07 browser extension integration, mocking window.nostr API.

## Test Coverage

The tests in this directory ensure that all aspects of the NIP-07 protocol are correctly implemented, including:

1. Detection of compatible browser extensions
2. Requesting and obtaining public keys from the extension
3. Requesting event signatures from the extension
4. Using the extension for encryption/decryption operations
5. Proper error handling for permission denials
6. Graceful fallbacks when extensions are not available
7. Proper handling of multiple extension calls
8. Mocking of browser extension APIs for testing

NIP-07 is a critical component for browser-based Nostr applications, as it allows users to manage their keys securely through extensions like nos2x or Alby, rather than exposing private keys directly to web applications. 