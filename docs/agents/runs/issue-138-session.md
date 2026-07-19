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

- In progress: repository cast inventory complete; Grok design review running.
