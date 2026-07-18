# Review Packet: #112 NIP-44 Legacy-Version Behavior

## Issue

- Issue: #112
- Slice type: correctness/security compatibility cleanup
- Acceptance criteria: authoritative version registry; public version tests; no placeholder compatibility; stable unsupported-version errors; full verification
- Baseline: `df13432`
- Current diff: `git diff df13432...HEAD`

## Implementation Summary

SNSTR now accepts the only defined NIP-44 algorithm version, v2, and reports reserved v0, undefined v1, future version bytes, and future non-base64 encodings as unsupported. Official v2 vector decryption can no longer be swallowed by a warning-only test path. Source and examples no longer claim nonexistent v0/v1 compatibility.

## Implementation Evidence

- `implement` session: `docs/agents/runs/issue-112-session.md`
- `tdd` used: yes
- Red test: reserved v0 tampering remained accepted at `decodePayload`
- Green implementation: `decodePayload` requires v2 before extracting cryptographic fields; legacy passthrough decryptors and constants removed
- Refactor: version dispatch and contradictory placeholder branches removed
- Commands run: 107 focused NIP-44 tests; 991 Jest tests; 991 Bun tests; lint; command verification; root/examples typecheck; CJS/ESM build; examples build; package verification

## Review Instructions

Review only this issue's slice unless you find a severe cross-slice regression. Keep standards and spec findings separate.

Check:

- Acceptance criteria are met.
- Tests verify behavior through public interfaces.
- No implementation-only tests are masquerading as behavior tests.
- No obvious incomplete work, TODO placeholders, or unrelated changes.
- Relevant test, typecheck, build, or visual verification commands pass.

## Reviewer Output

```text
STANDARDS_STATUS: pending
STANDARDS_FINDINGS:
- pending

SPEC_STATUS: pending
SPEC_FINDINGS:
- pending
```
