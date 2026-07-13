## Issue

- Issue: #95 — Sync supported NIP documentation and targeted test commands
- Slice type: AFK tracer bullet
- Acceptance criteria: shipped NIP documentation and targeted test commands are complete, accurate, and executable
- Baseline: `2f6a6f4`
- Current diff: `git diff 2f6a6f4...3daf6ad`

## Implementation Summary

Users can now discover all shipped NIP families in the main README, and contributors can run a targeted Jest command for every mirrored NIP test directory.

## Implementation Evidence

- `implement` session: current orchestrator
- `tdd` used: yes
- Red test, if applicable: `npm run test:nip29 -- --runInBand` reported a missing script
- Green implementation, if applicable: all five new targeted scripts passed (42 tests total)
- Refactor, if applicable: corrected NIP-70 wording after spec review
- Commands run: five targeted scripts, lint, typecheck, inventory comparison, final integrated coverage suite

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
STANDARDS_STATUS: pass with two recorded low-severity heuristics
STANDARDS_FINDINGS:
- Existing README script inventories remain duplicated; intentionally not expanded into a generator/refactor in #95.

SPEC_STATUS: pass
SPEC_FINDINGS:
- Initial NIP-70 wording was corrected and re-review found zero remaining issues.
```
