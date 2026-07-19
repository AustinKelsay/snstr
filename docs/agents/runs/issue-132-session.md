# Issue Session: #132 Published Declaration Purity

## Issue

- Issue: #132
- Fixed point before session: `cf705f0`
- Worker session: current Codex orchestrator; Grok 4.5 High reviewers
- Commit: pending
- Status: implementation, independent Grok review, and full verification complete; local CodeRabbit findings fixed with clean rerun pending

## Inputs

- Spec issue: #130
- Ticket: #132
- Relevant glossary terms: Relay
- Relevant ADRs: none
- Prototype answer and source branch, if any: none

## Implementation

- Public interface used: `snstr/testing` owns `RelayTestContext` and framework-neutral `RelayTestMock`; neither root nor web declarations expose test-runner types
- Behaviors covered: every packed declaration rejects Jest ownership; an extracted package consumer imports root and testing types with ambient type packages disabled; Node, browser, and React Native type resolution retain their existing targets
- `tdd` used: yes; the testing-entrypoint type test failed on missing exports and pack verification failed on both CJS and ESM `jest.Mock` declarations before implementation
- Commands run during implementation: focused Jest type/entry suites; CJS/ESM build; packed-consumer verification
- Full suite commands: `npm test -- --runInBand`; `npm run test:bun`; repository policy, lint, type, build, example, and pack gates

## Review

- Review fixed point: `cf705f0`
- Design findings: Grok recommended moving the context to the existing Node-only testing boundary, using framework-neutral callables, scanning every packed declaration, and compiling an extracted no-Jest consumer
- Standards findings: the first pass found that `unknown[]` made specifically typed doubles unassignable under strict function variance; it also requested root/web negative assertions and assignment of the exported mock type into packed-consumer context slots
- Spec findings: the first pass found that a consumer beneath the repository could still resolve workspace Jest types, the declaration scan needed namespace/import coverage, and scanning build output rather than the installed tarball left a packaging gap
- Worthy fixes applied: the mock callable uses a documented permissive parameter list; type tests lock root/web absence and typed/Jest mock compatibility; pack verification installs the tarball outside the repository, asserts Jest packages are absent, scans every installed declaration, and compiles a strict consumer that assigns the mock into context slots
- Findings ignored with reasons: none
- Follow-up result: Grok standards and spec reviews both passed with no remaining findings
- Local CodeRabbit findings: three minor findings accepted—event-specific callback keys, explicit missing consumer dependency diagnostics, and dynamic Jest type-import detection
- Local CodeRabbit fixes: mapped callback captures, dependency version guards, dynamic-import scan coverage, and a negative callback-key type assertion; focused and package gates remain green

## Verification

- Focused Jest: 3/3 suites, 8/8 tests
- CJS/ESM declarations: green
- Packed no-Jest consumer: green with `skipLibCheck: false` and automatic ambient types disabled
- Repository gates: commands/package-manager policy, lint, TypeScript, CJS/ESM builds, examples, and pack verification all green
- Full Jest: 81/81 suites and 1055/1055 tests in 296.062 seconds
- Full Bun: 1055/1055 tests and 8172 assertions across 81 files in 263.38 seconds
- Post-CodeRabbit focused verification: 3/3 suites and 8/8 tests; lint, strict TypeScript, CJS/ESM build, and pack verification green

## Risks

- `RelayTestContext` intentionally leaves the accidental root/web export and remains available from the documented `snstr/testing` subpath.
