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

Our implementation:
- Uses the Web Crypto API which works in both browsers and Node.js
- Does not rely on Node-specific modules like the built-in 'crypto' module
- Properly implements the SHA256 hashing of the shared secret as specified in NIP-04
- Provides consistent behavior across all environments
- Uses HMAC-SHA256 with the key "nip04" for shared secret derivation, ensuring compatibility with nostr-tools

## Implementation Details

### Shared Secret Derivation

The shared secret is derived following these steps:

1. Compute the ECDH shared point using the sender's private key and recipient's public key
2. Extract only the X coordinate of the shared point
3. Hash the X coordinate using HMAC-SHA256 with the key "nip04"
   - This follows the nip04 spec compliant convention for compatibility
   - While the NIP-04 spec doesn't specify HMAC, this approach has become the de facto standard

This derivation method ensures compatibility with other Nostr implementations, particularly nip04 spec compliant libraries and clients.

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
import { 
  generateKeypair,
  encryptNIP04, 
  decryptNIP04 
} from 'snstr';

async function main() {
  // Generate keypairs for Alice and Bob
  const aliceKeypair = await generateKeypair();
  const bobKeypair = await generateKeypair();
  
  // Alice encrypts a message for Bob
  const encrypted = await encryptNIP04(
    'Hello Bob, this is a secret message!',
    aliceKeypair.privateKey,
    bobKeypair.publicKey
  );
  
  console.log(`Encrypted: ${encrypted}`);
  
  // Bob decrypts the message from Alice
  const decrypted = await decryptNIP04(
    encrypted,
    bobKeypair.privateKey,
    aliceKeypair.publicKey
  );
  
  console.log(`Decrypted: ${decrypted}`);
}
```

### Accessing the Shared Secret

If you need direct access to the shared secret:

```typescript
import { getNIP04SharedSecret } from 'snstr';

// Get the shared secret between Alice and Bob
const sharedSecret = getNIP04SharedSecret(
  aliceKeypair.privateKey,
  bobKeypair.publicKey
);
```

## Direct Messaging with Events

NIP-04 messages are typically sent as Nostr events with `kind: 4` and the recipient tagged with a `p` tag.

```typescript
import { Nostr } from 'snstr';

const client = new Nostr(['wss://relay.example.com']);
await client.generateKeys();

// Send a direct message
const event = await client.publishDirectMessage(
  'Hello, this is a private message',
  recipientPubkey
);

// Listen for direct messages
client.subscribe(
  [{ kinds: [4], '#p': [client.publicKey] }], 
  async (event) => {
    try {
      const decrypted = await client.decryptDirectMessage(event);
      console.log(`Received DM: ${decrypted}`);
    } catch (error) {
      console.error('Failed to decrypt message:', error.message);
    }
  }
);
```

## Migrating to NIP-44

For new applications, we recommend using NIP-44 instead:

```typescript
import { 
  encryptNIP44, 
  decryptNIP44 
} from 'snstr';

// Alice encrypts a message for Bob with NIP-44
const encrypted = await encryptNIP44(
  'Hello Bob!',
  aliceKeypair.privateKey,
  bobKeypair.publicKey
);

// Bob decrypts the message from Alice
const decrypted = await decryptNIP44(
  encrypted,
  bobKeypair.privateKey,
  aliceKeypair.publicKey
);
```

NIP-44 provides stronger security with:
- Authenticated encryption (ChaCha20 with HMAC-SHA256)
- Message padding to hide length
- Proper key derivation with HKDF
- Versioning for future algorithm upgrades
