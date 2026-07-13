## Issue

- Issue: #97 — Move shared logger to core utilities
- Fixed point before session: `3daf6ad`
- Worker session: Luna-high worker, completed by the orchestrator after worker capacity exhaustion
- Commits: `1334370`, `29a51d5`
- Status: implementation and independent review complete

## Implementation

- Moved the unchanged logger implementation to `src/utils/logger.ts`.
- Retained `src/nip46/utils/logger.ts` as a compatibility re-export with runtime identity covered by tests.
- Migrated production internals and NIP-46 examples to the core location.
- Verification: focused logger tests, typecheck, lint, library build, and examples build.

## Review

- Standards review: initial locality concern fixed by migrating examples; re-review pass, zero findings
- Spec review: pass, zero findings on fresh fallback after a reviewer stream disconnect
- Rejected suggestion: adding a new package export was not required because neither deep source path was a supported package subpath.

## Risks

- The old source path remains intentionally available as a compatibility seam for repository consumers.
