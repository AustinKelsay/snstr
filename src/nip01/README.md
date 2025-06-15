# NIP-01: Basic Protocol Flow Specification

This directory contains the implementation of [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md), which defines the core protocol functionality of Nostr.

## Overview

NIP-01 is the foundational specification for Nostr, outlining the basic protocol flow, event format, relay communication, and subscription mechanism. This implementation provides a complete client and relay interface with comprehensive validation for Nostr events.

## Key Features

- ✅ **Event Creation and Validation**: Full support for creating, signing, and validating Nostr events
- ✅ **Relay Communication**: WebSocket-based connection management with automatic reconnection
- ✅ **Subscription Management**: Rich filter-based subscription system
- ✅ **Timestamp Verification**: Event timestamp validation with configurable drift tolerance
- ✅ **Ephemeral Relay**: Built-in relay implementation for testing and development

## Basic Usage

### Creating and Publishing Events

```typescript
import { Nostr } from 'snstr';

// Initialize client with relays
const client = new Nostr(['wss://relay.nostr.band']);

// Generate or import keys
const keys = await client.generateKeys();
// or
const keys = client.importKeys('privateKeyHex');

// Connect to relays
await client.connectToRelays();

// Publish a text note
const event = await client.publishTextNote('Hello, Nostr!');
console.log(`Published event with ID: ${event.id}`);
```

### Subscribing to Events

```typescript
import { Nostr, RelayEvent } from 'snstr';

const client = new Nostr(['wss://relay.nostr.band']);

// Connect to relays
await client.connectToRelays();

// Set up connection event handlers
client.on(RelayEvent.Connect, (relay) => {
  console.log(`Connected to ${relay}`);
});

// Subscribe with filters
const subIds = client.subscribe(
  [{ kinds: [1], limit: 10 }], // Filter for text notes, limited to 10
  (event, relay) => {
    console.log(`Received event from ${relay}:`, event);
  }
);

// Later, unsubscribe
client.unsubscribe(subIds);
```

### Querying Events Across Relays

```typescript
import { Nostr } from 'snstr';

const client = new Nostr(['wss://relay.nostr.band', 'wss://nos.lol']);
await client.connectToRelays();

// Fetch multiple events from all connected relays
const events = await client.fetchMany(
  [
    { kinds: [1], authors: ['pubkey1'], limit: 10 },
    { kinds: [0], authors: ['pubkey1'] } // Profile metadata
  ],
  { maxWait: 5000 } // Maximum wait time in milliseconds
);

console.log(`Retrieved ${events.length} events`);

// Fetch the most recent single event matching filters
const latestEvent = await client.fetchOne(
  [{ kinds: [1], authors: ['pubkey1'] }],
  { maxWait: 3000 }
);

if (latestEvent) {
  console.log('Latest event:', latestEvent.content);
}
```

#### Key Features of fetchMany and fetchOne

- **Cross-relay aggregation**: Automatically queries all connected relays and deduplicates results
- **Timeout handling**: Configurable `maxWait` option prevents hanging queries (defaults to 5000ms)
- **Event ordering**: `fetchOne` returns the newest event based on `created_at` timestamp
- **Automatic cleanup**: Subscriptions are automatically closed after completion
- **Error resilience**: Individual relay failures don't affect the overall query

### Working with Events Directly

```typescript
import { createEvent } from 'snstr';
import { validateEvent } from 'snstr/nip01/event';

// Create an event
const event = createEvent({
  kind: 1,
  content: 'Hello, world!',
  tags: [['p', 'pubkeyHex', 'recommended relay URL']],
  privateKey: 'privateKeyHex'
});

// Verify an event
const isValid = await validateEvent(event);
```

## Implementation Details

### Files in this Directory

- **event.ts**: Event creation, validation, and utility functions
- **nostr.ts**: Main Nostr client implementation
- **relay.ts**: Relay connection and subscription management

### Event Validation

This implementation enforces strict validation rules:

1. Event IDs are verified against the serialized event content
2. Signatures are verified against the event ID and public key
3. Timestamps are validated with configurable drift allowance
4. Content and tag format validation based on event kinds

### WebSocket Management

The relay connection includes:

1. Automatic reconnection with configurable backoff
2. Connection pooling for efficient relay communication
3. Message queue for handling offline scenarios
4. Proper subscription management across reconnects

### RelayPool Management

The `RelayPool` class provides advanced multi-relay management with intelligent connection handling, automatic failover, and efficient resource management.

#### Key Features

- **Dynamic Relay Management**: Add and remove relays at runtime
- **Connection Pooling**: Efficient connection reuse and management
- **Automatic Failover**: Graceful handling of relay failures
- **Batch Operations**: Publish and query across multiple relays simultaneously
- **Resource Cleanup**: Proper connection cleanup and memory management

#### Basic RelayPool Usage

