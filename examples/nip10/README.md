# NIP-10: Text Notes and Threads Examples

This directory contains examples for [NIP-10: Text Notes and Threads](https://github.com/nostr-protocol/nips/blob/master/10.md).

## Overview

NIP-10 defines how `kind:1` text notes reference each other to create threaded conversations. It specifies how to:
- Create reply threads
- Reference root posts
- Quote other events  
- Build complex thread hierarchies

## Running the Examples

```bash
npm run example:nip10
```

## Key Concepts

### Thread Structure
- **Root**: The original post that starts a thread
- **Reply**: A response to another event in the thread
- **Quote**: A reference to another event without replying
- **Mention**: A reference to an event or user

### Tag Patterns

#### Simple Reply (Recommended)
```json
[
  ["e", "<parent_event_id>"],
  ["p", "<parent_author_pubkey>"]
]
```

#### Complex Thread Reply
```json
[
  ["e", "<root_event_id>"],
  ["e", "<parent_event_id>"],
  ["p", "<root_author_pubkey>"],
  ["p", "<parent_author_pubkey>"]
]
```

#### Quote/Mention
```json
[
  ["e", "<quoted_event_id>", "<relay_url>", "mention"]
]
```

## Functions Demonstrated

- `createReplyTags()` - Generate proper reply metadata tags
- `createQuoteTag()` - Create tags for quoting events
- `parseThreadReferences()` - Parse thread structure from event tags

## Thread Hierarchy Examples

### Simple Thread
```
Root Post (Alice)
├── Reply 1 (Bob)
└── Reply 2 (Charlie)
```

### Nested Thread
```
Root Post (Alice)
├── Reply 1 (Bob)
│   ├── Reply to Bob (Charlie)
│   └── Reply to Bob (Dave)
└── Reply 2 (Eve)
```

### With Quotes
```
Root Post (Alice)
├── Reply 1 (Bob)
└── Quote of Alice's post (Charlie)
```

## Best Practices

1. **Use simple reply structure when possible** - Most clients support this format
2. **Include author pubkeys** - Helps with thread reconstruction
3. **Preserve thread context** - Include root references for nested replies
4. **Handle missing references gracefully** - Not all events may be available
5. **Follow tag ordering conventions** - Maintain consistency with other clients

## Security Considerations

- Validate event IDs before creating references
- Check pubkey formats before adding author tags
- Handle malformed thread structures gracefully
- Be aware of potential thread hijacking attempts

## Related

- [NIP-01 Examples](../nip01/) - Basic event handling
- [NIP-10 Implementation](../../src/nip10/) - Source code
- [NIP-10 Tests](../../tests/nip10/) - Test suite 