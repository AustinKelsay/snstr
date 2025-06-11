# NIP-10: Text Notes and Threads

Implementation of [NIP-10](https://github.com/nostr-protocol/nips/blob/master/10.md) which defines how `kind:1` text notes reference each other in threads.

## Overview

NIP‑10 introduces marked `e` tags for replies and `q` tags for quoting other events. Root and reply identifiers are carried in the tags and authors referenced should be included in `p` tags.

## Key Features

- Utilities to create marked `e` and `q` tags
- Parsing of thread references from an event
- Support for the deprecated positional `e` tag scheme

## Basic Usage

```typescript
import { createReplyTags, createQuoteTag, parseThreadReferences } from 'snstr';

const eTags = createReplyTags(
  { id: rootId, relay: 'wss://relay.example.com' },
  { id: replyId }
);

const quote = createQuoteTag({ id: quotedId });

// later when inspecting an event
const refs = parseThreadReferences(event);
console.log(refs.root, refs.reply, refs.quotes);
```

## Implementation Details

`parseThreadReferences` first looks for marked `e` tags (`"root"` and `"reply"`). If none are found it falls back to the positional scheme described in the NIP for backwards compatibility. Quote information is extracted from `q` tags.