```typescript
import { RelayPool } from 'snstr/nip01/relayPool';

// Initialize with multiple relays
const pool = new RelayPool([
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.damus.io'
]);

// Add additional relays dynamically
pool.addRelay('wss://relay.snort.social');

// Publish to multiple relays
const event = createEvent({
  kind: 1,
  content: 'Hello from RelayPool!',
  tags: [],
  privateKey: 'your-private-key'
});

const publishPromises = pool.publish(['wss://relay.nostr.band', 'wss://nos.lol'], event);
const results = await Promise.all(publishPromises);

// Subscribe across multiple relays
const subscription = await pool.subscribe(
  ['wss://relay.nostr.band', 'wss://nos.lol'],
  [{ kinds: [1], limit: 10 }],
  (event, relayUrl) => {
    console.log(`Received event from ${relayUrl}:`, event);
  },
  () => {
    console.log('All relays finished sending stored events');
  }
);

// Query for events synchronously
const events = await pool.querySync(
  ['wss://relay.nostr.band', 'wss://nos.lol'],
  { kinds: [1], authors: ['pubkey'], limit: 5 },
  { timeout: 10000 }
);

// Get a single event (most recent)
const latestEvent = await pool.get(
  ['wss://relay.nostr.band', 'wss://nos.lol'],
  { kinds: [1], authors: ['pubkey'] },
  { timeout: 5000 }
);

// Cleanup
await pool.close();
```

#### Advanced RelayPool Configuration

```typescript
import { RelayPool, RemoveRelayResult } from 'snstr/nip01/relayPool';

// Initialize with connection options
const pool = new RelayPool(
  ['wss://relay.nostr.band'],
  {
    relayOptions: {
      connectionTimeout: 10000,
      autoReconnect: true,
      maxReconnectAttempts: 5,
      maxReconnectDelay: 30000,
      bufferFlushDelay: 1000
    }
  }
);

// Add relay with specific options
const relay = pool.addRelay('wss://nos.lol', {
  connectionTimeout: 5000,
  autoReconnect: false
});

// Ensure relay connection
const connectedRelay = await pool.ensureRelay('wss://relay.damus.io');

// Remove relay with error handling
const removeResult = pool.removeRelay('wss://invalid-relay.com');
switch (removeResult) {
  case RemoveRelayResult.Removed:
    console.log('Relay successfully removed');
    break;
  case RemoveRelayResult.NotFound:
    console.log('Relay was not in the pool');
    break;
  case RemoveRelayResult.InvalidUrl:
    console.log('Invalid relay URL provided');
    break;
}

// Close specific relays
await pool.close(['wss://relay.nostr.band', 'wss://nos.lol']);
```

#### Error Handling and Resilience

```typescript
import { RelayPool } from 'snstr/nip01/relayPool';

const pool = new RelayPool([
  'wss://relay.nostr.band',
  'wss://invalid-relay.com', // This will fail gracefully
  'wss://nos.lol'
]);

// Subscribe with error handling
const subscription = await pool.subscribe(
  ['wss://relay.nostr.band', 'wss://invalid-relay.com', 'wss://nos.lol'],
  [{ kinds: [1], limit: 10 }],
  (event, relayUrl) => {
    console.log(`Event from ${relayUrl}:`, event);
  },
  () => {
    console.log('EOSE received from all successful relays');
  }
);

// Query with timeout and error handling
try {
  const events = await pool.querySync(
    ['wss://relay.nostr.band', 'wss://unreliable-relay.com'],
    { kinds: [1], limit: 5 },
    { timeout: 5000 } // 5 second timeout
  );
  console.log(`Retrieved ${events.length} events`);
} catch (error) {
  console.error('Query failed:', error);
}

// Cleanup
subscription.close();
await pool.close();
```

#### RelayPool vs Direct Relay Usage

Use RelayPool when you need:
- **Multi-relay operations**: Publishing or querying across multiple relays
- **Automatic failover**: Resilience against individual relay failures  
- **Dynamic relay management**: Adding/removing relays at runtime
- **Batch operations**: Efficient handling of multiple relay connections
- **Resource management**: Automatic cleanup and connection pooling

Use direct Relay class when you need:
- **Single relay focus**: Working with one specific relay
- **Fine-grained control**: Detailed control over individual relay behavior
- **Custom connection handling**: Specific reconnection or error handling logic

## Security Considerations

- Private keys are never exposed outside the library
- Event validation follows NIP-01 requirements strictly
- All inputs are validated to prevent injection attacks
- WebSocket connections are properly managed to prevent leaks

## Advanced Usage

### Custom Event Handlers

```typescript
import { Nostr, RelayEvent } from 'snstr';

const client = new Nostr(['wss://relay.nostr.band']);

// Handle various relay events
client.on(RelayEvent.Connect, (relay) => {
  console.log(`Connected to ${relay}`);
});

client.on(RelayEvent.Disconnect, (relay) => {
  console.log(`Disconnected from ${relay}`);
});

client.on(RelayEvent.Error, (relay, error) => {
  console.error(`Error from ${relay}:`, error);
});

client.on(RelayEvent.Notice, (relay, message) => {
  console.log(`Notice from ${relay}:`, message);
});
```

### Custom Filters

```typescript
import { Nostr } from 'snstr';

const client = new Nostr(['wss://relay.nostr.band']);
await client.connectToRelays();

// Complex filtering
const subIds = client.subscribe([
  { 
    kinds: [1], 
    authors: ['pubkey1', 'pubkey2'],
    since: Math.floor(Date.now() / 1000) - 86400, // Last 24 hours
    limit: 50
  },
  {
    kinds: [3], // Contact lists
    authors: ['pubkey1']
  }
], (event) => {
  console.log('Received event:', event);
});
``` 