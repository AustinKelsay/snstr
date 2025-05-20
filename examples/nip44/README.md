# NIP-44 Examples

This directory contains examples demonstrating how to use NIP-44 encrypted direct messaging functionality in the SNSTR library.

## Overview

[NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md) defines an improved protocol for encrypted direct messages in Nostr. It uses ChaCha20-Poly1305 for encryption and HMAC-SHA256 for authentication, providing better security than the older NIP-04 standard.

**Implementation Details**:
- Uses ChaCha20 for encryption and HMAC-SHA256 for authentication
- Includes a version byte to support future algorithm upgrades and backward compatibility
- Supports decryption of messages encrypted with versions 0, 1, and 2
- Provides proper key derivation using HKDF
- Implements message length hiding with a custom padding scheme
- Uses secure 32-byte nonces
- Performs constant-time operations to prevent timing attacks

## Examples

### Main NIP-44 Demo

The [`nip44-demo.ts`](./nip44-demo.ts) example demonstrates:

- Generating keypairs for two users (Alice and Bob)
- Encrypting messages with NIP-44
- Decrypting messages
- Handling minimum message length requirements
- Failed decryption scenarios
- Message tampering detection
- The padding scheme for message length hiding
- Version compatibility basics
- Comparison with NIP-04
- Constant-time comparison for secure HMAC validation

### Version Compatibility Demo

The [`nip44-version-compatibility.ts`](./nip44-version-compatibility.ts) example provides a more in-depth demonstration of:

- Attempting to encrypt with NIP-44 versions 0 and 1 (which correctly results in errors as per NIP-44 spec).
- Successful encryption with NIP-44 version 2 (the current standard).
- Automatic decryption of messages from any supported version (0, 1, and 2).
- Error handling for unsupported versions for encryption.

### Test Vector Verification

The [`nip44-test-vector.ts`](./nip44-test-vector.ts) example:

- Loads and verifies official NIP-44 test vectors
- Tests conversation key derivation
- Tests message key derivation
- Tests decryption of official v2 test vector payloads.
- Demonstrates NIP-44 version handling for encryption (v0/v1 attempts fail as specified, v2 succeeds) and decryption.
- Provides detailed examination of specific vectors for debugging

## Running the Examples

To run the examples:

```bash
# Run the main NIP-44 demo
npm run example:nip44

# Run the version compatibility demo
npm run example:nip44:version-compat

# Run the test vector verification
npm run example:nip44:run-vectors
```

## Key Concepts

- **Versioned Encryption**: NIP-44 includes a version byte in the payload for future protocol upgrades
- **Backward Compatibility**: Support for decrypting messages encrypted with older versions (0, 1)
- **Authenticated Encryption**: Uses HMAC-SHA256 to prevent message tampering
- **Message Length Hiding**: Custom padding scheme to conceal the exact length of messages
- **Proper Key Derivation**: Uses HKDF instead of raw ECDH output for better security
- **Constant-Time Operations**: Prevents timing attacks during cryptographic operations
- **Comprehensive Validation**: Thorough input validation and error handling

## Security Improvements Over NIP-04

- **Authentication**: NIP-44 adds HMAC-SHA256 to detect message tampering
- **Modern Cipher**: Uses ChaCha20 instead of AES-CBC for better security
- **Proper Key Derivation**: Implements HKDF for stronger key derivation
- **Length Hiding**: Applies padding to hide message length
- **Forward Compatibility**: Version byte allows for future algorithm improvements without breaking compatibility
- **Timing Attack Protection**: Uses constant-time comparison for MAC validation

## API Functions Used

- `encrypt()`: Encrypt a message using NIP-44 with optional version specification
- `decrypt()`: Decrypt a message using NIP-44 (automatically handles any supported version)
- `getSharedSecret()`: Get the shared secret between two keys
- `generateKeypair()`: Generate a new Nostr keypair

## Related NIPs

- [NIP-04](https://github.com/nostr-protocol/nips/blob/master/04.md): Encrypted Direct Message (older, less secure method)
- [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md): Basic Protocol (events and structure) 