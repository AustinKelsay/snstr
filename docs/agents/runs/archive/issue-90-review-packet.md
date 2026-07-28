# Issue 90 Review Packet

## Issue

- Issue: #90 — Restore NIP-65 and NIP-66 web entry exports
- Slice type: AFK
- Acceptance criteria: representative NIP-65/NIP-66 helpers and constants import from the web/RN entry; names and behavior match Node; browser-safe suites remain green
- Baseline: ticket #89 commit on `feature/cleanup-logging-web-build`
- Current diff: web entry exports plus parity test

## Implementation Summary

The web/React Native package entry now exposes the same NIP-65 relay-list and NIP-66 relay-discovery utility functions already available from the Node entry.

## Implementation Evidence

- `implement` session: current orchestrator, ticket #90
- `tdd` used: yes
- Red test, if applicable: web entry parity test failed because all requested exports were absent
- Green implementation, if applicable: parity test passes
- Refactor, if applicable: none
- Commands run:
  - web-entry parity test
  - full TypeScript typecheck
  - NIP-65 tests
  - NIP-66 tests
  - targeted ESLint

## Review Instructions

Review only issue #90's slice unless there is a severe cross-slice regression. Keep standards and spec findings separate.

Check:

- Acceptance criteria are met.
- Tests verify the public platform entry.
- No implementation-only tests were added.
- No Node-only dependency was introduced.
- Relevant tests and typecheck pass.

## Reviewer Output

```text
STANDARDS_STATUS: pass
STANDARDS_FINDINGS:
- None.

SPEC_STATUS: pass
SPEC_FINDINGS:
- None.
```
