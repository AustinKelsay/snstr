# Issue Session: #139 Split Ephemeral Relay Internals

## Issue

- Issue: #139 — Split ephemeral Relay internals
- Fixed point before session: `3c1e905` (`staging` merge of PR #147)
- Worker session: current Codex orchestrator; Grok 4.5 High is the exclusive delegated read-only reviewer
- Commit: pending
- Status: in progress

## Inputs

- Spec issue: #130 — Complete the high-impact cleanup chain
- Ticket: #139
- Relevant glossary terms: Relay, Nostr Event, Subscription Filter
- Relevant ADRs: ADR 0001 centralizes Nostr Event validation and keeps Relay behavior at the public interface
- Prototype answer and source branch, if any: none

## Implementation

- Public interface used: `NostrRelay` through `src/testing`, plus the compatible `snstr/testing` and `snstr/utils/ephemeral-relay` package subpaths
- Behaviors covered: native and in-memory connection lifecycle, session wire messages and cleanup, Subscription Filter matching, restart state reset, exact-URL disconnect observation, and package export compatibility
- `tdd` used: yes; tests stay at public `NostrRelay`/wire seams, with a compact pure matcher contract at its internal module interface
- Commands run during implementation: focused Jest/Bun public-behavior baseline 25/25; implementation checks pending
- Full suite command: `npm test && npm run test:slow && npm run test:bun && npm run test:bun:slow` (pending)

## Review

- Review fixed point: `3c1e905`
- Standards findings: pending
- Spec findings: pending
- Worthy fixes applied: pending
- Findings ignored with reasons: pending

## Design Result

- Keep `src/utils/ephemeral-relay.ts` as the stable public facade and composition root.
- Extract private connection/transport lifecycle, client-session protocol state, and pure Subscription Filter matching owners under `src/utils/ephemeral-relay/`.
- Keep cache and replaceable-event storage in the facade; do not add a shallow fourth store module.
- Do not expose internal modules through the package root or testing entrypoint.
- Give the session owner a narrow host interface for cache, subscriptions, storage, connection count, and broadcast behavior; do not leak `WebSocketServer` across that seam.

## Risks

- Close ordering is load-bearing: late connections must be rejected, sessions must drain, and the public `Relay` disconnect must be observable before `NostrRelay.close()` resolves.
- Native and in-memory transports have intentionally different shutdown mechanics that must retain identical observable behavior.
- NIP-46 kind `24133` routing currently has special `#p` behavior and must not be silently unified with general Subscription Filter matching in this structural slice.
- `cache`, `subs`, `conn`, `wss`, `store`, both package subpaths, and the legacy numeric purge option remain compatible public behavior.
