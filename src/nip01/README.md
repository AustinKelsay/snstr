# NIP-01: Basic Protocol Flow Specification

This directory contains the implementation of [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md), which defines the core protocol functionality of Nostr.

## Overview

NIP-01 is the foundational specification for Nostr, outlining the basic protocol flow, event format, relay communication, and subscription mechanism. This implementation provides a complete client and relay interface with comprehensive validation for Nostr events.

## Key Components

- ✅ **Event Creation and Validation**: Full support for creating, signing, and validating Nostr events
- ✅ **Relay Communication**: WebSocket-based connection management with automatic reconnection
- ✅ **Subscription Management**: Rich filter-based subscription system
- ✅ **Timestamp Verification**: Event timestamp validation with configurable drift tolerance
- ✅ **Ephemeral Relay**: Built-in relay implementation for testing and development

## Basic Usage

### Creating and Publishing Events

```typescript
import { Nostr } from '../nip01/nostr';

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
import { Nostr, RelayEvent } from '../nip01/nostr';

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

### Working with Events Directly

```typescript
import { createEvent, verifyEvent } from '../nip01/event';

// Create an event
const event = createEvent({
  kind: 1,
  content: 'Hello, world!',
  tags: [['p', 'pubkeyHex', 'recommended relay URL']],
  privateKey: 'privateKeyHex'
});

// Verify an event
const isValid = await verifyEvent(event);
```

## Implementation Details

### Files in this Directory

- **event.ts**: Event creation, validation, and utility functions
- **nostr.ts**: Main Nostr client implementation
- **relay.ts**: Relay connection and subscription management
- **relay-connection.ts**: WebSocket connection handling with reconnection logic

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

## Security Considerations

- Private keys are never exposed outside the library
- Event validation follows NIP-01 requirements strictly
- All inputs are validated to prevent injection attacks
- WebSocket connections are properly managed to prevent leaks

## Advanced Usage

### Custom Event Handlers

```typescript
import { Nostr, RelayEvent } from '../nip01/nostr';

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
import { Nostr } from '../nip01/nostr';

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