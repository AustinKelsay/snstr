# Issue Session: #106 Command Inventory Cleanup

## Issue

- Issue: [#106 — Collapse package-script and README command duplication](https://github.com/AustinKelsay/snstr/issues/106)
- Fixed point before session: `fc4e3b5`
- Worker session: `/root/issue_106_worker`
- Commit: pending
- Status: standards + spec review passed; commit pending

## Inputs

- Spec issue: [#100 — Eliminate remaining runtime and maintenance debt](https://github.com/AustinKelsay/snstr/issues/100)
- Ticket: remove exact package-script aliases and duplicate grouped execution, consolidate the root README command inventory, and add durable command-reference verification
- Relevant glossary terms: runnable script, canonical command, grouped command, leaf execution, Markdown command reference
- Relevant ADRs: none; this ticket preserves package-manager and Node support
- Prototype answer and source branch, if any: none

## Implementation

- Public interface used: root `package.json` scripts, `npm run commands:verify`, runnable example groups, and literal Markdown `npm run <script>` references
- Behaviors covered:
  - exact duplicate runnable command values are rejected while `//` section headings are ignored
  - root `npm run` dependency graphs and supported npm lifecycle shorthands (`test`, `start`, `stop`, and `restart`) are expanded recursively to reject missing targets, cycles, and repeated leaf work; absent `restart` scripts correctly fall back to optional `stop` and mandatory `start`
  - commands delegated to a nested package with a leading `cd` are not misclassified as root dependencies
  - literal Markdown `npm run <script>` references must resolve, with only the exact `example:nipXX` and `test:nipXX` templates excluded
  - the root README contains exactly one complete `## Command Reference`, with every runnable script listed once, no unknown names, and definitions matching `package.json`
  - the public CLI is exercised through `npm run commands:verify` for both successful and failing repositories, including nonzero failure status and diagnostics
  - canonical NIP command names replace five redundant aliases, and grouped basic/messaging examples execute NIP-04 only once
- `tdd` used: yes
  - red 1: the focused Jest suite failed because `scripts/verify-commands.js` did not exist
  - red 2: after adding the pure helpers, the repository-level test reported all five exact duplicate pairs, the doubled NIP-04 leaf in `example:messaging`, and the missing `commands:verify` registration
  - green: ten focused verifier tests and the public CLI pass after the canonical script, documentation, and review-driven durability changes
- Commands run during implementation:
  - `npx jest tests/scripts/verify-commands.test.ts --runInBand --coverage=false` (red missing module; red repository inventory; final 10/10 passed)
  - `npm run commands:verify` (passed: zero duplicate values, missing group targets, cycles, duplicate leaves, missing Markdown refs, or README inventory drift)
  - `npm run example:basic` (passed; base, crypto, and canonical NIP-04 ran once each)
  - `npm run example:messaging` (passed; exactly NIP-04, NIP-44, and NIP-17 ran once each)
  - `npm run lint` (passed)
  - `npx tsc --noEmit -p tsconfig.json` (passed)
  - `npm run build:examples` (passed)
  - `npm run build` (passed; CJS and ESM)
  - `npm run pack:verify` (passed: 16 referenced targets, 304 packed files, 49 web modules, 3 guarded Node fallbacks)
  - `git diff --check` and removed-alias/reference searches (passed)
- Full suite command: deferred to the final integrated feature run; this docs/tooling slice will run proportional focused tests and all required ticket checks

## Review

- Review fixed point: `fc4e3b5`
- Standards findings: final review passed with no findings; earlier reviews requested lifecycle shorthand graph edges, public CLI failure-path coverage, README definition-value validation, and accurate explicit/absent npm restart behavior
- Spec findings: final review passed with no findings; an earlier review established that fallback `start` is mandatory and must remain a missing target when absent
- Worthy fixes applied:
  - canonicalized `npm test`, `npm start`, `npm stop`, and `npm restart` as root script graph edges and added an adversarial duplicate-leaf regression
  - added public `npm run commands:verify` happy-path and failing temporary-repository tests that assert status and diagnostics
  - made the canonical README table validator compare every displayed definition to the matching `package.json` value, with stale-definition coverage
  - modeled npm restart accurately for both explicit `restart` scripts and the absent-script `stop`/`start` fallback, with adversarial duplicate-leaf coverage for each path
  - preserved optional `stop` but made fallback `start` mandatory, so a missing start script is diagnosed exactly as the real npm lifecycle fails
- Findings ignored with reasons: none

## Risks

- None. Placeholder exclusions are limited to the exact `example:nipXX` and `test:nipXX` templates, and nested-package commands are excluded only when the root command begins with `cd`.
