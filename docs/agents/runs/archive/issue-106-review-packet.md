# Review Packet: Issue #106

## Issue

- Issue: [#106 — Collapse package-script and README command duplication](https://github.com/AustinKelsay/snstr/issues/106)
- Slice type: contributor tooling and documentation cleanup
- Acceptance criteria:
  - remove exact duplicate package commands unless compatibility requires them
  - prevent grouped commands from executing the same underlying work twice
  - keep one authoritative root README command inventory
  - ensure every documented runnable command maps to a real script or valid direct command
  - retain useful contributor workflows and package-manager/Node policies
- Baseline: `fc4e3b5`
- Current diff: `git diff --cached fc4e3b5 --`

## Implementation Summary

Five redundant aliases were removed in favor of their canonical NIP names. The basic and messaging example groups now use the canonical NIP-04 command once. The root README has one complete `## Command Reference`, while its Examples, Testing, and Development sections point to that inventory instead of repeating it. A runnable verifier now checks exact duplicates, recursive group and lifecycle-shorthand targets/cycles/leaf execution, literal Markdown references, and completeness, uniqueness, and definition accuracy of the canonical README inventory.

## Implementation Evidence

- `implement` session: `/root/issue_106_worker`; durable record in `docs/agents/runs/issue-106-session.md`
- `tdd` used: yes
- Red test: missing verifier module, followed by a repository-level failure listing all five duplicate pairs, doubled NIP-04 grouped work, and missing verifier registration
- Green implementation: focused verifier tests 10/10 and `npm run commands:verify` pass; public CLI success/nonzero diagnostic failure paths and npm restart explicit/optional-stop/mandatory-start semantics are covered
- Refactor: canonical command names and one root README inventory
- Commands run:
  - `npm run example:basic`
  - `npm run example:messaging`
  - `npm run lint`
  - `npx tsc --noEmit -p tsconfig.json`
  - `npm run build:examples`
  - `npm run build`
  - `npm run pack:verify`
  - `git diff --check`

## Review Instructions

Review only this #106 slice unless a severe cross-slice regression is visible. Keep standards and spec findings separate.

Check:

- The verifier catches the promised failure modes without masking real references behind broad exclusions.
- Nested-package commands are not mistaken for root package groups.
- The canonical README table covers every runnable script exactly once.
- Removed aliases and group changes match the ticket exactly.
- No package-manager, Node support, lockfile, release, or unrelated runtime behavior changed.
- Tests exercise behavior through exported verifier helpers and the public CLI contract.

## Reviewer Output

```text
STANDARDS_STATUS: pass | changes_requested
STANDARDS_FINDINGS:
- ...

SPEC_STATUS: pass | changes_requested | skipped
SPEC_FINDINGS:
- ...
```
