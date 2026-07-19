# Review Packet: #133 Shared Diagnostic Seam

## Issue

- Issue: #133
- Slice type: AFK diagnostic consolidation
- Acceptance criteria: only the canonical logger writes to console; Relay, RelayPool, and stateless warning/error behavior remains compatible; levels and safe context follow ADR 0002; public seams cover configuration, silence, and compatibility
- Baseline: `46d7289`
- Current diff: `git diff staging...HEAD`

## Implementation Summary

Every production TypeScript module now delegates diagnostics to the canonical logger boundary. Stateful clients accept and propagate one additive `DiagnosticLogger`; stateless helpers accept the same contract through trailing parameters or existing options bags. Defaults retain WARN/ERROR console visibility, injected sinks are non-throwing, and unsafe raw relay values, protocol payloads, events, and error messages are replaced by stable structured metadata. No mutable package-global configuration or new logger contract was introduced.

## Implementation Evidence

- `implement` session: `issue-133-session.md`
- `tdd` used: yes
- Red test: logger properties/arguments were rejected by Relay, RelayPool, Nostr, NIP-65, and NIP-11; the structural gate listed direct production console owners
- Green implementation: focused affected suites 204/204, final shared-seam regression 11/11, strict TypeScript and lint green; secret-prefix, error-name, parent-policy, existing-child replacement, and unknown-wire regressions failed before their fixes and passed afterward; final Jest and Bun runs each passed 1067/1067 tests
- Refactor: one internal diagnostics module owns default construction, sink protection, failure typing, and relay-identifier redaction; the canonical logger remains the only console writer
- Commands run: focused and full Jest, full Bun, source console scan, command/package-manager policy verification, ESLint, strict TypeScript, CJS/ESM builds, example build, and pack verification

## Review Instructions

Review only issue #133 unless a severe cross-slice regression appears. Keep standards and spec axes separate. Verify there is no production console ownership outside the canonical logger, defaults retain visible warnings/errors, injected loggers can silence and capture output without changing control flow, structured context is safe, and ADR 0002 compatibility aliases remain unchanged.

## Reviewer Output

```text
STANDARDS_STATUS: pass
STANDARDS_FINDINGS:
- no hard findings after fixing the raw Relay URL prefix and unknown relay wire label leaks
- optional follow-ups only: test-only Nostr silence and DEBUG metadata shape

SPEC_STATUS: pass
SPEC_FINDINGS:
- no missing, partial, over-scoped, or incorrectly implemented criteria
- raw Relay prefix, bounded failure type, parent policy, runtime replacement, unknown-wire redaction, and shared default-factory fixes verified
```
