# Review Packet: #132 Published Declaration Purity

## Issue

- Issue: #132
- Slice type: AFK package declaration cleanup
- Acceptance criteria: root declarations contain no Jest ownership; extracted consumer typechecks without Jest; equivalent relay test context remains at `snstr/testing`; Node/web declaration parity remains green
- Baseline: `cf705f0`
- Current diff: `git diff staging...HEAD`

## Implementation Summary

The accidental `RelayTestContext` export has moved from the shared root/web type barrel to the existing Node-only `snstr/testing` boundary. Its mock slots now accept framework-neutral callables, including Jest mocks, without naming Jest. Pack verification scans all published declarations for Jest ownership and compiles an extracted consumer with library checking enabled and automatic ambient types disabled.

## Implementation Evidence

- `implement` session: `issue-132-session.md`
- `tdd` used: yes
- Red test: missing testing-entrypoint types and CJS/ESM declarations containing `jest.Mock`
- Green implementation: focused public type/entry suites, both builds, declaration scan, and extracted packed consumer
- Refactor: one test-only package boundary owns test context; production barrels own no test framework
- Commands run: focused Jest; CJS/ESM build; pack verification

## Review Instructions

Review only issue #132 unless a severe cross-slice regression appears. Keep standards and spec axes separate. Verify no published declaration names Jest, the extracted consumer cannot receive Jest ambient types, existing Jest mocks remain assignable to the framework-neutral type, and `snstr/testing` stays Node-only.

## Reviewer Output

```text
STANDARDS_STATUS: pass
STANDARDS_FINDINGS:
- Initial: `unknown[]` rejected specifically typed test doubles; public purity assertions and packed slot assignment were incomplete.
- Resolved: use a documented permissive callable, assert root/web absence, and exercise plain, typed, and Jest mocks at the testing boundary and in the packed consumer.
- Follow-up: no remaining findings.

SPEC_STATUS: pass
SPEC_FINDINGS:
- Initial: a temp consumer below the checkout could resolve workspace Jest types; declaration patterns and installed-artifact coverage were incomplete.
- Resolved: install the tarball in an OS temp directory, assert Jest packages are absent, scan all installed declarations for Jest ownership, and compile with `types: []` and `skipLibCheck: false`.
- Follow-up: no remaining findings.
```
