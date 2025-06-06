# SNSTR Type System

This directory contains TypeScript type definitions used throughout the SNSTR library. These types are designed to provide strong typing and documentation for the Nostr protocol according to the NIP specifications.

## Core Types

### `nostr.ts`

Contains the fundamental types for Nostr events and communication:

- **`NostrEvent`**: Represents a complete Nostr event as defined in [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md)
- **`EventTemplate`**: Used for creating events before they are signed
- **`NostrFilter`**: Defines filters for querying events from relays
- **`Filter`**: Extended filter type with support for custom tag filters
- **`Subscription`**: Represents an active subscription to a relay
- **`RelayEvent`**: Enum of possible relay events (connect, disconnect, error, etc.)
- **`RelayEventHandler`**: Type for relay event handler functions
- **`PublishOptions`**: Options for publishing events to relays
- **`PublishResponse`**: Response from a relay after publishing an event
- **`SubscriptionOptions`**: Options for subscribing to events
- **`SubscriptionResponse`**: Response from a subscription operation
- **`RelayStatus`**: Enum for relay connection statuses
- **`NostrKind`**: Enum of standard Nostr event kinds
- **`RelayInfo`**: Relay information document as defined in NIP-11
- **`RelayStats`**: Statistics about a relay connection
- **`RelayGroup`**: Group of relays with specific purposes (read, write, fallback)
- **`WebSocketReadyState`**: Constants for WebSocket connection states
- **`ReconnectionStrategy`**: Configuration for relay reconnection behavior
- **`RelayCapabilities`**: Features and capabilities supported by a relay
- **`MetricsCollectorOptions`**: Configuration for relay performance metrics
- **`RelayMessageStats`**: Statistics about relay message processing
- **`RelayDebugOptions`**: Configuration for relay debugging and logging

### `protocol.ts`

Contains types for the Nostr protocol messages and communication:

- **`NostrEventMessage`**: ["EVENT", subscription_id, event] message format
- **`NostrReqMessage`**: ["REQ", subscription_id, ...filters] message format
- **`NostrCloseMessage`**: ["CLOSE", subscription_id] message format
- **`NostrOkMessage`**: ["OK", event_id, success, message] message format
- **`NostrEoseMessage`**: ["EOSE", subscription_id] message format
- **`NostrNoticeMessage`**: ["NOTICE", message] message format
- **`NostrAuthMessage`**: ["AUTH", challenge] message format (NIP-42)
- **`NostrMessage`**: Union type of all message types
- **`RelayConnectionOptions`**: Options for configuring relay connections

## Usage Examples

### Advanced Relay Configuration

```typescript
import { 
  Relay, 
  ReconnectionStrategy, 
  RelayDebugOptions,
  MetricsCollectorOptions,
  WebSocketReadyState 
} from '../types/nostr';

// Configure advanced reconnection strategy
const reconnectionStrategy: ReconnectionStrategy = {
  enabled: true,
  maxAttempts: 5,
  initialDelay: 1000,  // 1 second initial delay
  maxDelay: 60000,     // Max 1 minute between attempts
  backoffFactor: 2,    // Double the delay with each attempt 
  useJitter: true,     // Add randomness to delay
  jitterFactor: 0.3    // +/- 30% variation in delay
};

// Configure debug options
const debugOptions: RelayDebugOptions = {
  verbose: true,
  logConnections: true,
  logSubscriptions: true,
  logEvents: false,
  logMessages: false,
  logValidationFailures: true,
  trackErrors: true,
  recordMessageHistory: false,
  maxMessageHistory: 100
};

// Configure metrics collection
const metricsOptions: MetricsCollectorOptions = {
  enabled: true,
  sampleInterval: 5000,  // Collect metrics every 5 seconds
  maxSamples: 1000,      // Keep the last 1000 samples
  trackMessages: true,
  trackLatency: true,
  trackBandwidth: true,
  customMetrics: {
    // Add custom metrics
    handshakeTime: (relay) => relay.lastHandshakeTime || 0,
    authRequired: (relay) => relay.capabilities?.requiresAuthentication || false
  }
};

// Create the relay
const relay = new Relay('wss://relay.example.com', {
  connectionTimeout: 5000,
  autoReconnect: true,
  maxReconnectAttempts: 5,
  maxReconnectDelay: 30000
});

// Connect to the relay
const connected = await relay.connect();

// Check WebSocket state
if ((relay as any).ws.readyState === WebSocketReadyState.OPEN) {
  console.log('Connected successfully');
}
```

### Handling NostrEvents with NostrKind

