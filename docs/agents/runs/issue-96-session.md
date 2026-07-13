## Issue

- Issue: #96 — Remove unused maintenance surface
- Fixed point before session: `e77c49c`
- Worker session: current orchestrator through `implement`
- Commit: `40f01c9`
- Status: implementation and independent review complete

## Implementation

- Removed unused root `browserify` and `zod` dependencies and synchronized npm, Bun, and pnpm lockfiles.
- Preserved the NIP-07 example's own `browserify` dependency.
- Removed the unused synchronous security-validator event path while preserving canonical asynchronous event validation.
- Verification: lockfile-frozen installs, 3 focused suites / 56 tests, lint, typecheck, library/examples builds, package verification, and the NIP-07 example build.

## Review

- Standards review: pass, zero findings on fresh fallback after a reviewer stream disconnect
- Spec review: pass, zero findings
- Worthy fixes: none

## Risks

- The repository's pnpm lockfile remains v6 and was intentionally regenerated with pnpm 8.15.9; upgrading its lockfile format is separate work.
