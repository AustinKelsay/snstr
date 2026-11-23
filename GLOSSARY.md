# SNSTR

SNSTR is a TypeScript library for building Nostr protocol clients, relay interactions, signing flows, and NIP-specific utilities.

## Language

**Nostr Event**:
A signed protocol message with an id, public key, timestamp, kind, tags, content, and signature.
_Avoid_: Message, payload

**Event Template**:
An unsigned description of a Nostr Event before its id and signature are produced.
_Avoid_: Draft event, event input

**Relay**:
A WebSocket endpoint that receives, stores, filters, and returns Nostr Events.
_Avoid_: Server, broker

**Subscription Filter**:
A Nostr filter object sent to a Relay to select matching Nostr Events.
_Avoid_: Query, search parameters

**NIP**:
A Nostr Implementation Possibility that defines a protocol behavior or interoperable extension.
_Avoid_: Plugin, feature spec

**Public Facade**:
The supported public class or function that callers should use for a capability when multiple wrappers exist.
_Avoid_: Primary API, recommended entrypoint (use this term instead)

**Compatibility Alias**:
A deprecated public export retained for 0.x consumers until the next major release removes it.
_Avoid_: Legacy shim, soft export
