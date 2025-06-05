# NIP-04 Tests

This directory contains tests for the NIP-04 (Encrypted Direct Messages) implementation, which defines how direct messages should be encrypted using AES-CBC.

## Test Coverage

- ✅ Encryption/decryption functionality
- ✅ ECDH shared secret derivation
- ✅ Format validation (`<ciphertext>?iv=<initialization_vector>`)
- ✅ Cross-compatibility with other implementations
- ✅ Error handling for invalid inputs

## Running the Tests

```bash
# Run all NIP-04 tests
npm run test:nip04

# Run a specific test file
npx jest tests/nip04/encryption.test.ts
```

## Test Files

- `encryption.test.ts`: Tests for the core encryption/decryption functionality and compatibility

## Implementation Notes

While NIP-04 is now considered "unrecommended" in favor of NIP-44, these tests ensure compatibility with existing clients and messages. The implementation includes specific compatibility with NIP-04 compliant libraries and clients by:

- Using ECDH to derive the shared secret
- Following the same approach to key handling as NIP-04 compliant libraries and clients
- Including specific compatibility test cases

## Security Considerations

The tests verify the known limitations of NIP-04:

- No authentication (vulnerable to message tampering)
- Not forward secure
- No message length hiding

For new applications, we recommend using NIP-44, but NIP-04 support is maintained for compatibility with existing systems. 