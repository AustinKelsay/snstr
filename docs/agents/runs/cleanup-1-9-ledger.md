# Feature Dev Run Ledger: High-impact Cleanup 1–9

## Run

- Run ID: `snstr-cleanup-1-9-20260718`
- Loop: nine sequential `feature-dev` runs
- Target repo: `snstr`
- Base branch: `staging`
- Feature branches: one branch per approved ticket, created from the latest integrated `staging`
- Human owner: plebdev
- Started: 2026-07-18
- Current status: items 1–3 / issues #131–#133 merged into `staging`; item 4 / issue #134 passed independent review and is entering local CodeRabbit review
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
- Agent briefs: Grok 4.5 is the exclusive delegated sidecar; Cursor exposes the highest available tier as `cursor-grok-4.5-high`, which is used for all standards/spec passes
- Review packets: `issue-131-review-packet.md`, `issue-132-review-packet.md`, `issue-133-review-packet.md`; created per later ticket
- Local CodeRabbit report: `issue-131-coderabbit-local.md`, `issue-132-coderabbit-local.md`, `issue-133-coderabbit-local.md`; created per later ticket
- PR URL: #140 merged for issue #131; #141 merged for issue #132; #142 merged for issue #133; created per later ticket, always non-draft and targeting `staging`

## Commands

- Install: `npm ci`; compatibility lane `bun install --frozen-lockfile`
- Typecheck: `npx tsc --noEmit -p tsconfig.json` and packed-consumer checks where relevant
- Test: focused Jest/Bun suites during TDD; full Jest and Bun suites once per issue
- Build: `npm run commands:verify && npm run package-manager:verify && npm run lint && npm run build && npm run build:examples && npm run pack:verify`
- Visual verification: not applicable

## Ticket Ledger

| Issue                             | Type | Status          | Branch                                  | Review                                                    | Verified                                  |
| --------------------------------- | ---- | --------------- | --------------------------------------- | --------------------------------------------------------- | ----------------------------------------- |
| #131 NIP-46 diagnostic redaction  | AFK  | merged          | `feature/nip46-diagnostic-redaction`    | Grok approved; CodeRabbit local/hosted clean after fixes  | Jest/Bun 1054/1054; hosted CI green       |
| #132 published declaration purity | AFK  | merged          | `feature/public-type-test-purity`       | Grok pass; CodeRabbit local/hosted clean                  | Jest/Bun 1055/1055; hosted CI green       |
| #133 shared diagnostic seam       | AFK  | merged          | `feature/shared-diagnostics-completion` | Grok standards/spec pass; local and hosted clean           | Jest/Bun 1067/1067; hosted CI green       |
| #134 NIP-47 service lifecycle     | AFK  | local review    | `feature/nip47-service-lifecycle`       | Grok standards/spec pass after race fixes                 | focused Jest/Bun 6/6; NIP-47 Jest green   |
| #135 NIP-57 consolidation         | AFK  | blocked by #134 | `feature/nip57-client-consolidation`    | pending                                                   | pending                                   |
| #136 NIP-46 protocol core         | AFK  | blocked by #135 | `feature/nip46-protocol-core`           | pending                                                   | pending                                   |
| #137 default test feedback loop   | AFK  | blocked by #136 | `feature/fast-default-test-loop`        | pending                                                   | pending                                   |
| #138 public behavior test seams   | AFK  | blocked by #137 | `feature/public-behavior-test-seams`    | pending                                                   | pending                                   |
| #139 ephemeral Relay internals    | AFK  | blocked by #138 | `feature/ephemeral-relay-internals`     | pending                                                   | pending                                   |

## Parked HITL Slices

| Issue | Why parked | Blocks | Required human action | Final PR decision |
| ----- | ---------- | ------ | --------------------- | ----------------- |
| None  | —          | —      | —                     | —                 |

## Issue Session Ledger

| Issue | Fixed point | Implementation owner                                | Commit                                     | Review result                                                        | Checks                                                                                        |
| ----- | ----------- | --------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| #131  | `f4bda34`   | current Codex orchestrator; Grok 4.5 High reviewers | `7ed8433`, `00104cc`, `21b4ad9`, `426c17b` | Grok approved after hosted fixes; CodeRabbit local code review clean | focused Jest/Bun 7/7; final Jest/Bun 1054/1054; policies, lint, types, builds, examples, pack |
| #132  | `cf705f0`   | current Codex orchestrator; Grok 4.5 High reviewers | `0c111d7`, `20565a0`, `abfc836`, `dea7aa0` | Grok passed; CodeRabbit local/hosted clean after four local fixes    | focused 8/8; Jest/Bun 1055/1055; all local gates and four hosted lanes green                  |
| #133  | `46d7289`   | current Codex orchestrator; Grok 4.5 High reviewers | `b238461`, `6dd75c3`, `ae15ace`             | Grok standards/spec passed; CodeRabbit local/hosted clean           | focused 204/204; Jest/Bun 1067/1067; all local gates and four hosted lanes green               |

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

- Resolved: Cursor CLI authentication completed. The skill's `grok-4.5-xhigh` alias is not present in the installed catalog; the highest available Grok 4.5 tier, `cursor-grok-4.5-high`, is used and verified.
