# Feature Dev Run Ledger: High-impact Cleanup 1–9

## Run

- Run ID: `snstr-cleanup-1-9-20260718`
- Loop: nine sequential `feature-dev` runs
- Target repo: `snstr`
- Base branch: `staging`
- Feature branches: one branch per approved ticket, created from the latest integrated `staging`
- Human owner: plebdev
- Started: 2026-07-18
- Current status: item 1 / issue #131 in implementation on `feature/nip46-diagnostic-redaction`
- Skill setup status: present and verified (`AGENTS.md`, GitHub issue tracker, triage labels, domain docs, ADRs, CI, CodeRabbit)

## Goal

Complete cleanup items 1–9 from the staging audit end to end, branch by branch, with every healthy slice reviewed, verified, and merged into `staging`: redact NIP-46 diagnostics, remove Jest from published declarations, complete the shared diagnostic seam, make NIP-47 lifecycle restart-safe, consolidate NIP-57 behavior, unify the NIP-46 protocol core, shorten the default test loop, move tests off private shapes, and split ephemeral Relay internals.

## Durable Artifacts

- CONTEXT updates: none currently required; existing Nostr Event, Relay, Subscription Filter, and NIP terms cover the work
- ADRs: ADR 0002 governs compatible diagnostic consolidation; no new hard-to-reverse decision identified yet
- Prototype source branch, if any: none
- Spec issue: #130 — Complete the high-impact cleanup chain
- Tickets: #131–#139
- Ticket sessions: created as each ticket starts
- Agent briefs: Grok 4.5 is the exclusive delegated sidecar; authentication is pending at preflight and no substitute subagent is authorized
- Review packets: created per ticket
- Local CodeRabbit report: created per ticket
- PR URL: created per ticket, always non-draft and targeting `staging`

## Commands

- Install: `npm ci`; compatibility lane `bun install --frozen-lockfile`
- Typecheck: `npx tsc --noEmit -p tsconfig.json` and packed-consumer checks where relevant
- Test: focused Jest/Bun suites during TDD; full Jest and Bun suites once per issue
- Build: `npm run commands:verify && npm run package-manager:verify && npm run lint && npm run build && npm run build:examples && npm run pack:verify`
- Visual verification: not applicable

## Ticket Ledger

| Issue                             | Type | Status            | Branch                                  | Review  | Verified |
| --------------------------------- | ---- | ----------------- | --------------------------------------- | ------- | -------- |
| #131 NIP-46 diagnostic redaction  | AFK  | in implementation | `feature/nip46-diagnostic-redaction`    | pending | pending  |
| #132 published declaration purity | AFK  | blocked by #131   | `feature/public-type-test-purity`       | pending | pending  |
| #133 shared diagnostic seam       | AFK  | blocked by #132   | `feature/shared-diagnostics-completion` | pending | pending  |
| #134 NIP-47 service lifecycle     | AFK  | blocked by #133   | `feature/nip47-service-lifecycle`       | pending | pending  |
| #135 NIP-57 consolidation         | AFK  | blocked by #134   | `feature/nip57-client-consolidation`    | pending | pending  |
| #136 NIP-46 protocol core         | AFK  | blocked by #135   | `feature/nip46-protocol-core`           | pending | pending  |
| #137 default test feedback loop   | AFK  | blocked by #136   | `feature/fast-default-test-loop`        | pending | pending  |
| #138 public behavior test seams   | AFK  | blocked by #137   | `feature/public-behavior-test-seams`    | pending | pending  |
| #139 ephemeral Relay internals    | AFK  | blocked by #138   | `feature/ephemeral-relay-internals`     | pending | pending  |

## Parked HITL Slices

| Issue | Why parked | Blocks | Required human action | Final PR decision |
| ----- | ---------- | ------ | --------------------- | ----------------- |
| None  | —          | —      | —                     | —                 |

## Issue Session Ledger

| Issue | Fixed point | Implementation owner                          | Commit  | Review result | Checks  |
| ----- | ----------- | --------------------------------------------- | ------- | ------------- | ------- |
| #131  | `f4bda34`   | current Codex orchestrator; Grok auth pending | pending | pending       | pending |

## Alignment Decisions

- The ranked staging audit is the authoritative scope for cleanup items 1–9.
- The owner's instruction grants approval for the public testing seams, nine-ticket granularity, linear dependency graph, and agent-performable AFK classification.
- Each ticket uses a dedicated branch and PR, then integrates into `staging` before dependent work begins; this intentionally runs the Feature Dev loop back to back.
- Existing 0.x public interfaces remain compatible, except for removal of accidental Jest ownership from production declarations in issue #132.
- NIP-46 diagnostic redaction lands before the broader NIP-46 consolidation so the canonical engine inherits the safe policy.
- The shared core logger remains canonical and NIP-specific compatibility aliases protected by ADR 0002 remain through 0.x.
- Grok is the exclusive delegated system. CodeRabbit remains a required review gate and is not used as an implementation subagent.
- Production deployment, release, and promotion to `main` are out of scope.

## Open Questions

- None.

## Escalations

- Grok preflight: `agent` and Node are installed, but the Cursor CLI requires one-time browser authentication. The login session is waiting while local work proceeds.
