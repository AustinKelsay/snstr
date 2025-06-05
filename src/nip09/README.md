# NIP-09: Event Deletion Requests

This module implements [NIP-09](https://github.com/nostr-protocol/nips/blob/master/09.md),
which defines event deletion request events (kind `5`). A deletion request
references events via `e` or `a` tags and may include `k` tags specifying the
kind of each event. The `content` field can contain an optional reason.

## Features

- Create deletion request events with `e`, `a` and `k` tags
- Parse deletion request targets from existing events
- Helper to check if a deletion request targets a specific event

## Basic Usage

```typescript
import {
  createDeletionRequest,
  parseDeletionTargets,
  isDeletionRequestForEvent,
} from 'snstr';

const deletion = createDeletionRequest(
  { ids: ['<event-id>'], kinds: [1], content: 'mistake' },
  '<pubkey>'
);
```

Use `parseDeletionTargets()` to extract referenced event ids, addresses and
kinds from a deletion event. `isDeletionRequestForEvent()` verifies whether a
delete request applies to a given event.

## Security Considerations

Clients should verify that the `pubkey` of the deletion request matches the
`pubkey` of the referenced events before treating them as deleted. Relays can not
validate this in general and simply forward the request.
