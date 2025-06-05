# NIP-50: Search Capability

This module implements the basics of [NIP-50](https://github.com/nostr-protocol/nips/blob/master/50.md). The specification introduces a `search` field for subscription filters allowing full text queries.

## Overview

Relays that support NIP-50 interpret the `search` string and return matching events. The search algorithm is implementation specific. This library provides a helper to build search filters and the ephemeral relay supports simple substring matching.

## Key Features

- 🔍 **Search Filters** – create filters containing a `search` query
- 🤖 **Ephemeral Relay Support** – the in‑memory relay can respond to search filters for testing
- 📄 **Type Safety** – `NostrFilter` includes an optional `search` property

## Basic Usage

```typescript
import { Nostr } from 'snstr';
import { createSearchFilter } from 'snstr/nip50';

const client = new Nostr(['wss://relay.example.com']);
await client.connectToRelays();

// Subscribe using a search query
client.subscribe(
  [createSearchFilter('nostr apps', { kinds: [1], limit: 20 })],
  (event) => console.log('Found event', event.id)
);
```

## Implementation Details

The included ephemeral relay performs a very naïve search by checking if the query appears in the event content or any tag values. Real relays are expected to implement more advanced search and ranking algorithms.
