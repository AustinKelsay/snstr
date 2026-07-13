# Issue 91 Session

## Issue

- Issue: #91 — Separate production library builds from tests and examples
- Fixed point before session: ticket #90 commit on `feature/cleanup-logging-web-build`
- Worker session: current orchestrator
- Commit: ticket commit on `feature/cleanup-logging-web-build`
- Status: implementation complete; ticket verification passed

## Inputs

- Spec issue: #88 — https://github.com/AustinKelsay/snstr/issues/88
- Ticket: #91 — https://github.com/AustinKelsay/snstr/issues/91
- Relevant glossary terms: production library build, dev typecheck, example build, CJS, ESM
- Relevant ADRs: none
- Prototype answer and source branch, if any: none

## Implementation

- Public interface used: `npm run build`, `npm run build:examples`, and the existing package entry targets
- Behaviors covered: production CJS/ESM builds compile only `src`; explicit example compilation remains available; development typecheck still includes tests/examples; package targets remain present
- `tdd` used: build-boundary verification was run against the pre-change output before implementing the config split, then repeated after implementation; `pack:verify` now guards the boundary
- Commands run during implementation:
  - baseline `npm run build` and output inspection
  - `npm run build`
  - `npm run build:examples`
  - `npx tsc --noEmit -p tsconfig.json`
  - production/dev `--listFilesOnly` boundary assertions
  - `npm run pack:verify`
  - CJS and ESM web-entry runtime export checks
- Full suite command: `npm test -- --runInBand --coverage=false` — 65 suites, 864 tests passed

## Review

- Review fixed point: ticket #90 commit
- Standards findings: none in the ticket slice
- Spec findings: none; acceptance criteria are met
- Worthy fixes applied: introduced `tsconfig.build.json` as the single source-only library config and made ESM inherit it
- Findings ignored with reasons: none

## Risks

- The separate example compiler continues to inherit development compiler settings intentionally, so its output includes imported source dependencies as well as example files.
