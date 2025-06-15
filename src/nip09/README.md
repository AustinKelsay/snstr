# NIP-09: Event Deletion Requests

This module implements [NIP-09](https://github.com/nostr-protocol/nips/blob/master/09.md),
which defines event deletion request events (kind `5`). A deletion request
references events via `e` or `a` tags and may include `k` tags specifying the
kind of each event. The `content` field can contain an optional reason for the
deletion.

## Overview

NIP-09 allows users to request the deletion of their previously published events. While deletion is not guaranteed (relays may choose to honor or ignore these requests), this protocol provides a standardized way to express the intent to remove content.

## Key Features

- 🗑️ **Deletion Requests** – Create kind `5` events to request deletion of previous events
- 🏷️ **Multiple Reference Types** – Support for `e` tags (event IDs), `a` tags (addresses), and `k` tags (kinds)
- 📝 **Reason Support** – Optional content field for deletion justification
- 🔍 **Parsing Utilities** – Extract deletion targets from existing events
- ✅ **Validation Helpers** – Check if deletion requests apply to specific events

## Basic Usage

```typescript
import {
  createDeletionRequest,
  parseDeletionTargets,
  isDeletionRequestForEvent,
} from 'snstr';

// Create a deletion request for specific events
const deletion = createDeletionRequest(
  { 
    ids: ['<event-id-1>', '<event-id-2>'], 
    kinds: [1], 
    content: 'Accidental post, removing for privacy' 
  },
  '<your-private-key>'
);

// Publish the deletion request
await client.publish(deletion);
```

## Advanced Usage

### Deleting Addressable Events

```typescript
import { createDeletionRequest } from 'snstr';

// Delete an addressable event (like a profile or long-form post)
const profileDeletion = createDeletionRequest(
  {
    addresses: ['30023:<pubkey>:article-identifier'],
    content: 'Removing outdated article'
  },
  privateKey
);
```

### Bulk Deletion by Kind

```typescript
// Delete all text notes (kind 1) by this author
const bulkDeletion = createDeletionRequest(
  {
    kinds: [1],
    content: 'Cleaning up old posts'
  },
  privateKey
);
```

### Mixed Deletion Request

```typescript
// Combine different reference types
const mixedDeletion = createDeletionRequest(
  {
    ids: ['<specific-event-id>'],
    addresses: ['30023:<pubkey>:article'],
    kinds: [1, 6], // Text notes and reposts
    content: 'Account cleanup'
  },
  privateKey
);
```

## Parsing and Validation

### Parse Deletion Targets

```typescript
import { parseDeletionTargets } from 'snstr';

// Parse what a deletion request is targeting
const targets = parseDeletionTargets(deletionEvent);
console.log(targets);
// {
//   ids: ['<event-id-1>', '<event-id-2>'],
//   addresses: ['30023:<pubkey>:article'],
//   kinds: [1, 6]
// }
```

### Check if Event is Targeted

```typescript
import { isDeletionRequestForEvent } from 'snstr';

// Check if a deletion request applies to a specific event
const isTargeted = isDeletionRequestForEvent(deletionEvent, myEvent);
if (isTargeted) {
  console.log('This event was requested for deletion');
}
```

### Complete Deletion Processing

```typescript
import { parseDeletionTargets, isDeletionRequestForEvent } from 'snstr';

function processDeletionRequest(deletionEvent, myEvents) {
  // Verify the deletion request is from the event author
  const targets = parseDeletionTargets(deletionEvent);
  
  myEvents.forEach(event => {
    // Only process deletions from the same author
    if (event.pubkey === deletionEvent.pubkey) {
      if (isDeletionRequestForEvent(deletionEvent, event)) {
        console.log(`Event ${event.id} was requested for deletion: ${deletionEvent.content}`);
        // Handle the deletion (hide, mark as deleted, etc.)
      }
    }
  });
}
```

## API Reference

### `createDeletionRequest(targets: DeletionTargets, privateKey: string): NostrEvent`

Creates a NIP-09 deletion request event.

**Parameters:**
- `targets`: Object specifying what to delete
  - `ids?: string[]` - Specific event IDs to delete
  - `addresses?: string[]` - Addressable event coordinates to delete  
  - `kinds?: number[]` - Event kinds to delete (all events of these kinds by this author)
  - `content?: string` - Optional reason for deletion
- `privateKey`: The private key to sign the deletion request

**Returns:** A signed kind `5` event ready for publishing

### `parseDeletionTargets(event: NostrEvent): DeletionTargets`

Extracts deletion targets from a kind `5` event.

**Parameters:**
- `event`: A kind `5` deletion request event

**Returns:** Object containing the parsed targets

### `isDeletionRequestForEvent(deletionEvent: NostrEvent, targetEvent: NostrEvent): boolean`

Checks if a deletion request applies to a specific event.

**Parameters:**
- `deletionEvent`: The kind `5` deletion request
- `targetEvent`: The event to check against

**Returns:** `true` if the deletion request targets the event

## Examples

For complete examples, see:
- [`deletion-request.ts`](../../examples/nip09/deletion-request.ts) - Basic deletion request usage

## Testing

Run the NIP-09 tests:

```bash
npm run test:nip09
```

## Security Considerations

### Author Verification

**Critical**: Clients must verify that the `pubkey` of the deletion request matches the `pubkey` of the referenced events before treating them as deleted.

```typescript
function isValidDeletion(deletionEvent, targetEvent) {
  // Only the original author can delete their events
  if (deletionEvent.pubkey !== targetEvent.pubkey) {
    console.warn('Deletion request from different author - ignoring');
    return false;
  }
  
  return isDeletionRequestForEvent(deletionEvent, targetEvent);
}
```

### Relay Behavior

- **Relays cannot validate ownership** in general and may simply forward deletion requests
- **No guaranteed deletion** - relays may choose to honor or ignore deletion requests
- **Timestamp considerations** - deletion requests should have timestamps after the events they reference

### Client Recommendations

1. **Verify ownership** before processing any deletion
2. **Graceful handling** when deletion fails or is ignored
3. **User feedback** about deletion request status
4. **Backup considerations** before requesting deletion

```typescript
async function requestDeletion(eventIds, reason = '') {
  try {
    const deletion = createDeletionRequest(
      { ids: eventIds, content: reason },
      privateKey
    );
    
    await client.publish(deletion);
    console.log('Deletion request sent - deletion not guaranteed');
  } catch (error) {
    console.error('Failed to send deletion request:', error);
  }
}
```

## Best Practices

1. **Be specific** - Use event IDs when possible rather than broad kind deletions
2. **Provide reasons** - Include helpful content explaining why events are being deleted
3. **Handle gracefully** - Don't assume deletion requests will be honored
4. **Consider alternatives** - Sometimes editing (for replaceable events) is better than deletion
