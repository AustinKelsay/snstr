# Review Packet: #119 Canonical Package-manager Policy

## Fixed Point

- Base: `staging` at `1838789`
- Branch: `feature/package-manager-policy`
- Issue: #119

## Change Story

- npm 9.8.1 is the canonical dependency and release manager across metadata, CI, and contributor documentation.
- Bun 1.3.9 remains a pinned, frozen-lockfile compatibility lane.
- The obsolete root `pnpm-lock.yaml` is removed.
- A tested repository verifier rejects manager, lockfile, Bun-pin, and active CI-command drift and reports malformed inputs without stack traces.

## Verification

- Clean installs: npm 9.8.1 `ci`; Bun frozen lockfile
- Focused verifier tests after review: 2 suites, 19/19
- Local CodeRabbit: 7 findings; 5 fixed, 2 evidence-based skips
- Full Jest: 79 suites, 1033/1033
- Coverage: 79 suites, 1033/1033; 77.38% statements / 64.43% branches
- Full Bun: 1033/1033
- Commands, lint, CJS/ESM build, examples build, and pack verification: pass

## Known Tooling Limitation

- Grok could not be delegated because the required `agent` CLI is unauthenticated. Per the Grok skill, no substitute subagent was used.
