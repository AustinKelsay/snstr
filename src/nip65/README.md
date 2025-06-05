# NIP-65: Relay List Metadata

This module implements [NIP-65](https://github.com/nostr-protocol/nips/blob/master/65.md), which defines a replaceable event of kind `10002` for advertising the relays a user typically **reads** from and **writes** to.

## Overview

NIP‑65 events contain `r` tags with relay URLs.  Each tag may optionally include a `read` or `write` marker.  If the marker is omitted the relay is used for both reading and writing.

```jsonc
{
  "kind": 10002,
  "tags": [
    ["r", "wss://relay.example.com"],            // read & write
    ["r", "wss://read.example.com", "read"],    // read only
    ["r", "wss://write.example.com", "write"]   // write only
  ],
  "content": ""
}
```

## API

### `createRelayListEvent(relays, content?)`
Returns an unsigned event template ready to be signed.  Relay entries are specified using:

```ts
interface RelayListEntry {
  url: string;   // relay URL
  read: boolean; // read capability
  write: boolean;// write capability
}
```

### `parseRelayList(event)`
Parses a signed or unsigned relay list event and returns an array of `RelayListEntry` objects.

### `getReadRelays(input)` / `getWriteRelays(input)`
Convenience helpers that extract just the relay URLs intended for reading or writing.  `input` can be either a `RelayListEvent` or the array returned by `parseRelayList`.

## Usage Example

```ts
import { createRelayListEvent, parseRelayList, getReadRelays } from "snstr/nip65";
import { createSignedEvent } from "snstr/nip01/event";
import { generateKeypair } from "snstr/utils/crypto";

(async () => {
  const keys = await generateKeypair();
  const template = createRelayListEvent([
    { url: "wss://relay1.example.com", read: true, write: true },
    { url: "wss://relay2.example.com", write: true, read: false },
  ]);
  const unsigned = { ...template, pubkey: keys.publicKey };
  const event = await createSignedEvent(unsigned, keys.privateKey);

  const entries = parseRelayList(event);
  console.log("read relays", getReadRelays(entries));
})();
```