```typescript
import { NostrEvent, NostrKind } from '../types/nostr';

function processEvent(event: NostrEvent) {
  console.log(`Event kind: ${event.kind}, from: ${event.pubkey.slice(0, 8)}...`);
  
  // Using the NostrKind enum for clearer code
  if (event.kind === NostrKind.Metadata) {
    console.log('This is a profile metadata event');
  } else if (event.kind === NostrKind.ShortNote) {
    console.log('This is a text note');
  } else if (event.kind === NostrKind.DirectMessage) {
    console.log('This is an encrypted DM');
  } else if (event.kind === NostrKind.Contacts) {
    console.log('This is a contact list');
  } else if (event.kind === NostrKind.Reaction) {
    console.log('This is a reaction');
  }
  
  // Process replaceable events (NIP-01)
  if (event.kind === 0 || event.kind === 3 || (event.kind >= 10000 && event.kind < 20000)) {
    console.log('This is a replaceable event');
  }
  
  // Process addressable events (NIP-01 parameterized replaceable events)
  if (event.kind >= 30000 && event.kind < 40000) {
    const dTag = event.tags.find(tag => tag[0] === 'd')?.[1] || '';
    console.log(`Addressable event with d tag value: ${dTag}`);
  }
}
```

### Creating Filters

```typescript
import { Filter, NostrKind } from '../types/nostr';

// Query recent text notes from specific authors
const textNotesFilter: Filter = {
  kinds: [NostrKind.ShortNote],
  authors: ['pubkey1', 'pubkey2'],
  since: Math.floor(Date.now() / 1000) - 86400, // Last 24 hours
  limit: 20
};

// Query specific hashtags
const hashtagFilter: Filter = {
  kinds: [NostrKind.ShortNote],
  '#t': ['bitcoin', 'nostr'],
  limit: 50
};

// Custom tag filter
const customTagFilter: Filter = {
  kinds: [30023],     // Long-form content
  '#title': ['*'],    // Has a title tag
  '#published_at': [] // Has a published_at tag
};
```

### Subscribing to Events

```typescript
import { Filter, SubscriptionOptions } from '../types/nostr';
import { Relay } from '../nip01/relay';

async function subscribeWithOptions(relay: Relay) {
  // Connect to the relay
  await relay.connect();
  
  // Define filters
  const filters: Filter[] = [
    { 
      kinds: [1], 
      authors: ['pubkey1', 'pubkey2'],
      limit: 10 
    }
  ];
  
  // Define subscription options
  const options: SubscriptionOptions = {
    skipEose: false,
    eoseTimeout: 5000, // 5 second timeout for EOSE
    ephemeral: false
  };
  
  // Create subscription
  const subId = relay.subscribe(
    filters,
    (event) => {
      console.log('Received event:', event.id);
    },
    () => {
      console.log('End of stored events');
    },
    options
  );
  
  // Later, unsubscribe
  setTimeout(() => {
    relay.unsubscribe(subId);
  }, 30000);
}
```

### Using Publish Options and Responses

```typescript
import { NostrEvent, PublishOptions, PublishResponse } from '../types/nostr';
import { Relay } from '../nip01/relay';

async function publishWithOptions(relay: Relay, event: NostrEvent) {
  // With default options (waits for acknowledgment)
  const response1: PublishResponse = await relay.publish(event);
  
  // With custom timeout
  const response2: PublishResponse = await relay.publish(event, { 
    timeout: 5000 // 5 second timeout
  });
  
  // Fire and forget (don't wait for response)
  const response3: PublishResponse = await relay.publish(event, { 
    waitForAck: false
  });
  
  console.log(`Published to ${response1.relay}, success: ${response1.success}`);
  if (!response1.success) {
    console.error(`Publish failed: ${response1.reason}`);
  }
}
```

### Working with Relay Capabilities

```typescript
import { RelayCapabilities, RelayInfo } from '../types/nostr';

// Parse relay information document
function parseRelayCapabilities(info: RelayInfo): RelayCapabilities {
  return {
    supportedNips: info.supported_nips || [],
    supportsSearch: (info.supported_nips || []).includes(50),
    supportsAuthorPrefixes: (info.supported_nips || []).includes(50),
    requiresAuthentication: info.limitation?.auth_required || false,
    supportsTagFilters: true, // Most relays support standard tag filters
    supportsPayments: !!info.payments_url,
    maxContentLength: info.limitation?.max_message_length,
    maxFilters: info.limitation?.max_filters,
    maxSubscriptions: info.limitation?.max_subscriptions,
    maxLimit: info.limitation?.max_limit,
    supportsEphemeral: (info.supported_nips || []).includes(16)
  };
}

// Use capabilities to adapt client behavior
function adaptToRelayCapabilities(capabilities: RelayCapabilities) {
  if (capabilities.requiresAuthentication) {
    console.log('This relay requires authentication via NIP-42');
    // Implement auth flow
  }
  
  if (capabilities.supportsSearch) {
    console.log('This relay supports text search via NIP-50');
    // Enable search UI
  }
  
  if (capabilities.maxContentLength) {
    console.log(`This relay limits content length to ${capabilities.maxContentLength} bytes`);
    // Add content length validation
  }
  
  // Check if relay supports needed NIPs
  const requiredNips = [1, 4, 11, 42];
  const missingNips = requiredNips.filter(nip => 
    !capabilities.supportedNips.includes(nip)
  );
  
  if (missingNips.length > 0) {
    console.warn(`Relay is missing required NIPs: ${missingNips.join(', ')}`);
  }
}
```

### Working with Relay Groups

