# NIP-50: Search Capability

This module implements the basics of [NIP-50](https://github.com/nostr-protocol/nips/blob/master/50.md). The specification introduces a `search` field for subscription filters allowing full text queries.

## Overview

NIP-50 defines an optional `search` field for subscription filters that allows clients to perform full-text search queries across events. Relays that support NIP-50 interpret the `search` string and return matching events. The search algorithm is implementation specific. This library provides a helper to build search filters and the ephemeral relay supports simple substring matching.

## Key Features

- 🔍 **Search Filters** – Create filters containing a `search` query with proper typing
- 🤖 **Ephemeral Relay Support** – The in‑memory relay can respond to search filters for testing
- 📄 **Type Safety** – `NostrFilter` includes an optional `search` property with full TypeScript support
- 🔧 **Helper Functions** – Utility functions to create and validate search filters

## Basic Usage

```typescript
import { Nostr, createSearchFilter } from 'snstr';

const client = new Nostr(['wss://relay.example.com']);
await client.connectToRelays();

// Subscribe using a search query
client.subscribe(
  [createSearchFilter('nostr apps', { kinds: [1], limit: 20 })],
  (event) => console.log('Found event', event.id)
);
```

## Advanced Usage

### Combined Filters

You can combine search with other filter criteria:

```typescript
import { createSearchFilter } from 'snstr';

// Search for Bitcoin discussions in the last week
const filter = createSearchFilter('bitcoin', {
  kinds: [1], // Text notes only
  since: Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60), // Last 7 days
  limit: 50
});

client.subscribe([filter], (event) => {
  console.log(`Found Bitcoin discussion: ${event.content.substring(0, 100)}...`);
});
```

### Multiple Search Terms

```typescript
// Search for multiple terms (relay-dependent behavior)
const filters = [
  createSearchFilter('nostr', { kinds: [1], limit: 10 }),
  createSearchFilter('bitcoin', { kinds: [1], limit: 10 }),
  createSearchFilter('lightning', { kinds: [1], limit: 10 })
];

client.subscribe(filters, (event) => {
  console.log('Found relevant event:', event.id);
});
```

## API Reference

### `createSearchFilter(query: string, options?: Partial<NostrFilter>): NostrFilter`

Creates a filter object with a search query.

- **query**: The search string to look for
- **options**: Additional filter options (kinds, authors, since, until, limit, etc.)
- **Returns**: A complete `NostrFilter` object with the search field

```typescript
const filter = createSearchFilter('decentralized social', {
  kinds: [1, 30023], // Text notes and long-form content
  authors: ['pubkey1', 'pubkey2'],
  limit: 25
});
```

## Implementation Details

### Search Behavior

The search implementation varies by relay:

1. **Ephemeral Relay**: Performs simple substring matching across event content and tag values
2. **Real Relays**: May implement advanced features like:
   - Stemming and lemmatization
   - Relevance scoring
   - Boolean operators (AND, OR, NOT)
   - Phrase matching with quotes
   - Field-specific search

### Testing with Ephemeral Relay

```typescript
import { EphemeralRelay, Nostr, createSearchFilter } from 'snstr';

// Create an in-memory relay for testing
const ephemeralRelay = new EphemeralRelay();
const client = new Nostr();

// Add some test events
await ephemeralRelay.publish({
  kind: 1,
  content: 'Building decentralized applications with Nostr',
  tags: [['t', 'nostr'], ['t', 'development']],
  // ... other event fields
});

// Test search functionality
client.subscribe(
  [createSearchFilter('decentralized')],
  (event) => console.log('Found:', event.content)
);
```

## Examples

For complete examples, see:
- [`search-demo.ts`](../../examples/nip50/search-demo.ts) - Basic search functionality

## Testing

Run the NIP-50 tests:

```bash
npm run test:nip50
```

## Relay Compatibility

NIP-50 is optional and not all relays support it. When using search filters:

1. Check relay capabilities via NIP-11 (Relay Information Document)
2. Gracefully handle relays that ignore the `search` field
3. Consider fallback strategies for non-supporting relays

```typescript
import { getRelayInfo } from 'snstr';

const relayInfo = await getRelayInfo('wss://relay.example.com');
if (relayInfo?.supported_nips?.includes(50)) {
  // Relay supports NIP-50 search
  client.subscribe([createSearchFilter('query')], handler);
} else {
  // Fallback to non-search filters
  console.log('Relay does not support NIP-50 search');
}
```
