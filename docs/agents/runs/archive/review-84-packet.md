# Review Packet: #84 Route Relay event acceptance through central validation

## Issue

- Issue: #84
- Slice type: AFK
- Acceptance criteria: Relay inbound `EVENT` messages use the central validation module; valid signed events deliver; malformed events, invalid ids, invalid signatures, and future timestamps reject; NIP-46 encrypted handling remains explicit; targeted Relay tests pass without expanding public Relay API
- Baseline: `1f26f97fa20d9fe201ed298e1ea36e8f399b1b0e`
- Current diff: #84 commit plus CodeRabbit follow-up tightening NIP-46 Relay ingress

## Implementation Summary

Relay inbound `EVENT` handling now delegates to `validateRelayIngressEvent` in the central validation module. The old Relay-private shape/hash/signature validation methods were removed, Relay-specific tag-reference and NIP-46 checks live behind the central validation seam, examples no longer teach private Relay validation access, and Relay tests exercise acceptance/rejection through inbound messages.

## Implementation Evidence

- `implement` session: current Codex session
- `tdd` used: yes
- Red test, if applicable: NIP-46 encrypted inbound `EVENT` was not delivered before Relay used the central ingress helper
- Green implementation, if applicable: Relay `validateInboundEvent` now calls `validateRelayIngressEvent`
- Refactor, if applicable: removed Relay-private `performBasicValidation`, `validateEvent`, `validateEventAsync`, and `isNostrEvent`
- Commands run:
  - `npx jest tests/nip01/relay/relay.test.ts --runInBand -t "NIP-46 encrypted inbound"`
  - `npx jest tests/nip01/relay/relay.test.ts --runInBand`
  - `npx jest tests/nip01/event tests/nip01/relay --runInBand`
  - `npx tsc --noEmit`

## Review Instructions

Review only #84 unless a severe cross-slice regression appears. Keep standards and spec findings separate.

Check:

- Relay inbound `EVENT` acceptance routes through `validateRelayIngressEvent`.
- The public Relay API is unchanged.
- NIP-46 kind `24133` Relay ingress requires a signed event and an explicit `p` tag; hash/signature skip remains only as a lower-level opt-in validation option outside Relay ingress.
- Relay-level tests cover accepted events and rejection paths.
- Examples do not reference removed private Relay validators.

## Reviewer Output

```text
STANDARDS_STATUS: changes_requested, then addressed/recorded
STANDARDS_FINDINGS:
- Add Relay-level negative coverage for kind range, tag references, and NIP-46 missing p tags.
- Make Relay-specific validation options explicit at the seam.
- Update examples that referenced removed Relay-private validation methods.
- Document intentional stricter lowercase/curve-point Relay ingress behavior.
- Post-CodeRabbit follow-up: remove Relay's NIP-46 id/signature skip and require signed kind `24133` Relay ingress events.

SPEC_STATUS: changes_requested, then addressed
SPEC_FINDINGS:
- Main #84 routing is met.
- Rejection-path coverage needed kind-range, tag-reference, and NIP-46 negative cases.
- Negative tests should assert the expected error path rather than only counting errors.
```
