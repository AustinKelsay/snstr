# Issue 138 Session: Public Behavior Test Seams

## Fixed Point

- Base branch: `staging`
- Fixed point: `b33f31f`
- Feature branch: `feature/public-behavior-test-seams`
- Issue: #138 — Move behavior tests off private shapes

## Scope

Remove the shared `Nostr` and `Relay` private-shape adapters, rewrite tests around public behavior where possible, and place only irreducible protocol injection or fault control behind narrow exports owned by `src/testing`.

## Test-First Plan

1. Add a source contract test that rejects the legacy adapters and named broad private-shape interfaces in the targeted Relay, Nostr, NIP-46, and NIP-47 clusters.
2. Replace Nostr state reads and key mutation with `addRelay`, `getRelay`, `removeRelay`, `setPrivateKey`, and `getPublicKey`; retain a narrow relay-replacement seam only where a deterministic mock must be injected.
3. Replace Relay field access with public getters/setters, observable callbacks, mock WebSocket behavior, and narrow protocol-message/fault seams in `src/testing`.
4. Replace NIP-46 and NIP-47 broad casts with public lifecycle behavior or focused testing-entrypoint controls.
5. Run focused Jest/Bun suites, the routine and slow lanes, complete coverage, build/package gates, Grok standards/spec review, and CodeRabbit local/hosted review.

## Guardrails

- Do not expose new production API solely to make an assertion convenient.
- A testing seam must name one behavior or fault; it must not return a shadow object containing arbitrary private state.
- Preserve failure sensitivity: cleanup tests must still prove cleanup and protocol tests must still traverse the production handler.

## Status

- Local implementation and review completed; all hosted gates passed and PR #147 merged into `staging` as `3c1e905`.

## Implementation Result

- Removed the shared `NostrInternals`, `getNostrInternals`, `RelayTestAccess`, and `asTestRelay` private-shape adapters.
- Reworked the targeted Nostr, Relay, NIP-46, and NIP-47 suites around public lifecycle, callbacks, relay wire behavior, or focused controls exported by `src/testing`.
- Added a source contract that prevents the removed adapters and broad private-shape patterns from returning in the targeted suites.
- Extracted the NIP-46 replay guard into an internal module and exercised replay rejection, lifecycle reset, timer cleanup, relay reconnect policy, socket replacement, and replaceable-event ordering through behavior-sensitive tests.
- Kept NIP-04 permissions out of the shared core fixture and granted them only in the encryption compatibility test.

## Review Result

- Grok design, standards, and specification review: approved after the behavior-sensitivity fixes.
- CodeRabbit local review: clean, 0 findings on the final full diff after five earlier minor findings were fixed.
- No public replay-window option was added: exposing product configuration only to support a test would violate this issue's guardrail, while the internal replay guard remains directly testable.

## Verification Result

- Routine Jest: 86 suites, 1,061 tests passed.
- Slow Jest: 35 tests passed.
- Routine Bun: 1,061 tests passed.
- Slow Bun: 35 tests passed.
- Complete Jest coverage lane: 88 suites, 1,096 tests passed; 80.72% statements, 68.59% branches, 82.63% functions, and 81.20% lines.
- Commands policy, package-manager policy, lint, strict TypeScript, build, examples build, and package verification passed.
- Final NIP-04 permission adjustment passed its focused Jest and Bun test plus lint and strict TypeScript.
