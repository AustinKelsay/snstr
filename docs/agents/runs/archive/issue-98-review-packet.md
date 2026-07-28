## Issue

- Issue: #98 — Reduce duplicate export maintenance
- Acceptance criteria: enforce public-entry parity and prove the selected browser/React Native graph is platform-safe
- Commits: `5614605`, `292d90b`, `b622656`, `70b7eb8`

## Evidence

- Runtime parity test permits exactly 16 documented Node-only exports.
- Browser and React Native conditions precede import/require/default and resolve to the web entry.
- Package verification passes across 46 reachable web modules and recognizes exactly three guarded Node crypto fallbacks.
- TypeScript resolves root and NIP-04 browser/React Native consumers to the platform-safe declarations; the source-only Jest test passes with `dist/` absent.
- Final integrated coverage passed (66 suites / 879 tests); standards and spec re-reviews passed.

## Reviewer Output

```text
STANDARDS_STATUS: pass
STANDARDS_FINDINGS: none

SPEC_STATUS: pass
SPEC_FINDINGS: none
```
