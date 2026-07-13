## Issue

- Issue: #94 — Correct coverage exclusions
- Acceptance criteria: measure implementation modules without counting declaration or aggregation-only barrels
- Commit: `e77c49c`

## Evidence

- Jest coverage completed with 66 suites / 868 tests passing.
- `coverage/lcov.info` contains 23 nested NIP/signer index modules.
- Root and web aggregation entries and `.d.ts` files remain excluded.

## Reviewer Output

```text
STANDARDS_STATUS: pass
STANDARDS_FINDINGS: none

SPEC_STATUS: pass
SPEC_FINDINGS: none
```
