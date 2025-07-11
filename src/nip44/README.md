# NIP-44: Encryption Implementation

This is an implementation of [NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md), which defines a new encryption scheme for Nostr direct messages.

## Overview

NIP-44 replaces the older NIP-04 encryption with a more secure approach using ChaCha20 + HMAC-SHA256. This implementation provides:

- Better security properties with authenticated encryption
- Protection against tampering via HMAC-SHA256 authentication
- Future-proof design with a version byte for upgradability
- Proper key derivation using HKDF
- Message length hiding via a custom padding scheme
- Secure nonce handling with 32-byte nonces
- **Full version compatibility** supporting decryption of v0, v1, and v2 messages

## Basic Usage

```typescript
import { 
  generateKeypair, 
  encryptNIP44, 
  decryptNIP44 
} from 'snstr';

// Generate keypairs for Alice and Bob
const aliceKeypair = await generateKeypair();
const bobKeypair = await generateKeypair();

// Alice encrypts a message for Bob
const encrypted = encryptNIP44(
  'Hello, Bob!',
  aliceKeypair.privateKey,
  bobKeypair.publicKey
);

// Bob decrypts the message from Alice
const decrypted = decryptNIP44(
  encrypted,
  bobKeypair.privateKey,
  aliceKeypair.publicKey
);

console.log(decrypted); // 'Hello, Bob!'
```

## API Reference

### `encryptNIP44(plaintext, privateKey, publicKey, nonce?, options?)`

Encrypts a message using NIP-44 encryption (ChaCha20 + HMAC-SHA256).

- `plaintext` - The message to encrypt
- `privateKey` - Sender's private key
- `publicKey` - Recipient's public key
- `nonce` - (Optional) 32-byte nonce, will be randomly generated if not provided
- `options` - (Optional) Additional options. Currently, no specific NIP-44 options are typically needed by the user for `encrypt`, as it defaults to the current standard (v2). The `version` field within options is reserved for potential future NIP-44 versions or highly specific scenarios, and **must not** be used to select v0 or v1 for encryption.
- Returns: Base64-encoded encrypted message (NIP-44 v2)

```typescript
// Default encryption uses NIP-44 v2
const encrypted = encryptNIP44('Hello', privateKey, publicKey);
```

### `decryptNIP44(ciphertext, privateKey, publicKey)`

Decrypts a message using NIP-44 encryption.

- `ciphertext` - The encrypted message in base64 format
- `privateKey` - Recipient's private key
- `publicKey` - Sender's public key
- Returns: Decrypted message
- Throws: Error if decryption fails (wrong keys, tampered message, etc.)

**Note**: This implementation automatically detects and handles payload versions 0, 1, and 2, providing seamless backward compatibility.

### `getNIP44SharedSecret(privateKey, publicKey)`

Derives a shared secret for NIP-44 encryption.

- `privateKey` - User's private key
- `publicKey` - Other party's public key
- Returns: 32-byte shared secret as Uint8Array

### `generateNIP44Nonce()`

Generates a random 32-byte nonce for NIP-44 encryption.

- Returns: 32-byte Uint8Array

### `constantTimeEqual(a, b)`

Performs constant-time comparison of two byte arrays to prevent timing attacks.

- `a` - First byte array (Uint8Array)
- `b` - Second byte array (Uint8Array)
- Returns: 1 if arrays are equal, 0 if they differ or have different lengths

This function is used internally to validate MACs securely, but is also exposed for use in other security-critical comparisons. Using constant-time comparison is important when comparing sensitive values like MACs, signatures, or hashes to prevent timing side-channel attacks.

## Version Compatibility

This implementation follows the NIP-44 specification requirement that clients:
- **MUST** include a version byte in encrypted payloads
- **MUST** be able to decrypt versions 0 and 1
- **MUST NOT** encrypt with version 0 ("Reserved")
- **MUST NOT** encrypt with version 1 ("Deprecated and undefined")

### Version Support

| Version | Encryption | Decryption | Notes |
|---------|------------|------------|-------|
| 0 | ❌ Not Supported | ✅ Supported | Per NIP-44: "Reserved. Implementations MUST NOT encrypt with this version." Decryption is supported. |
| 1 | ❌ Not Supported | ✅ Supported | Per NIP-44: "Deprecated and undefined. Implementations MUST NOT encrypt with this version." Decryption is supported. |
| 2 | ✅ Supported (Default) | ✅ Supported | Current version, used by default for all encryption. |

### Default Behavior

- **Encryption**: All messages are encrypted with NIP-44 version 2 (the current standard).
- **Decryption**: Automatically detects and handles versions 0, 1, and 2

