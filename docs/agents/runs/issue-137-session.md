# Issue Session: #137 Default Test Feedback Loop

## Issue

- Issue: #137
- Fixed point before session: `8b970e4`
- Worker session: current Codex orchestrator; Grok 4.5 High reviewers
- Commits: `0de11d9`, `91ffafa`, `45a1a4f`, `295d114`, `d8de419`; final review-record commit pending
- Status: Bun 1.3.9 watch compatibility fix green; metadata review fix pending on PR #146

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
| Routine Jest | 84 | 1063 | 32.356s |
| Slow Jest | 2 | 40 | 43.154s |
| Routine Bun | 84 | 1063 | 190.68s |
| Slow Bun | 2 | 40 | 40.42s |

- The hosted-fix routine Jest run improved by 45.0%, exceeding the 40% target.
- `input-validation` dropped from 58.171s in the baseline parallel run to 29.015s in the post-review routine run; its isolated Jest run is 25.294s.
- Routine plus slow remains the complete 86-suite, 1103-test assurance set in both runtimes.

## Review

- Review fixed point: `8b970e4`
- Design findings: Grok selected a two-file named security/performance lane, required full CI union coverage, and identified parser validation as the largest deterministic low-hanging wait removal
- Standards findings: passed; the documentation command contract was corrected so complete coverage consistently names `test:coverage:all`
- Spec findings: passed with no P0/P1 findings
- Worthy fixes applied: aligned `AGENTS.md` and `CLAUDE.md` with the routine-versus-complete coverage contract; expanded discovery to Jest-compatible `.spec.*` files; pinned routine and complete coverage wiring in tests; recorded the actual implementation commit in the ledger
- Findings ignored with reasons: none; all three local CodeRabbit findings were valid and fixed
- CodeRabbit result: clean committed rerun with zero findings after fixes
- Grok follow-up: standards and spec both passed after the CodeRabbit delta with no findings
- Hosted CodeRabbit findings: accepted all four; synchronized the run status, documented standalone slow commands, and made routine Bun watch discovery dynamic through a tested pure argument builder while preserving fixed non-watch inventory
- Final Grok findings: the first hosted fix used a Bun 1.3.11-only ignore flag and the ledger omitted `295d114`; both were valid. The watch lane now uses Bun 1.3.9-supported name filtering, the slow inventory contract enforces `[slow]` on every top-level slow suite, and the ledger records the hosted-fix commit.

## Verification

- Focused Jest/Bun input-validation: 33/33 in each runtime
- Lane contract: 7/7 in Jest and Bun
- Routine Jest: 84/84 suites, 1063/1063 tests
- Slow Jest: 2/2 suites, 40/40 tests
- Routine Bun: 84 files, 1063/1063 tests
- Slow Bun: 2 files, 40/40 tests
- Pinned Bun 1.3.9 compatibility: routine name filter skipped all 40 slow tests across both slow files in 104 ms while the routine lane contract completed 7/7 checks
- Complete coverage before the hosted-fix regression test: 86/86 suites, 1102/1102 tests in 53.732s; final rerun pending
- Repository gates: command/package-manager policy, ESLint, strict TypeScript, CommonJS script syntax, build, examples, pack, and diff integrity all green

## Risks

- `npm test` is now intentionally routine rather than complete; README and CI make `test:all` the explicit full assurance command.
- Focused NIP scripts remain unchanged and may include a slow file; this preserves existing contributor expectations.
- Slow membership is enforced by a tested canonical inventory so new files cannot silently become orphaned.

| Issue | Why parked | Blocks | Required human action | Final PR decision |
| ----- | ---------- | ------ | --------------------- | ----------------- |
| None  | —          | —      | —                     | —                 |
