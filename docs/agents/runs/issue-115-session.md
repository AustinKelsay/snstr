# Issue Session: #115 Nostr Relay Registry

## Scope

- Fixed point: `4e40b63` (`staging` after PR #123)
- Branch: `feature/nostr-relay-registry`
- Issue: #115
- Owner: current Codex orchestrator; Grok unavailable because `agent` authentication is required

## Acceptance Map

| Acceptance criterion | Implementation / verification seam |
| --- | --- |
| Stable public Nostr facade | unchanged constructor and relay-management signatures |
| One owner for normalization, identity, lookup, removal, and lifecycle | `src/nip01/relayRegistry.ts` |
| Same observable Relay set | Nostr publishing, subscriptions, auth, fetch, and rate limits iterate the registry |
| Public behavior coverage | normalized add/get/remove and graceful invalid operations in `nostr.test.ts` |
| Full verification | focused 61/61; full Jest/Bun 1026/1026; commands, types, builds, pack |

## Decisions

- Keep callback attachment and all protocol operations in the Nostr facade.
- Keep the registry internal and Map-compatible only for existing test seams.
- Make every compatibility accessor uphold canonical identity and disconnect ownership.
