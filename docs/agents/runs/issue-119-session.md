# Issue Session: #119 Canonical Package-manager Policy

## Scope

- Fixed point: `1838789` (`staging` after PR #126)
- Branch: `feature/package-manager-policy`
- Issue: #119
- Owner: current Codex orchestrator; Grok unavailable because `agent` authentication is required

## Acceptance Map

| Acceptance criterion                 | Implementation / verification seam                                                                  |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| npm owns installs and releases       | `packageManager`, contributor/release docs, pinned Corepack activation, and `npm ci`                |
| Bun remains a compatibility runner   | `.bun-version`, `bun.lock`, frozen install, and Bun CI lane                                         |
| Unsupported managers cannot drift in | root pnpm lock removed; verifier rejects pnpm, Yarn, and shrinkwrap locks                           |
| Metadata and CI remain consistent    | `package-manager:verify` validates manifests, locks, active workflow commands, and malformed inputs |
| Both clean-install paths work        | npm 9.8.1 clean install and frozen Bun install completed without lockfile drift                     |

## Decisions

- Pin npm 9.8.1 because it supports the Node 16/18/20 matrix and lockfile v3.
- Activate npm through Corepack in CI so the declared version is integrity-controlled instead of installed ad hoc.
- Keep the Bun pin at the repository's existing 1.3.9 policy; the local 1.3.11 runner also proved the frozen lock remains compatible.
