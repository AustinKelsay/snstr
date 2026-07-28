# Issue Session: #113 Relay Event Store

## Scope

- Fixed point: `8c36233` (`staging` after PR #121)
- Branch: `feature/relay-event-store`
- Issue: #113
- Owner: current Codex orchestrator; Grok unavailable because `agent` authentication is required

## Acceptance Map

| Acceptance criterion | Implementation / verification seam |
| --- | --- |
| Preserve public Relay behavior and EOSE/order/storage semantics | existing Relay integration suites plus focused store tests |
| One owner for limits, eviction, replacement, addressability, and ordering | `src/nip01/relayEventStore.ts` |
| Remove storage implementation detail from Relay | Relay holds one store and delegates retention decisions |
| Exercise public behavior and deterministic module behavior | existing public Relay tests and `relayEventStore.test.ts` |
| Full verification matrix | completed; see verification results below |

## Decisions

- Keep connection lifecycle, validation coordination, EOSE state, timers, subscriptions, and callback delivery in `Relay`.
- Move only deterministic buffering and retained-event policy into the internal store.
- Inject the clock and eviction observer so capacity behavior is deterministic and directly testable.
- Apply NIP-01's lower-ID tie-break to replaceable events as well as addressable events.
- Do not export the internal store from the package entrypoints.

## Verification

- Strict typecheck and lint: pass
- Focused Relay, ordering, addressability, and store suites after review: Jest 80/80 and Bun 80/80
- Full Jest: 74 suites, 1013/1013 pass
- Full Bun: 1013/1013 pass
- Commands, lint, root/examples typecheck, CJS/ESM build, examples build, and pack verification: pass
