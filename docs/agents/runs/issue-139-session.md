# Issue Session: #139 Split Ephemeral Relay Internals

## Issue

- Issue: #139 — Split ephemeral Relay internals
- Fixed point before session: `3c1e905` (`staging` merge of PR #147)
- Worker session: current Codex orchestrator; Grok 4.5 High is the exclusive delegated read-only reviewer
- Commits: `d6504f6`, `7a48586`, `f8e9aac`, `96dd79f` plus review artifacts
- Status: complete; PR #148 merged into `staging` as `9c9e14c`; issue #139 and parent spec #130 closed

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
- Commands run during implementation: focused Jest/Bun public-behavior baseline 25/25; final focused owner/lifecycle/session/filter set 50/50 after production review fixes; final polling-only confirmation 2/2 in both runtimes
- Full suite command: `npm test`, `npm run test:slow`, `npm run test:bun`, `npm run test:bun:slow`, and `npm run test:coverage:all` — green at 1,074 routine + 35 slow = 1,109 tests

## Review

- Review fixed point: `3c1e905`
- Standards findings: initial Grok pass found missing JSDoc, new snake_case ownership, duplicated diagnostic coercion, and transport client-set traversal; all were fixed. Final Grok re-review approved with 0 hard and 0 actionable judgement findings.
- Spec findings: initial Grok pass found final gates/PR pending and session coverage error-only; gates are green and focused session coverage now proves REQ, EOSE, EVENT, CLOSE, malformed messages, and stale-route removal. Final Grok re-review approved with 0 code/spec findings and named the PR as the expected next action.
- Worthy fixes applied: shared diagnostic coercion/protection, transport-owned broadcast, camelCase subscription state, post-start server error handling, guaranteed shutdown cleanup, direct NIP-46 subscription routing, and cancellable test polling.
- Findings ignored with reasons: CodeRabbit's connection cap requires a new unspecified product policy; changing duplicate delivery for overlapping filters changes pre-existing observable behavior. Both are outside the structural compatibility scope.
- CodeRabbit: two full-diff passes completed; five in-scope findings fixed; final incremental review 0 findings. See `issue-139-coderabbit-local.md`.

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

## Verification Result

- Routine Jest/Bun: 1,074/1,074 each.
- Slow Jest/Bun: 35/35 each.
- Complete Jest coverage inventory: 1,109/1,109.
- Hosted verification: Bun and Node 16/18/20 all green on the final head. An earlier Node 20 run had one isolated loaded-suite NIP-46 timeout while the same inventory passed on Node 16/18 and locally; the clean rerun passed unchanged production code.
- Hosted CodeRabbit: remained pending for the full 20-minute Feature Dev window without posting findings. The documented fallback was applied after two full local passes, one zero-finding incremental pass, final Grok approval, and four green hosted CI jobs.
- Integrated: PR #148 merged into `staging` at `9c9e14c` on 2026-07-19.
- Policy, lint, strict types, CJS/ESM and examples builds, web exports, and pack verification: green.
- Pack verification: 19 referenced targets, 376 packed files, 55 web modules, 3 guarded Node fallbacks.
