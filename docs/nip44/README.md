# NIP-44 Encryption Implementation

This is an implementation of [NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md), which defines a new encryption scheme for Nostr direct messages.

## Overview

NIP-44 replaces the older NIP-04 encryption with a more secure approach using ChaCha20 + HMAC-SHA256. This implementation provides:

- Better security properties with authenticated encryption
- Protection against tampering via HMAC-SHA256 authentication
- Future-proof design with a version byte for upgradability
- Proper key derivation using HKDF
- Message length hiding via a custom padding scheme
- Secure nonce handling with 32-byte nonces

## Usage

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

### `encryptNIP44(plaintext, privateKey, publicKey, nonce?)`

Encrypts a message using NIP-44 encryption (ChaCha20 + HMAC-SHA256).

- `plaintext` - The message to encrypt
- `privateKey` - Sender's private key
- `publicKey` - Recipient's public key
- `nonce` - (Optional) 32-byte nonce, will be randomly generated if not provided
- Returns: Base64-encoded encrypted message

### `decryptNIP44(ciphertext, privateKey, publicKey)`

Decrypts a message using NIP-44 encryption.

- `ciphertext` - The encrypted message in base64 format
- `privateKey` - Recipient's private key
- `publicKey` - Sender's public key
- Returns: Decrypted message
- Throws: Error if decryption fails (wrong keys, tampered message, etc.)

### `getNIP44SharedSecret(privateKey, publicKey)`

Derives a shared secret for NIP-44 encryption.

- `privateKey` - User's private key
- `publicKey` - Other party's public key
- Returns: 32-byte shared secret as Uint8Array

### `generateNIP44Nonce()`

Generates a random 32-byte nonce for NIP-44 encryption.

- Returns: 32-byte Uint8Array

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

- `VERSION = 2` - Indicates NIP-44 v2 protocol
- `NONCE_SIZE = 32` - 32-byte nonce as required by NIP-44 v2
- `KEY_SIZE = 32` - 32-byte key for ChaCha20
- `MAC_SIZE = 32` - 32-byte MAC from HMAC-SHA256

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

1. **Parse Payload** (NIP-44 spec section "Decryption" step 2)
   - Decode base64 
   - Extract version byte, validate it equals 2
   - Extract nonce, ciphertext, and MAC

2. **Key Derivation** (Same as encryption)
   - Calculate the same conversation key and message keys

3. **Verification** (NIP-44 spec section "Decryption" step 4)
   - Verify HMAC using constant-time comparison
   - Authenticate ciphertext before decryption

4. **Decryption** (NIP-44 spec section "Decryption" step 5-6)
   - Decrypt ciphertext with ChaCha20
   - Remove padding and extract original message

### Error Handling

The implementation includes comprehensive error handling that:
- Validates all inputs (key formats, nonce size, message length)
- Checks payload format and version
- Provides informative error messages that help diagnose issues
- Properly handles authentication failures with constant-time comparison

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

The official test vectors provide cryptographic certainty that our implementation correctly follows the NIP-44 specification and will interoperate with other compliant implementations.

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

The implementation is contained in `src/utils/nip44.ts` and exports all necessary functions for encryption and decryption. 