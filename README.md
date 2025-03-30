# SNSTR - Simple Nostr Software Toolkit for Retards
### Still Under Construction 🚧

SNSTR is a lightweight TypeScript library for interacting with the Nostr protocol. It provides a simple, easy-to-use API with minimal dependencies.

## Features

- Connect to multiple Nostr relays
- Generate and manage keypairs
- Publish and subscribe to events
- Create and verify signed events
- Encrypt and decrypt direct messages (NIP-04 and NIP-44)
- Create different types of events (notes, metadata, DMs)
- Built-in ephemeral relay for testing and development

## Installation

```bash
npm install snstr
```

## Basic Usage

```typescript
import { Nostr, RelayEvent } from 'snstr';

async function main() {
  // Initialize with relays
  const client = new Nostr([
    'wss://relay.primal.net',
    'wss://relay.nostr.band'
  ]);

  // Generate keypair
  const keys = await client.generateKeys();
  console.log('Public key:', keys.publicKey);

  // Connect to relays
  await client.connectToRelays();
  
  // Set up event handlers
  client.on(RelayEvent.Connect, (relay) => {
    console.log(`Connected to ${relay}`);
  });

  // Publish a note
  const note = await client.publishTextNote('Hello, Nostr!');
  console.log(`Published note with ID: ${note?.id}`);

  // Subscribe to events
  const subIds = client.subscribe(
    [{ kinds: [1], limit: 10 }], // Filter for text notes
    (event, relay) => {
      console.log(`Received event from ${relay}:`, event);
    }
  );

  // Cleanup
  setTimeout(() => {
    client.unsubscribe(subIds);
    client.disconnectFromRelays();
  }, 10000);
}

main().catch(console.error);
```

## Using the Ephemeral Relay

SNSTR includes a built-in ephemeral relay for testing and development that doesn't require external connections. All data remains in-memory and can be automatically purged at regular intervals.

```typescript
import { Nostr } from 'snstr';
import { NostrRelay } from 'snstr/utils/ephemeral-relay';

async function main() {
  // Start an ephemeral relay on port 3000
  const relay = new NostrRelay(3000, 60); // Purge events every 60 seconds
  await relay.start();
  
  // Connect to the ephemeral relay using its url property
  const client = new Nostr([relay.url]);
  await client.generateKeys();
  await client.connectToRelays();
  
  // Use the client as normal
  const note = await client.publishTextNote('Hello, ephemeral world!');
  
  // Clean up
  setTimeout(() => {
    client.disconnectFromRelays();
    relay.close();
  }, 5000);
}

main().catch(console.error);
```

### Debugging and Verbosity

The ephemeral relay supports different logging levels:

```typescript
// Enable verbose logging
process.env.VERBOSE = 'true';

// For even more detailed debug output
process.env.DEBUG = 'true';

// Or use the provided npm scripts
// npm run example:ephemeral     - Run with verbose logging
// npm run example:debug         - Run with debug logging
```

## Direct Messaging Example

```typescript
import { Nostr } from 'snstr';
import { NostrRelay } from 'snstr/utils/ephemeral-relay';

async function main() {
  // Start an ephemeral relay
  const relay = new NostrRelay(3001, 60);
  await relay.start();
  
  // Create two clients (Alice and Bob)
  const alice = new Nostr([relay.url]);
  const bob = new Nostr([relay.url]);
  
  // Generate keys for both
  const aliceKeys = await alice.generateKeys();
  const bobKeys = await bob.generateKeys();
  
  // Connect both to the relay
  await Promise.all([
    alice.connectToRelays(),
    bob.connectToRelays()
  ]);
  
  // Bob subscribes to receive messages
  bob.subscribe(
    [{ kinds: [4], '#p': [bobKeys.publicKey] }],
    (event) => {
      try {
        // Decrypt incoming messages
        const decrypted = bob.decryptDirectMessage(event);
        console.log(`Bob received: ${decrypted}`);
      } catch (error) {
        console.error('Failed to decrypt message');
      }
    }
  );
  
  // Alice sends an encrypted message to Bob
  const dmEvent = await alice.publishDirectMessage(
    "Hello Bob! This is a secret message.",
    bobKeys.publicKey
  );
  
  // Clean up after 5 seconds
  setTimeout(() => {
    alice.disconnectFromRelays();
    bob.disconnectFromRelays();
    relay.close();
  }, 5000);
}

main().catch(console.error);
```

## Encryption with NIP-44

SNSTR includes a complete implementation of [NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md), which provides more secure direct messaging encryption than the older NIP-04 standard. NIP-44 uses ChaCha20 with HMAC-SHA256 authentication to prevent tampering.

```typescript
import { 
  generateKeypair, 
  encryptNIP44, 
  decryptNIP44 
} from 'snstr';

async function main() {
  // Generate keypairs for Alice and Bob
  const aliceKeypair = await generateKeypair();
  const bobKeypair = await generateKeypair();
  
  // Alice encrypts a message for Bob
  const encrypted = encryptNIP44(
    'Hello Bob, this is a secure message!',
    aliceKeypair.privateKey,
    bobKeypair.publicKey
  );
  
  console.log(`Encrypted: ${encrypted}`);
  
  // Bob decrypts the message from Alice
  const decrypted = decryptNIP44(
    encrypted,
    bobKeypair.privateKey,
    aliceKeypair.publicKey
  );
  
  console.log(`Decrypted: ${decrypted}`);
}

main().catch(console.error);
```

