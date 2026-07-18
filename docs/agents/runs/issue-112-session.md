# Issue Session: #112 NIP-44 Legacy-Version Behavior

## Issue

- Issue: #112 — Make NIP-44 legacy-version behavior explicit and vector-tested
- Fixed point before session: `df13432`
- Implementation owner: current Codex orchestrator; Grok unavailable at authentication preflight
- Commit: `ab22d13` plus review fix pending
- Status: implementation, integrated verification, and local review complete

## Inputs

- Spec issue: #111
- Ticket: #112
- Relevant glossary terms: Nostr Event, NIP
- Relevant ADRs: none; ADR 0001 does not own NIP-44 payload decoding
- Prototype answer and source branch, if any: none

## Implementation

- Public interface used: NIP-44 `encrypt`, `decodePayload`, and `decrypt`
- Behaviors covered: v2 official vectors decrypt; reserved v0, undefined v1, future versions, and non-base64 future encodings report unsupported versions; v0/v1 encryption remains prohibited with accurate reasons
- `tdd` used: yes; changed public decode expectations first and observed v0 decoding remain green before implementation
- Commands run during implementation: focused official-vector and format-validation tests; all NIP-44 tests; root and example typechecks; example build
- Full suite command: `npm test -- --runInBand --detectOpenHandles` and `npm run test:bun`

## Review

- Review fixed point: `df13432`
- Standards findings: pass; no documented-standard violations or unresolved Fowler smells
- Spec findings: one partial acceptance-criterion gap: reserved/undefined versions were asserted through `decodePayload`, but not through public `decrypt`
- Worthy fixes applied: added public `decrypt` rejection assertions for tampered v0/v1 payloads
- Findings ignored with reasons: none

## Risks

- This intentionally stops accepting payloads whose version byte was changed to reserved/undefined values while otherwise using the v2 layout. The authoritative NIP defines no v0/v1 decryption algorithm and requires unknown versions to be reported as unsupported.
