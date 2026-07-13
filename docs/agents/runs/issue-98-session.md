## Issue

- Issue: #98 — Reduce duplicate export maintenance
- Fixed point before session: `29a51d5`
- Worker session: current orchestrator with a bounded OpenCode free-model inspection
- Commits: `5614605`, `292d90b`, `b622656`, `70b7eb8`
- Status: implementation, independent review, and integrated verification complete

## Implementation

- Added executable Node/web public-export parity policy with an explicit Node-only allowlist.
- Restored safe web exports and corrected conditional-export ordering for browser and React Native resolution.
- Removed static web reachability to Node-only WebSocket modules through injectable in-memory transport registration.
- Extended package verification across the emitted web dependency graph, including static imports, dynamic imports, and literal requires; only three exact reviewed crypto fallbacks are allowed and stale exceptions fail.
- Aligned browser/React Native declaration resolution with the runtime entry for both the root and NIP-04 subpath, and verified it post-build through TypeScript's resolver.
- Verification: entry tests, final coverage run (66 suites / 879 tests), lint, typecheck, build, examples build, package verification, CJS/ESM parity, and real browser/React Native condition resolution.

## Review

- Initial review found first-match condition ordering and transitive graph coverage gaps; both were fixed.
- Follow-up review found dynamic import/require parsing gaps; fixed in `b622656`.
- Branch-wide fallback review found unconditional Node declarations and an initial clean-CI test-order issue; both were fixed in `70b7eb8`.
- Final standards and spec re-reviews: pass, zero actionable findings.

## Risks

- Browser and React Native intentionally share the same emitted web entry.
- Three crypto references are exact, runtime-guarded compatibility fallbacks; the verifier fails any new or stale exception.