**Note on V0/V1 Decryption Compatibility:**
NIP-44 (Section: Decryption, Point 4) specifies that for decrypting versions 0 and 1: *"Implementations MUST be able to decrypt versions 0 and 1 for compatibility, **using the same algorithms as above** [i.e., version 2's algorithms] with the respective version byte. The `message_nonce` is 32 bytes, `mac` is 32 bytes. Clients MAY refuse to decrypt messages with these versions."*
This implementation adheres to this directive by applying the NIP-44 v2 cryptographic pipeline (including key derivation with the "nip44-v2" salt, ChaCha20, and HMAC-SHA256) when attempting to decrypt payloads marked as v0 or v1. Therefore, successful decryption of v0/v1 payloads implies they were constructed in a manner compatible with the v2 cryptographic scheme, as guided by the NIP-44 decryption instructions.

### Version Differences

Currently, all versions use the same cryptographic primitives:
- ChaCha20 for encryption
- HMAC-SHA256 for authentication
- 32-byte nonces
- 32-byte MAC tags

The primary difference is the version byte in the payload, which enables future protocol upgrades.

## Differences from NIP-04

1. **Cipher algorithm**: NIP-44 uses ChaCha20 + HMAC-SHA256 instead of AES-CBC
2. **Authentication**: NIP-44 includes message authentication (tamper resistance)
3. **Version byte**: NIP-44 includes a version byte for future upgradability
4. **Key derivation**: NIP-44 uses HKDF for key derivation instead of raw ECDH output
5. **Nonce handling**: NIP-44 uses 256-bit (32-byte) nonces
6. **Length concealing**: NIP-44 uses a padding scheme to partially hide message length

## Detailed Implementation

This implementation follows the NIP-44 v2 specification exactly, with careful attention to each step of the process:

### Key Constants

- `CURRENT_VERSION = 2` - Current NIP-44 version for encryption
- `MIN_SUPPORTED_VERSION = 0` - Minimum supported version for decryption
- `MAX_SUPPORTED_VERSION = 2` - Maximum supported version for decryption
- `NONCE_SIZE_V2 = 32` - 32-byte nonce as required by NIP-44 v2
- `KEY_SIZE = 32` - 32-byte key for ChaCha20
- `MAC_SIZE_V2 = 32` - 32-byte MAC from HMAC-SHA256
- `MIN_BASE64_PAYLOAD_LENGTH = 132` - Minimum base64 payload length
- `MAX_BASE64_PAYLOAD_LENGTH = 87472` - Maximum base64 payload length
- `MIN_DECODED_PAYLOAD_LENGTH = 99` - Minimum decoded payload length
- `MAX_DECODED_PAYLOAD_LENGTH = 65603` - Maximum decoded payload length

### Encryption Process

1. **Key Derivation** (NIP-44 spec section "Encryption" step 1)
   - Execute ECDH between sender's private key and recipient's public key 
   - Use HKDF-extract with SHA-256, shared_x and salt="nip44-v2" to derive conversation key

2. **Message Keys** (NIP-44 spec section "Encryption" step 3)
   - Generate message-specific keys from conversation key and nonce using HKDF-expand
   - Derive chacha_key (32 bytes), chacha_nonce (12 bytes), and hmac_key (32 bytes)

3. **Padding** (NIP-44 spec section "Encryption" step 3-4)
   - Apply padding scheme to hide message length
   - Prefix with 2-byte length (big-endian uint16)
   - Pad to specified length based on original message size

4. **Encryption** (NIP-44 spec section "Encryption" step 5)
   - Encrypt padded plaintext using ChaCha20

5. **Authentication** (NIP-44 spec section "Encryption" step 6)
   - Calculate HMAC-SHA256 of ciphertext, using nonce as associated data (AAD)

6. **Payload Construction** (NIP-44 spec section "Encryption" step 7)
   - Concatenate: [VERSION(1 byte) | NONCE(32 bytes) | CIPHERTEXT | MAC(32 bytes)]
   - Base64 encode the result

### Decryption Process