```typescript
import { RelayGroup, RelayStatus, NostrEvent } from '../types/nostr';
import { Relay } from '../nip01/relay';

async function useRelayGroups() {
  // Define a relay group
  const relayGroup: RelayGroup = {
    name: 'Primary',
    read: [
      'wss://relay.nostr.band',
      'wss://nos.lol',
      'wss://relay.damus.io'
    ],
    write: [
      'wss://relay.nostr.band',
      'wss://purplepag.es'
    ],
    fallback: [
      'wss://relay.nostr.info'
    ],
    minRequired: 2
  };
  
  // Create relays
  const readRelays = relayGroup.read.map(url => new Relay(url));
  const writeRelays = relayGroup.write.map(url => new Relay(url));
  
  // Connect to all relays
  await Promise.all([
    ...readRelays.map(r => r.connect()),
    ...writeRelays.map(r => r.connect())
  ]);
  
  // Check relay status
  const connectedReadRelays = readRelays.filter(
    r => (r as any).status === RelayStatus.CONNECTED
  );
  
  // Ensure we have the minimum required relays
  if (connectedReadRelays.length < relayGroup.minRequired) {
    // Try fallback relays
    const fallbackRelays = relayGroup.fallback?.map(url => new Relay(url)) || [];
    await Promise.all(fallbackRelays.map(r => r.connect()));
  }
  
  // Example: publish to write relays
  async function publishToGroup(event: NostrEvent) {
    const results = await Promise.all(
      writeRelays.map(relay => relay.publish(event))
    );
    
    const successCount = results.filter(r => r.success).length;
    return successCount >= relayGroup.minRequired;
  }
}
```

### Using the Message Statistics

```typescript
import { RelayMessageStats } from '../types/nostr';

// Initialize message stats for a relay
function createMessageStats(): RelayMessageStats {
  return {
    messagesSent: 0,
    messagesReceived: 0,
    bytesSent: 0,
    bytesReceived: 0,
    sentByType: {
      EVENT: 0,
      REQ: 0,
      CLOSE: 0
    },
    receivedByType: {
      EVENT: 0,
      EOSE: 0,
      OK: 0,
      NOTICE: 0,
      AUTH: 0,
      CLOSED: 0
    },
    eventsRejected: 0,
    authAttempts: 0,
    authSuccesses: 0
  };
}

// Update message stats when sending a message
function trackSentMessage(stats: RelayMessageStats, type: string, data: string) {
  stats.messagesSent++;
  stats.bytesSent += data.length;
  
  // Update type-specific counters
  if (type === 'EVENT') stats.sentByType.EVENT++;
  else if (type === 'REQ') stats.sentByType.REQ++;
  else if (type === 'CLOSE') stats.sentByType.CLOSE++;
}

// Update message stats when receiving a message
function trackReceivedMessage(stats: RelayMessageStats, type: string, data: string) {
  stats.messagesReceived++;
  stats.bytesReceived += data.length;
  
  // Update type-specific counters
  if (type === 'EVENT') stats.receivedByType.EVENT++;
  else if (type === 'EOSE') stats.receivedByType.EOSE++;
  else if (type === 'OK') stats.receivedByType.OK++;
  else if (type === 'NOTICE') stats.receivedByType.NOTICE++;
  else if (type === 'AUTH') stats.receivedByType.AUTH++;
  else if (type === 'CLOSED') stats.receivedByType.CLOSED++;
}

// Generate a report from the stats
function generateStatsReport(stats: RelayMessageStats): string {
  const eventReceiveRate = stats.receivedByType.EVENT / 
    (stats.messagesReceived || 1) * 100;
  
  return `
    Message Statistics:
    - Total sent: ${stats.messagesSent} (${stats.bytesSent} bytes)
    - Total received: ${stats.messagesReceived} (${stats.bytesReceived} bytes)
    - Events: ${stats.receivedByType.EVENT} (${eventReceiveRate.toFixed(1)}% of messages)
    - Rejected events: ${stats.eventsRejected}
    - Auth attempts: ${stats.authAttempts} (${stats.authSuccesses} successful)
  `;
}
```

## Type Extensions

To extend the existing types with additional NIPs, you can use TypeScript's declaration merging capabilities:

```typescript
// Example: Adding custom event kind to NostrKind enum
import { NostrKind } from '../types/nostr';

// Extend the enum
declare module '../types/nostr' {
  export enum NostrKind {
    // Add custom event kinds
    LongFormArticle = 30023,
    JobListing = 30402,
    HighlightedEvent = 9802
  }
}

// Now you can use the added enum values
```

## Related NIPs

The types in this directory implement these NIPs:

- **[NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md)**: Basic protocol flow and event format, including parameterized replaceable events
- **[NIP-11](https://github.com/nostr-protocol/nips/blob/master/11.md)**: Relay information document
- **[NIP-16](https://github.com/nostr-protocol/nips/blob/master/16.md)**: Ephemeral events
- **[NIP-42](https://github.com/nostr-protocol/nips/blob/master/42.md)**: Authentication of clients to relays 
- **[NIP-50](https://github.com/nostr-protocol/nips/blob/master/50.md)**: Search capability 