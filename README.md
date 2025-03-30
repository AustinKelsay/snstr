# SNSTR - Simple Nostr Software Toolkit for Retards
### Still Under Construction 🚧

SNSTR is a lightweight TypeScript library for interacting with the Nostr protocol. It provides a simple, easy-to-use API with minimal dependencies.

## Features

- Connect to multiple Nostr relays
- Generate and manage keypairs
- Publish and subscribe to events
- Create and verify signed events
- Encrypt and decrypt direct messages (NIP-04)
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
    'wss://relay.damus.io',
    'wss://relay.nostr.info'
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

## Testing

The project includes a comprehensive test suite that uses the ephemeral relay for all tests, eliminating the need for external connections during testing.

### Test Structure

- **Unit Tests**: Testing individual functions and classes
  - `crypto.test.ts`: Tests for cryptographic functions
  - `event.test.ts`: Tests for event creation and manipulation
  - `relay.test.ts`: Tests for the Relay class using ephemeral relay
  - `nostr.test.ts`: Tests for the Nostr client using ephemeral relay
  
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

### Test Coverage

The test suite aims for high coverage of all critical paths and edge cases:

- Key generation and management
- Event signing and verification 
- NIP-04 encryption/decryption
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
# Basic example
npm run example

# Direct messaging example
npm run example:dm

# Cryptography demo
npm run example:crypto

# Examples with ephemeral relay and verbose logging
npm run example:ephemeral
npm run example:ephemeral:dm

# Test encryption/decryption directly
npm run test:encryption
```

## License

MIT
