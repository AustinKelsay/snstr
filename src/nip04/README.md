# NIP-04: Encrypted Direct Messages

SNSTR includes a complete implementation of [NIP-04](https://github.com/nostr-protocol/nips/blob/master/04.md) for encrypted direct messaging.

## Warning: Limited Security

**Important**: NIP-04 is marked as `unrecommended` in the official Nostr specification in favor of [NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md). It has known security limitations including:

- No authentication (vulnerable to message tampering)
- Not forward secure
- Leaks message metadata
- Uses AES-CBC which may be vulnerable to padding oracle attacks
- Does not hide message length

It's recommended to use NIP-44 for new applications. NIP-04 support is provided primarily for compatibility with existing clients.

## How NIP-04 Works

1. **Key Exchange**: Uses ECDH (Elliptic Curve Diffie-Hellman) to create a shared secret between sender and recipient.
2. **Key Material**: The X coordinate of the shared point is extracted and hashed with SHA256.
3. **Encryption Algorithm**: AES-256-CBC with a random initialization vector (IV).
4. **Message Format**: `<encrypted_text>?iv=<initialization_vector>` where both parts are base64-encoded.

## Cross-Platform Compatibility

This module works in both Node and web/React Native with the same API:
- Node: uses the built-in `crypto` AES-256-CBC implementation.
- Web/RN: uses `crypto-js` (AES-256-CBC, PKCS7) — no Node modules required.
- Synchronous API in all environments (`encrypt`, `decrypt`, `getSharedSecret`).

### ESM Initialization (Node.js Only)

When using ESM imports in Node.js environments, you should call `initializeNIP04Crypto()` once at application startup:

```typescript
import { initializeNIP04Crypto, encryptNIP04, decryptNIP04 } from 'snstr';

async function main() {
  // Initialize crypto for ESM environments
  await initializeNIP04Crypto();

  // Now you can use NIP-04 functions
  const encrypted = encryptNIP04(privateKey, publicKey, 'Hello!');
}
```

**Notes:**
- **CommonJS (require)**: Initialization is optional. The module falls back to `require('crypto')` automatically.
- **Web/React Native**: Initialization is a no-op. The module uses `crypto-js` which loads synchronously.
- **ESM without initialization**: If you forget to call `initializeNIP04Crypto()` in ESM, you'll get a clear error message reminding you to initialize.

## Implementation Details

### Shared Secret Derivation

The shared secret is derived following these steps:

1. Compute the ECDH shared point using the sender's private key and recipient's public key
2. Extract only the X coordinate of the shared point
3. Use the 32-byte X coordinate directly as the AES-256 key (as used by common NIP-04 implementations). This keeps wire-compatibility with existing clients.

## Input Validation

Unlike many other implementations, our NIP-04 implementation includes robust input validation to prevent security issues:

- Validates message format (`<encrypted_text>?iv=<initialization_vector>`)
- Confirms both parts are valid base64 strings
- Verifies the IV is exactly 16 bytes (as required by AES-CBC)
- Throws specific, descriptive error messages for different validation failures

### Error Handling

The implementation uses a dedicated `NIP04DecryptionError` class for proper error identification and handling. When decrypting messages, you should handle these errors:

```typescript
import { decrypt, NIP04DecryptionError } from 'snstr';

try {
  const decrypted = decrypt(encryptedMessage, privateKey, publicKey);
  console.log('Decrypted message:', decrypted);
} catch (error) {
  if (error instanceof NIP04DecryptionError) {
    console.error('Decryption failed:', error.message);
    // Handle specific validation errors based on the message
  } else {
    console.error('Unexpected error:', error);
  }
}
```

Common validation errors include:
- `'Invalid encrypted message format: missing IV separator'`
- `'Invalid encrypted message format: multiple IV separators found'`
- `'Invalid encrypted message format: empty ciphertext or IV'`
- `'Invalid encrypted message: ciphertext is not valid base64'`
- `'Invalid encrypted message: IV is not valid base64'`
- `'Invalid IV length: expected 16 bytes, got X'`

## Basic Usage

### Basic Encryption and Decryption

```typescript
import { generateKeypair, encryptNIP04, decryptNIP04 } from 'snstr';

// Generate keypairs for Alice and Bob
const alice = await generateKeypair();
const bob = await generateKeypair();

// Alice encrypts a message for Bob
const encrypted = encryptNIP04(alice.privateKey, bob.publicKey, 'Hello Bob!');

// Bob decrypts the message from Alice
const decrypted = decryptNIP04(bob.privateKey, alice.publicKey, encrypted);
```

### Accessing the Shared Secret

If you need direct access to the shared secret:

```typescript
import { getNIP04SharedSecret } from 'snstr';
const shared = getNIP04SharedSecret(alice.privateKey, bob.publicKey); // Uint8Array(32)
```

## Direct Messaging with Events

NIP-04 messages are typically sent as Nostr events with `kind: 4` and the recipient tagged with a `p` tag.

```typescript
// Typical event content for kind 4 uses the format produced by encryptNIP04:
// "<base64-ciphertext>?iv=<base64-iv>"
// Publish and receive as usual; decrypt with decryptNIP04 when handling events.
```

## Migrating to NIP-44

For new applications, we recommend using NIP-44 instead:

```typescript
import { 
  encryptNIP44, 
  decryptNIP44 
} from 'snstr';

// Alice encrypts a message for Bob with NIP-44
const encrypted = encryptNIP44('Hello Bob!', alice.privateKey, bob.publicKey);

// Bob decrypts the message from Alice
const decrypted = decryptNIP44(encrypted, bob.privateKey, alice.publicKey);

## React Native notes

- Add `react-native-get-random-values` once at app startup to provide `crypto.getRandomValues`:
  `import 'react-native-get-random-values';`
- No Node polyfills are required; NIP‑04 uses `crypto-js` under the hood on RN.
```

NIP-44 provides stronger security with:
- Authenticated encryption (ChaCha20 with HMAC-SHA256)
- Message padding to hide length
- Proper key derivation with HKDF
- Versioning for future algorithm upgrades
