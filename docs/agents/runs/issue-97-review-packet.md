## Issue

- Issue: #97 — Move shared logger to core utilities
- Acceptance criteria: establish a core logger home, preserve compatibility, and migrate internal consumers
- Commits: `1334370`, `29a51d5`

## Evidence

- Compatibility and core imports resolve to the same runtime values.
- Production internals and examples use the core utility.
- Focused tests, lint, typecheck, library build, and examples build pass.

## Reviewer Output

```text
STANDARDS_STATUS: pass after example-import follow-up
STANDARDS_FINDINGS: none remaining

SPEC_STATUS: pass
SPEC_FINDINGS: none
```
