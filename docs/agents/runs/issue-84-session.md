# Issue Session: #84 Route Relay event acceptance through central validation

## Issue

- Issue: #84 - Route Relay event acceptance through central validation
- Fixed point before session: `1f26f97fa20d9fe201ed298e1ea36e8f399b1b0e`
- Worker session: current Codex session with Composer 2.5 review subagents via `agent`
- Commit: `983430b`
- Status: complete

## Inputs

- PRD issue: #82 - PRD: Collapse Nostr Event validation surfaces
- Slice issue: #84 - Route Relay event acceptance through central validation
- Relevant glossary terms: Nostr Event, Relay, Subscription Filter, NIP
- Relevant ADRs: `docs/adr/0001-centralize-nostr-event-validation.md`
- Prototype answer, if any: none

## Implementation

- Public interface used: `Relay.subscribe` plus inbound `EVENT` message handling through the test harness; public Relay API unchanged
- Behaviors covered: valid signed Relay events deliver, malformed events reject, invalid ids reject, invalid signatures reject, future timestamps reject, out-of-range kinds reject, invalid NIP-01 tag references reject, signed NIP-46 kind `24133` events with `p` tags deliver, and NIP-46 events without `p` tags reject
- `tdd` used: yes; the NIP-46 encrypted Relay ingress test failed against the old Relay-private validation path before the central ingress helper was wired
- Commands run during implementation:
  - `npx jest tests/nip01/relay/relay.test.ts --runInBand -t "NIP-46 encrypted inbound"`
  - `npx jest tests/nip01/relay/relay.test.ts --runInBand`
  - `npx jest tests/nip01/event tests/nip01/relay --runInBand`
  - `npx tsc --noEmit`
- Full suite command: `npm test -- --runInBand`

## Review

- Review fixed point: `1f26f97fa20d9fe201ed298e1ea36e8f399b1b0e`
- Standards findings:
  - Relay ingress is stricter than the old private path because central validation enforces lowercase event fields and valid pubkey curve points
  - Relay-specific seam options should be explicit at the call site
  - Relay tag-reference, kind-range, and NIP-46 negative paths needed Relay-level coverage
  - Examples still referenced removed Relay-private validators
  - Formatting-only churn should be minimized
- Spec findings:
  - Core #84 routing was delivered
  - Relay-level coverage was partial before adding kind-range, tag-reference, and NIP-46 negative tests
  - Negative tests should assert the expected validation path instead of only counting errors
- Worthy fixes applied:
  - Added Relay-level negative tests for out-of-range kind, invalid `p`/`a` tag references, and NIP-46 missing `p` tags
  - Tightened existing rejection tests to assert central validation message fragments
  - Passed `validateRelayTagReferences` and `requireNip46PTag` explicitly from Relay to the validation seam
  - Post-CodeRabbit, removed Relay's NIP-46 id/signature skip so Relay ingress requires signed kind `24133` events while lower-level skip remains opt-in outside Relay ingress
  - Updated examples to demonstrate `validateRelayIngressEvent` instead of removed private Relay validators
  - Trimmed unrelated formatting noise from the main Relay/test-access files
- Findings ignored with reasons:
  - Stricter lowercase/curve-point validation is intentional for Relay ingress because #84 routes acceptance through the central NIP-01 validator; uppercase/non-curve event fields are not valid signed Nostr Events.
  - Relay still wraps validation failures as `RelayEvent.Error` values to preserve the existing Relay error callback surface.

## Risks

- Relay ingress is intentionally stricter than the old private helper for malformed public keys, uppercase event fields, and unsigned/fake-id NIP-46 events.
