# NIP-44 Tests

This directory contains tests for the NIP-44 (Versioned Encryption) implementation. NIP-44 provides a more secure encryption method than NIP-04, using ChaCha20 with HMAC-SHA256 authentication.

## Test Coverage

- ✅ Core encryption/decryption functionality
- ✅ Official test vectors compliance
- ✅ Message padding and length hiding
- ✅ HMAC authentication and tampering detection
- ✅ Error handling for invalid inputs
- ✅ Cross-platform compatibility (browser and Node.js)

## Running the Tests

```bash
# Run all NIP-44 tests
npm run test:nip44

# Run a specific test file
npx jest tests/nip44/nip44-vectors.test.ts
```

## Test Files

- `nip44-compatibility.test.ts`: Tests for compatibility between platforms and implementations
- `nip44-official-vectors.test.ts`: Tests using the official NIP-44 test vectors
- `nip44-padding-hmac.test.ts`: Tests for message padding and HMAC authentication
- `nip44-format-validation.test.ts`: Tests for validating public and private key formats
- `nip44-vectors.test.ts`: Additional test vectors for comprehensive testing

## Test Vectors

The test vectors used in these tests come from two sources:

1. **Official NIP-44 Vectors**: Provided in the NIP-44 specification to ensure compatibility with other implementations
2. **Custom Test Vectors**: Additional vectors created to test edge cases and specific features

## Security Considerations

The tests ensure the implementation:

- Properly authenticates messages to prevent tampering
- Correctly pads messages to hide their length
- Validates all inputs to prevent potential attacks
- Uses proper key derivation from the shared secret
- Handles version bytes for future algorithm upgrades
- Follows the constant-time principle for cryptographic operations 