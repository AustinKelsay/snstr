# Flotilla Reimplementation Branch Checklist

This file tracks the three feature branches for the `snstr` work needed to support a Flotilla-style implementation.

## Branch 1: `codex/flotilla-foundation-nip42-relay-scoped`

Scope: authentication and relay-scoped data primitives that the other branches depend on.

- [x] Fix NIP-42 typing so relay AUTH challenges are represented correctly.
- [x] Add a dedicated `src/nip42/` module.
- [x] Add auth event builders and validators.
- [x] Add relay authentication send flow on `Relay`.
- [x] Add relay authentication entry points on `Nostr`.
- [x] Add relay-scoped subscribe/fetch helpers that preserve relay provenance.
- [x] Add relay-specific replaceable/addressable query helpers.
- [x] Add tests for NIP-42 challenge handling and auth publishing.
- [x] Add tests for relay-scoped event/query APIs.
- [x] Export the new APIs from `src/index.ts`.
- [ ] Add README/example coverage for the new foundation APIs.

## Branch 2: `codex/flotilla-groups-nip29`

Scope: relay-group and room semantics built on top of the branch 1 foundation.

- [x] Add a dedicated `src/nip29/` module.
- [x] Add constants for relay/group and room event kinds used by NIP-29 flows.
- [x] Add builders for relay join/leave and room metadata events.
- [x] Add parsers for relay members, room members, room admins, and room metadata events.
- [x] Add reducers for relay membership state.
- [x] Add reducers for room membership state.
- [x] Add reducers/helpers for pending vs granted membership status.
- [x] Add convenience filter builders for relay membership and room membership queries.
- [x] Add tests for snapshot-plus-delta membership reduction.
- [x] Add tests for room metadata and membership parsing.
- [x] Export the new APIs from `src/index.ts`.
- [x] Add README/example coverage for relay-group flows.

## Branch 3: `codex/flotilla-management-signer-moderation`

Scope: admin/moderation and higher-level ergonomics used by a Flotilla-like client.

- [x] Add a dedicated `src/nip86/` module.
- [x] Add a relay management client with generic `call(method, params)`.
- [x] Add helpers for supported methods and banned pubkey management.
- [x] Add a unified signer abstraction with local key, NIP-07, and NIP-46 adapters.
- [x] Add a dedicated `src/nip56/` helper module for reports.
- [x] Add a dedicated `src/nip70/` helper module for protected tags.
- [x] Add tests for relay management client behavior.
- [x] Add tests for signer adapters and capability detection.
- [x] Add tests for report/protected-tag helpers.
- [x] Export the new APIs from `src/index.ts`.
- [x] Add README/example coverage for admin, signer, and moderation flows.

## Shared Completion Checks

- [x] `npm test`
- [x] `npm run build`
- [x] `npm run lint`
- [x] Public exports and docs stay aligned with implementation.
- [x] New examples reflect the intended Flotilla-facing usage.
