# NIP-21: `nostr:` URI Scheme

This module implements [NIP-21](https://github.com/nostr-protocol/nips/blob/master/21.md), providing helpers to work with `nostr:` URIs that wrap NIP‑19 identifiers.

## Overview

NIP‑21 defines a simple URI scheme `nostr:`. The path component is any NIP‑19 identifier (except `nsec`). This allows links to Nostr profiles, notes and other entities to be embedded in webpages or applications.

## Key Features

- 🔗 **URI Creation** – Build `nostr:` URIs from existing NIP‑19 strings
- 🔍 **URI Parsing** – Extract and decode the underlying NIP‑19 entity
- ❌ **Safety Checks** – Reject `nsec` identifiers in URIs

## Basic Usage

```typescript
import {
  encodePublicKey,
  encodeNostrURI,
  decodeNostrURI,
} from "snstr";

const npub = encodePublicKey(
  "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
);

const uri = encodeNostrURI(npub);
console.log(uri); // nostr:npub1...

const entity = decodeNostrURI(uri);
console.log(entity.type); // Prefix.PublicKey
```

## Implementation Details

`encodeNostrURI` validates the supplied NIP‑19 string and ensures it is not an `nsec` private key. `decodeNostrURI` checks the URI prefix and then delegates decoding to the NIP‑19 module.

## Security Considerations

Do not embed private keys (`nsec`) in `nostr:` URIs. Applications should also treat the decoded entity as untrusted input and validate relay URLs if present.
