# Review Packet: #137 Default Test Feedback Loop

## Issue

- Issue: #137
- Slice type: AFK test-infrastructure cleanup
- Acceptance criteria: reproducible timing evidence; deterministic removal of avoidable waits; materially faster routine lane; explicit slow security/performance lane; complete Node and Bun CI assurance
- Baseline: `8b970e4`
- Current diff: working branch against `8b970e4`

## Implementation Summary

The default Jest and Bun commands now run a canonical routine inventory, while two explicitly named security/performance load suites run in a slow lane. A small CommonJS lane module owns discovery and membership for Node 16 compatibility. CI runs routine and slow steps on Node 16, 18, 20, and Bun; Node 20 coverage uses the complete inventory. Parser-only NIP-46 validation cases no longer pay public-client teardown delays, cutting the hosted-fix default Jest wall time from 58.793s to 32.356s (45.0%).

## Implementation Evidence

- `implement` session: `issue-137-session.md`
- `tdd` used: lane-contract test failed before the module and wiring existed
- Routine Jest: 84 suites / 1063 tests / 32.356s
- Slow Jest: 2 suites / 40 tests / 43.154s
- Routine Bun: 84 files / 1063 tests / 190.68s
- Slow Bun: 2 files / 40 tests / 40.42s
- Full union: 86 suites/files / 1103 tests in each runtime
- Complete Jest coverage command: 86 suites / 1103 tests / 49.078s; 80.51% statement coverage

## Review Instructions

Review only issue #137 unless a severe cross-slice regression appears. Verify that the lane inventory is canonical and complete; routine and slow sets are disjoint; targeted Jest paths still work; command forwarding and exit codes are preserved; CI runs both sets for every supported runtime; coverage includes all tests; input-validation changes retain public integration coverage while parser-only cases remain direct; and the before/after evidence is reproducible.

## Reviewer Output

```text
STANDARDS_STATUS: pass
STANDARDS_FINDINGS:
- P2 documentation command mismatch corrected in AGENTS.md and CLAUDE.md

SPEC_STATUS: pass
SPEC_FINDINGS:
- none; final pinned-Bun Grok follow-up passed standards and spec

CODERABBIT_STATUS: compatibility implementation clean; final wording fix committed, zero-finding retry pending after CLI cooldown
CODERABBIT_FINDINGS:
- major: include Jest-compatible .spec.* files in canonical discovery — fixed with a red/green regression test
- minor: assert routine and complete coverage wiring — fixed
- minor: replace the ledger baseline hash with the implementation commit — fixed
- hosted minor: synchronize the top-level run status — fixed
- hosted minor: dynamically discover new routine tests during Bun watch without admitting slow paths — fixed with a red/green pure argument-builder test
- hosted minor: document standalone Jest and Bun slow commands — fixed
- hosted major: directly cover spawned Bun argument construction for dynamic watch and fixed non-watch modes — fixed
- Grok P1: replace Bun 1.3.11-only path ignores with pinned-1.3.9-compatible `[slow]` name filtering — fixed and exercised with the Bun 1.3.9 binary
- Grok P2: record hosted-fix commit `295d114` in the ledger — fixed
```
