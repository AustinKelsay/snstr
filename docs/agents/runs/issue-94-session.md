## Issue

- Issue: #94 — Correct coverage exclusions
- Fixed point before session: `1334370`
- Worker session: Luna-high worker, completed by the orchestrator after worker capacity exhaustion
- Commit: `e77c49c`
- Status: implementation and independent review complete

## Implementation

- Public interface used: Jest's collected coverage report
- Behavior covered: nested NIP and signer index implementations are measured while declaration files and the two aggregation-only entry barrels remain excluded
- Baseline: 65 suites / 865 tests; nested index implementations were absent from `coverage/lcov.info`
- Green evidence: 66 suites / 868 tests; 23 nested index modules are present in `coverage/lcov.info`; `src/index.ts`, `src/entries/index.web.ts`, and declaration files are absent
- Commands: `npm run test:coverage -- --runInBand`, coverage inventory checks

## Review

- Standards review: pass, zero findings
- Spec review: pass, zero findings
- Worthy fixes: none

## Risks

- Coverage percentages will move as previously hidden implementation modules become visible; that is the intended correction.
