# SNSTR - Simple Nostr Software Toolkit for Retards

SNSTR is a lightweight TypeScript library for interacting with the Nostr protocol. It provides a simple, easy-to-use API with minimal dependencies.

## Features

- Connect to multiple Nostr relays
- Generate and manage keypairs
- Publish and subscribe to events
- Create and verify signed events
- Encrypt and decrypt direct messages (NIP-04)
- Create different types of events (notes, metadata, DMs)

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

## Testing

The project includes a comprehensive test suite to verify all functionality.

### Test Structure

- **Unit Tests**: Testing individual functions and classes
  - `crypto.test.ts`: Tests for cryptographic functions
  - `event.test.ts`: Tests for event creation and manipulation
  - `relay.test.ts`: Tests for the Relay class
  - `nostr.test.ts`: Tests for the Nostr client
  
- **Integration Tests**: Tests that simulate real usage
  - `integration.test.ts`: End-to-end tests of real workflows

> **Note:** Some tests related to WebSocket behavior are currently skipped and marked for improvement in future releases.

### Running Tests

Run all tests:

```bash
npm test
```

Run a specific test file:

```bash
npm test -- tests/crypto.test.ts
```

Run integration tests (requires connection to public relays):

```bash
RUN_INTEGRATION_TESTS=true npm test -- tests/integration.test.ts
```

### Test Coverage

The test suite aims for high coverage of all critical paths and edge cases:

- Key generation and management
- Event signing and verification 
- NIP-04 encryption/decryption
- Relay connections and reconnection behavior
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
```

## License

MIT