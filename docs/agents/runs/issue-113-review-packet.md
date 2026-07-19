# Review Packet: #113 Relay Event Store

## Fixed Point

- Base: `staging` at `8c36233`
- Branch: `feature/relay-event-store`
- Issue: #113

## Change Story

- A focused internal `RelayEventStore` owns event buffers, sorting, capacity, LRU eviction, and replaceable/addressable retention.
- Relay retains network lifecycle, validation, subscription state, EOSE coordination, timers, and callback delivery.
- Existing private storage maps and eviction algorithms are removed from Relay.
- Ordering tests call the authoritative policy rather than duplicating its comparator.
- Deterministic unit tests cover buffer ordering/capacity/LRU, replaceable tie-breaking, address keys/capacity, misses, and clearing.

## Compatibility

- Public Relay methods and constructor options are unchanged.
- Valid event delivery and EOSE ordering remain covered through Relay integration tests.
- Storage lookup methods retain their public signatures.
- The internal store is not part of the package export surface.

## Review Axes

### Standards

- The extracted module owns a cohesive policy rather than merely moving helper functions.
- Relay depends on a small retention API and no longer owns maps, capacity counters, or eviction loops.
- Clock and eviction diagnostics are injected at the deterministic boundary.

### Specification

- Buffered delivery is newest-first, then lowest event ID.
- Replaceable and addressable timestamp ties retain the lowest event ID.
- Addressable identity is kind, pubkey, and `d` tag.
- Public delivery, EOSE, and storage tests remain green.

## Verification

- Focused Jest/Bun after local review: 80/80 each
- Lint and strict typecheck: pass
- Jest: 74 suites, 1013/1013
- Bun: 1013/1013
- Commands, lint, root/examples typechecks, CJS/ESM build, examples build, and pack verification: pass
- Local CodeRabbit: 4/4 findings fixed; hosted review passed before PR #122 merged into `staging`

## Known Tooling Limitation

- Grok could not be delegated because the required `agent` CLI is unauthenticated. Per the Grok skill, no substitute subagent was used.
