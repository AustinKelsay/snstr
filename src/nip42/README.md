# NIP-42: Authentication of clients to relays

Helpers for [NIP-42](https://github.com/nostr-protocol/nips/blob/master/42.md) Relay authentication using kind `22242` auth Events.

## Overview

NIP-42 lets a Relay challenge a client to prove control of a pubkey by signing an auth Event. This module builds, signs, and validates those Events so clients can respond to `AUTH` / `auth-required` flows.

## Key Features

- Build unsigned auth Event Templates with sanitized `relay` and `challenge` tags
- Sign auth Events with a private key
- Validate auth Event structure, signatures, Relay URL, and challenge
- Parse `auth-required` closed reasons from NIP-20-style prefixes

## Basic Usage

```typescript
import {
  AUTH_EVENT_KIND,
  createAuthEventTemplate,
  createSignedAuthEvent,
  isAuthEvent,
  validateAuthEvent,
  parseAuthRequiredReason,
} from "snstr";

const challenge = "relay-issued-challenge";
const relayUrl = "wss://relay.example.com";

const authEvent = await createSignedAuthEvent(
  challenge,
  relayUrl,
  privateKey,
);

// validateAuthEvent returns true on success and throws on failure
await validateAuthEvent(authEvent, {
  challenge,
  relayUrl,
  validateSignatures: true,
});
```

## Public exports

| Export | Purpose |
| --- | --- |
| `AUTH_EVENT_KIND` | Kind `22242` for client authentication Events |
| `createAuthEventTemplate` | Build an Event Template with `relay` and `challenge` tags |
| `createSignedAuthEvent` | Sign an auth Event for a given Relay challenge |
| `isAuthEvent` | Structural check for a kind-22242 auth Event |
| `validateAuthEvent` | Async validation; returns `true` or throws on mismatch/invalid structure |
| `parseAuthRequiredReason` | Extract text after an `auth-required:` closed reason prefix |
| `NIP42ValidationOptions` | Options for signature checks, challenge, Relay URL, and timestamp drift |

## Implementation Details

- Challenge and Relay URL values are sanitized before tagging.
- Relay URLs are normalized before they are written into the auth Event.
- These helpers compose with the core Relay auth callbacks on the `Nostr` and `Relay` Public Facades; they do not open connections themselves.

## Security Considerations

- Always validate signatures when accepting auth Events from untrusted sources.
- Bound timestamp drift (`maxTimestampDrift`) to limit replay of old challenges.
- Treat challenge strings as untrusted input; they are sanitized to tag-element limits before use.