1. **Input Validation** (NIP-44 spec section "Decryption" step 1)
   - Normalize payload by trimming whitespace to prevent bypass attacks
   - Check for non-base64 encoding (# prefix detection)
   - Validate base64 alphabet (A-Z, a-z, 0-9, +, / with optional padding)
   - Validate base64 payload length (132 to 87,472 characters)
   - Validate decoded payload length (99 to 65,603 bytes)

2. **Parse Payload** (NIP-44 spec section "Decryption" step 2)
   - Decode base64 
   - Extract version byte, validate it's between 0-2
   - Extract nonce, ciphertext, and MAC based on version-specific sizes

3. **Key Derivation** (Same as encryption)
   - Calculate the same conversation key and message keys

4. **Verification** (NIP-44 spec section "Decryption" step 4)
   - Verify HMAC using constant-time comparison
   - Authenticate ciphertext before decryption

5. **Decryption** (NIP-44 spec section "Decryption" step 5-6)
   - Decrypt ciphertext with ChaCha20
   - Remove padding and extract original message

### Error Handling

The implementation includes comprehensive error handling that:
- Validates all inputs (key formats, nonce size, message length)
- Checks payload format and version with strict NIP-44 compliance
- Validates payload length bounds (base64 and decoded) 
- Detects non-base64 encoding (# prefix) as per NIP-44 specification
- Validates base64 alphabet to prevent malformed string acceptance
- Normalizes input by trimming whitespace to prevent security bypasses
- Provides informative error messages that help diagnose issues
- Properly handles authentication failures with constant-time comparison
- Includes version information in error messages for better debugging

## Testing

Run the NIP-44 tests with:

```bash
npm run test:nip44
```

Or try the demo:

```bash
npm run example:nip44
```

### Official Test Vectors

This implementation has been thoroughly validated against the official [NIP-44 test vectors](https://github.com/paulmillr/nip44/blob/main/nip44.vectors.json) to ensure 100% compatibility with other implementations. Our test suite includes:

- All test vectors from the official NIP-44 repository
- Verification of conversation key derivation from private/public key pairs
- Validation of message key derivation from conversation keys and nonces
- Confirmation of correct authentication tag (MAC) generation and verification
- End-to-end encryption/decryption validation with various message lengths
- Edge case handling (minimum and maximum message sizes)
- Error handling for invalid inputs and tampered messages
- Version compatibility tests across versions 0, 1, and 2

The official test vectors provide cryptographic certainty that our implementation correctly follows the NIP-44 specification and will interoperate with other compliant implementations.

## Security Considerations

NIP-44 encryption provides several important security properties that developers should be aware of:

1. **Authenticated Encryption**: The HMAC-SHA256 authentication ensures that messages cannot be tampered with without detection.

2. **Forward Secrecy**: While NIP-44 itself doesn't provide forward secrecy, it can be used with proper key rotation practices to improve security over time.

3. **Side-Channel Resistance**: This implementation uses constant-time comparison for MAC verification to prevent timing attacks.

4. **Message Length Privacy**: The padding scheme partially hides the original message length, providing some protection against traffic analysis.

5. **Nonce Handling**: The 32-byte nonces provide sufficient randomness to prevent collisions, but care should be taken:
   - Never reuse the same nonce with the same key
   - If manually providing nonces, ensure they come from a cryptographically secure random number generator
   - Let the library generate nonces automatically when possible

6. **Error Messages**: Consider wrapping decryption errors in generic messages in production to avoid leaking information about specific failure modes.

### Error Handling Examples

Proper error handling is essential for secure applications. Here's how to handle decryption errors:

```typescript
import { decryptNIP44 } from 'snstr';

try {
  const decrypted = decryptNIP44(
    encryptedMessage,
    recipientPrivateKey,
    senderPublicKey
  );
  // Process decrypted message
} catch (error) {
  if (error.message.includes('Authentication failed')) {
    console.error('Message may have been tampered with or keys are incorrect');
    // Handle authentication failure
  } else if (error.message.includes('Invalid payload format') || 
             error.message.includes('Invalid ciphertext length') ||
             error.message.includes('Invalid decoded payload length')) {
    console.error('Message is not in a valid NIP-44 format or exceeds size limits');
    // Handle format/length validation error
  } else if (error.message.includes('Unsupported version')) {
    console.error(`Unsupported NIP-44 version: ${error.message}`);
    // Handle version compatibility issue
  } else {
    console.error('Decryption failed:', error);
    // Handle other errors
  }
  
  // In production, consider using a generic error message:
  // displayToUser('Message could not be decrypted');
}
```

## Cross-Implementation Compatibility

This implementation has been validated against the [official NIP-44 test vectors](https://github.com/paulmillr/nip44/blob/main/nip44.vectors.json) maintained in [Paul Miller's reference repository](https://github.com/paulmillr/nip44).

Passing these test vectors ensures that this implementation correctly handles:
- Key derivation according to the NIP-44 specification
- Encryption and decryption across all supported versions (v0, v1, v2)
- Message authentication and padding as specified

## Implementation Details

The NIP-44 implementation follows the [NIP-44 specification](https://github.com/nostr-protocol/nips/blob/master/44.md) and uses the following libraries:

- `@noble/curves` for secp256k1 ECDH operations
- `@noble/hashes` for SHA-256, HMAC, and HKDF
- `@noble/ciphers` for ChaCha20 encryption

The implementation provides:

### Custom HKDF Implementation

This library implements HKDF according to RFC 5869 with two key functions:

1. `hkdfExtract`: Extracts a pseudorandom key from input key material and salt
2. `hkdfExpand`: Expands a pseudorandom key to desired length

These functions ensure compatibility with the NIP-44 specification and other implementations.

### X-only Public Key Handling

The implementation properly handles x-only public keys (the standard for Nostr) by:

1. Validating that the provided hex string represents a valid x-coordinate on the secp256k1 curve
2. Determining whether the point corresponds to an even or odd y-coordinate
3. Constructing the correct compressed format (with 02/03 prefix) for ECDH operations
4. Performing constant-time operations to avoid timing side-channels

This approach ensures compatibility with Nostr's x-only public key format while maintaining the security properties required by the NIP-44 specification. 