### Key Features of NIP-44 Implementation

- **Authenticated Encryption**: Uses ChaCha20 + HMAC-SHA256 to prevent message tampering
- **Message Length Hiding**: Pads messages to hide their exact length
- **Proper Key Derivation**: Uses HKDF instead of raw ECDH output for better security
- **Forward-Compatible**: Includes version byte for future algorithm upgrades
- **Constant-Time Operations**: Prevents timing attacks during cryptographic operations
- **Comprehensive Validation**: Thorough input validation and error handling
- **Test Vectors**: Validated against official NIP-44 test vectors

## Using Public Relays vs Ephemeral Relay

The examples in SNSTR can run with either the built-in ephemeral relay or connect to public Nostr relays. This is controlled by the `USE_EPHEMERAL` environment variable:

```typescript
// In your code:
const USE_EPHEMERAL = process.env.USE_EPHEMERAL !== 'false';

// Then conditionally create clients
let client: Nostr;
if (USE_EPHEMERAL) {
  // Use ephemeral relay
  const ephemeralRelay = new NostrRelay(3000);
  await ephemeralRelay.start();
  client = new Nostr([ephemeralRelay.url]);
} else {
  // Use public relays
  client = new Nostr(['wss://relay.primal.net', 'wss://relay.nostr.band']);
}
```

The library includes scripts for both approaches:

```bash
# Run with ephemeral relay (default)
npm run example:ephemeral
npm run example:ephemeral:dm

# Run with public relays (Primal.net and Nostr.band)
npm run example:public
npm run example:public:dm
```

## Testing

The project includes a comprehensive test suite that uses the ephemeral relay for all tests, eliminating the need for external connections during testing.

### Test Structure

- **Unit Tests**: Testing individual functions and classes
  - `crypto.test.ts`: Tests for cryptographic functions
  - `event.test.ts`: Tests for event creation and manipulation
  - `relay.test.ts`: Tests for the Relay class using ephemeral relay
  - `nostr.test.ts`: Tests for the Nostr client using ephemeral relay
  
- **NIP-44 Tests**: Tests for the NIP-44 encryption implementation
  - `nip44/nip44-compatibility.test.ts`: Compatibility with official NIP-44 spec
  - `nip44/nip44-official-vectors.test.ts`: Tests against official test vectors
  - `nip44/nip44-padding-hmac.test.ts`: Tests for padding and HMAC implementation
  - `nip44/nip44-vectors.test.ts`: Additional test cases for robustness
  
- **Integration Tests**: Tests that simulate real usage
  - `integration.test.ts`: End-to-end tests using ephemeral relay

### Running Tests

Run all tests:

```bash
npm test
```

Run a specific test file:

```bash
npm test -- tests/crypto.test.ts
```

Run just the NIP-44 tests:

```bash
npm test -- tests/nip44
```

### Test Coverage

The test suite aims for high coverage of all critical paths and edge cases:

- Key generation and management
- Event signing and verification 
- NIP-04 encryption/decryption
- NIP-44 encryption/decryption
- Relay connections and behavior
- Event publishing and subscription
- Error handling

## Development

### Building the project

```bash
npm run build
```

### Running examples

```bash
# Basic example (default ephemeral relay)
npm run example

# Direct messaging example (default ephemeral relay)
npm run example:dm

# Cryptography demo
npm run example:crypto

# NIP-44 encryption demo
npm run example:nip44

# Examples with ephemeral relay and verbose logging
npm run example:ephemeral
npm run example:ephemeral:dm

# Examples with public relays (Primal.net and Nostr.band)
npm run example:public
npm run example:public:dm

# Test encryption/decryption
npm run test:encryption   # Run NIP-04 tests
npm run test:nip44        # Run NIP-44 tests
```

## Encryption Support

SNSTR supports both NIP-04 and NIP-44 encryption schemes for direct messages:

### NIP-04 (AES-CBC)

```typescript
import { generateKeypair, encryptMessage, decryptMessage } from 'snstr';

const aliceKeypair = await generateKeypair();
const bobKeypair = await generateKeypair();

// Alice encrypts a message for Bob
const encrypted = encryptMessage(
  'Hello Bob!',
  aliceKeypair.privateKey,
  bobKeypair.publicKey
);

// Bob decrypts the message from Alice
const decrypted = decryptMessage(
  encrypted,
  bobKeypair.privateKey,
  aliceKeypair.publicKey
);
```

### NIP-44 (XChaCha20-Poly1305)

```typescript
import { generateKeypair, encryptNIP44, decryptNIP44 } from 'snstr';

const aliceKeypair = await generateKeypair();
const bobKeypair = await generateKeypair();

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

For more details on the NIP-44 implementation, see [README-NIP44.md](README-NIP44.md).

## License

MIT
