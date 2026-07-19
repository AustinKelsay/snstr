# Issue Session: #137 Default Test Feedback Loop

## Issue

- Issue: #137
- Fixed point before session: `8b970e4`
- Worker session: current Codex orchestrator; Grok 4.5 High reviewers
- Commits: pending
- Status: implementation green; review and final gates pending

## Inputs

- Spec issue: #130
- Ticket: #137
- Relevant glossary terms: none; this slice changes test execution policy, not the domain model
- Relevant ADRs: none
- Prototype answer and source branch, if any: none

## Baseline

Reproducible command at `8b970e4`:

```bash
npx jest --json --outputFile=/tmp/snstr-issue-137-baseline.json
```

- Default Jest: 85 suites, 1096 tests, 58.793 seconds.
- Slowest suites: `input-validation` 58.171s; NIP-46 `performance-security` 47.215s; `connection-failures` 32.528s; `permissions` 28.841s; `core-functionality` 25.902s; NIP-47 `nip44-encryption` 25.519s.

## Implementation

- Public interface used: `npm test`, `npm run test:slow`, `npm run test:all`, and matching Bun commands
- Behaviors covered: one canonical slow-lane inventory; complete disjoint routine/slow partition; targeted Jest invocation compatibility; explicit routine and slow CI steps on Node 16/18/20 and Bun; complete coverage on Node 20
- `tdd` used: yes; `tests/scripts/test-lanes.test.ts` failed before the lane module and script/CI wiring existed, then passed after the runner was implemented
- Slow lane: only `tests/nip44/nip44-performance-security.test.ts` and `tests/nip46/performance-security.test.ts`
- Deterministic cleanup: parser-only NIP-46 input-validation cases now invoke `parseConnectionString` directly, and teardown disconnects only clients that successfully connected
- Compatibility: Jest routine selection uses a generated ignore pattern, preserving `npm test -- path/to/test` targeting; Bun receives an explicit routine file inventory

## Timing Evidence

| Lane | Suites | Tests | Time |
| --- | ---: | ---: | ---: |
| Baseline default Jest | 85 | 1096 | 58.793s |
| Routine Jest | 84 | 1061 | 34.888s |
| Slow Jest | 2 | 40 | 43.189s |
| Routine Bun | 84 | 1061 | 190.47s |
| Slow Bun | 2 | 40 | 40.38s |

- The conservative final routine Jest run improved by 40.7%, exceeding the 40% target; an earlier confirming run completed in 32.309s.
- `input-validation` dropped from 58.171s in the baseline parallel run to 31.561s in the conservative final routine run; its isolated Jest run is 25.294s.
- Routine plus slow remains the complete 86-suite, 1101-test assurance set in both runtimes.

## Review

- Review fixed point: `8b970e4`
- Design findings: Grok selected a two-file named security/performance lane, required full CI union coverage, and identified parser validation as the largest deterministic low-hanging wait removal
- Standards findings: passed; the documentation command contract was corrected so complete coverage consistently names `test:coverage:all`
- Spec findings: passed with no P0/P1 findings
- Worthy fixes applied: aligned `AGENTS.md` and `CLAUDE.md` with the routine-versus-complete coverage contract
- Findings ignored with reasons: pending final review

## Verification

- Focused Jest/Bun input-validation: 33/33 in each runtime
- Lane contract: 5/5
- Routine Jest: 84/84 suites, 1061/1061 tests
- Slow Jest: 2/2 suites, 40/40 tests
- Routine Bun: 84 files, 1061/1061 tests
- Slow Bun: 2 files, 40/40 tests
- Repository gates: command/package-manager policy, ESLint, strict TypeScript, build, examples, and pack pending final pass

## Risks

- `npm test` is now intentionally routine rather than complete; README and CI make `test:all` the explicit full assurance command.
- Focused NIP scripts remain unchanged and may include a slow file; this preserves existing contributor expectations.
- Slow membership is enforced by a tested canonical inventory so new files cannot silently become orphaned.

| Issue | Why parked | Blocks | Required human action | Final PR decision |
| ----- | ---------- | ------ | --------------------- | ----------------- |
| None  | —          | —      | —                     | —                 |
