# Review Packet: #83 Add a central Nostr Event validation module

## Issue

- Issue: #83
- Slice type: AFK
- Acceptance criteria: central event validation module exists; `validateEvent` delegates shared shape/id/signature/timestamp behavior; behavior is covered by focused tests; public API remains compatible
- Baseline: `439ff8691d12531b46461f2b79488c88d1764ba5`
- Current diff: pending #83 commit

## Implementation Summary

Added `src/nip01/validation.ts` as the central signed-event validation seam, added shared NIP-01 serialization in `src/nip01/serialization.ts`, and routed the existing public `validateEvent` shape/id/signature/timestamp checks through the shared validator while keeping kind-specific content validation in `event.ts`.

## Implementation Evidence

- `implement` session: current Codex session
- `tdd` used: yes
- Red test, if applicable: `tests/nip01/event/event-validation.test.ts` initially failed because `src/nip01/validation` did not exist
- Green implementation, if applicable: validation module plus public `validateEvent` delegation
- Refactor, if applicable: extracted shared NIP-01 serialization and public-key format helper
- Commands run:
  - `npx jest tests/nip01/event/event-validation.test.ts --runInBand`
  - `npx jest tests/nip01/event --runInBand`
  - `npx tsc --noEmit`

## Review Instructions

Review only #83 unless a severe cross-slice regression appears. Keep standards and spec findings separate.

Check:

- Acceptance criteria are met.
- Tests verify behavior at the new module seam and preserve public `validateEvent` behavior.
- No duplicate event hashing path remains.
- No unrelated repo changes are included.
- Relevant test and typecheck commands pass.

## Reviewer Output

```text
STANDARDS_STATUS: changes_requested, then addressed
STANDARDS_FINDINGS:
- Duplicate NIP-01 hash path between event and validation modules.
- Duplicate lowercase public-key helper.
- Direct module tests should be justified against ADR public-interface guidance.

SPEC_STATUS: changes_requested, then addressed/deferred
SPEC_FINDINGS:
- #83 behavior delivered.
- #84 still needs Relay-level use of the central validator.
- Disabled id/signature checks should preserve historical public behavior.
```
