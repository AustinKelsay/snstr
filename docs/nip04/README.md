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
2. **Key Material**: Uses only the X coordinate of the shared point as encryption key material (NOT hashed).
3. **Encryption Algorithm**: AES-256-CBC with a random initialization vector (IV).
4. **Message Format**: `<encrypted_text>?iv=<initialization_vector>` where both parts are base64-encoded.

## Usage

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
  const encrypted = encryptNIP04(
    'Hello Bob, this is a secret message!',
    aliceKeypair.privateKey,
    bobKeypair.publicKey
  );
  
  console.log(`Encrypted: ${encrypted}`);
  
  // Bob decrypts the message from Alice
  const decrypted = decryptNIP04(
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
  (event) => {
    const decrypted = client.decryptDirectMessage(event);
    console.log(`Received DM: ${decrypted}`);
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
const encrypted = encryptNIP44(
  'Hello Bob!',
  aliceKeypair.privateKey,
  bobKeypair.publicKey
);

// Bob decrypts the message from Alice
const decrypted = decryptNIP44(
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