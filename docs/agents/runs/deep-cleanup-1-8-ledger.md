# Feature Dev Run Ledger: Deep Cleanup 1–8

## Run

- Run ID: `snstr-deep-cleanup-1-8-20260718`
- Loop: eight sequential `feature-dev` runs
- Target repo: `snstr`
- Base branch: `staging`
- Feature branches: one branch per approved ticket, rebased from the latest integrated `staging`
- Human owner: plebdev
- Started: 2026-07-18
- Current status: issues #112, #118, #113, #114, #115, and #116 merged into `staging`; issue #117 implementation and local review verified
- Skill setup status: present and verified (`AGENTS.md`, GitHub issue tracker, triage labels, single-context domain docs)

## Goal

Complete cleanup items 1–8 from the post-v0.5.0 repository audit end to end, branch by branch, with each healthy slice integrated into `staging`: make NIP-44 legacy behavior explicit, deepen Relay, extract NIP-47 protocol machinery, deepen the Nostr facade, clarify ephemeral Relay ownership, consolidate security validation, centralize NIP-01 message types, and make package-manager policy canonical.

## Durable Artifacts

- CONTEXT updates: none currently required; existing Nostr Event, Relay, Subscription Filter, and NIP terms cover the work
- ADRs: none currently required; public compatibility is preserved and each internal extraction is independently reversible
- Prototype source branch, if any: none
- Spec issue: #111 — Deepen core protocol modules and remove remaining maintenance drift
- Tickets: #112–#119
- Ticket sessions: created as each ticket starts
- Agent briefs: Grok 4.5 is the only owner-approved delegated sidecar; `agent` authentication was unavailable at preflight, so no substitute subagent is used and Codex owns local execution/review
- Review packets: created per ticket
- Local CodeRabbit report: issue #112 round completed with five worthy fixes in `issue-112-coderabbit-local.md`
- PR URLs: #120 for issue #112, #121 for issue #118, #122 for issue #113, #123 for issue #114, #124 for issue #115, #125 for issue #116 (all merged); later tickets pending

## Commands

- Install: `npm ci`; compatibility lane `bun install --frozen-lockfile`
- Typecheck: `npx tsc --noEmit -p tsconfig.json` and `npx tsc --noEmit -p examples/tsconfig.json`
- Test: targeted Jest/Bun suites per ticket; `npm test -- --runInBand --detectOpenHandles`; `npm run test:bun`
- Build: `npm run commands:verify && npm run lint && npm run build && npm run build:examples && npm run pack:verify`
- Visual verification: not applicable

## Ticket Ledger

| Issue                                | Type | Status                                                 | Branch                                  | Review                                                                                                   | Verified                                                                                                            |
| ------------------------------------ | ---- | ------------------------------------------------------ | --------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| #112 NIP-44 legacy behavior          | AFK  | merged into `staging`                                  | `feature/nip44-legacy-compat`           | standards/spec pass; local CodeRabbit 5 fixed; hosted CodeRabbit 3 fixed                                 | yes                                                                                                                 |
| #118 authoritative protocol messages | AFK  | merged into `staging`                                  | `feature/protocol-message-types`        | standards/spec pass; local CodeRabbit 4 fixed, 1 evidence-based skip; hosted 2 fixed                     | Jest 994/994; Bun full; hosted Node 16/18/20 + Bun; commands, lint, types, builds, pack                             |
| #113 Relay event-store seam          | AFK  | merged into `staging`                                  | `feature/relay-event-store`             | standards/spec pass; local CodeRabbit 4 fixed; hosted clean                                              | focused Jest/Bun 80/80; full Jest/Bun 1013/1013; hosted Node 16/18/20 + Bun; commands, lint, types, builds, pack    |
| #114 NIP-47 protocol machinery       | AFK  | merged into `staging`                                  | `feature/nip47-protocol-codecs`         | standards/spec pass; local CodeRabbit 2 fixed, 7 compatibility skips; hosted 3 fixed; final hosted clean | focused 71/71; full Jest/Bun 1021/1021; hosted Node 16/18/20 + Bun; commands, lint, types, builds, pack             |
| #115 Nostr relay registry            | AFK  | merged into `staging`                                  | `feature/nostr-relay-registry`          | standards/spec pass; local CodeRabbit 1 fixed; hosted clean                                              | focused 61/61; full Jest/Bun 1026/1026; hosted Node 16/18/20 + Bun; commands, lint, types, builds, pack             |
| #116 ephemeral Relay ownership       | AFK  | merged into `staging`                                  | `feature/ephemeral-relay-ownership`     | standards/spec pass; local CodeRabbit clean; hosted 2 fixed, 2 unrelated skips; final hosted clean       | focused 25/25; full Jest/Bun 1026/1026; hosted Node 16/18/20 + Bun; commands, lint, types, builds, examples, pack   |
| #117 security validation ownership   | AFK  | merged into `staging`                                  | `feature/security-validation-ownership` | standards/spec pass; local CodeRabbit 1 fixed; hosted 2 fixed                                            | focused 273/273; coverage 231/231 and 81.19% branches; full Jest/Bun 1030/1030; commands, lint, types, builds, pack |
| #119 package-manager policy          | AFK  | implementation, local review, and full matrix verified | `feature/package-manager-policy`        | standards/spec pass; local CodeRabbit 5 fixed, 2 evidence-based skips                                    | clean npm/Bun installs; focused 19/19; full Jest/Bun 1033/1033; coverage, commands, lint, builds, examples, pack    |

## Parked HITL Slices

| Issue | Why parked | Blocks | Required human action | Final PR decision |
| ----- | ---------- | ------ | --------------------- | ----------------- |
| None  | —          | —      | —                     | —                 |

## Issue Session Ledger

| Issue | Fixed point | Implementation owner                                           | Commit                   | Review result                                                                                                                    | Checks                                                                                                                             |
| ----- | ----------- | -------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| #112  | `df13432`   | current Codex orchestrator; Grok unavailable at auth preflight | PR #120, merge `c7cb99f` | standards/spec pass after one fix; local CodeRabbit 5/5 and hosted CodeRabbit 3/3 fixed                                          | NIP-44 107/107; Jest 991/991; Bun 991/991; hosted Node 16/18/20 + Bun; lint, types, builds, commands, pack                         |
| #118  | `c7cb99f`   | current Codex orchestrator; Grok unavailable at auth preflight | PR #121, merge `8c36233` | standards/spec pass; local CodeRabbit 4 fixed, 1 skipped with type evidence; hosted 2/2 fixed                                    | Jest 994/994; Bun full; hosted Node 16/18/20 + Bun; commands, lint, types, builds, pack                                            |
| #113  | `8c36233`   | current Codex orchestrator; Grok unavailable at auth preflight | PR #122, merge `da7361e` | standards/spec pass; local CodeRabbit 4/4 fixed; hosted clean                                                                    | focused Relay/store Jest and Bun 80/80; full Jest/Bun 1013/1013; hosted Node 16/18/20 + Bun; commands, lint, types, builds, pack   |
| #114  | `da7361e`   | current Codex orchestrator; Grok unavailable at auth preflight | PR #123, merge `4e40b63` | standards/spec pass; local CodeRabbit 2 fixed, 7 skipped to preserve public compatibility; hosted 3 fixed; final hosted clean    | focused NIP-47 71/71; full Jest/Bun 1021/1021; hosted Node 16/18/20 + Bun; commands, lint, types, builds, pack                     |
| #115  | `4e40b63`   | current Codex orchestrator; Grok unavailable at auth preflight | PR #124, merge `9e3aca8` | standards/spec pass; local CodeRabbit 1/1 fixed; hosted clean                                                                    | focused Nostr/registry/integration 61/61; full Jest/Bun 1026/1026; hosted Node 16/18/20 + Bun; commands, lint, types, builds, pack |
| #116  | `9e3aca8`   | current Codex orchestrator; Grok unavailable at auth preflight | PR #125, merge `94eed4a` | standards/spec pass; local CodeRabbit clean; hosted 2/2 package findings fixed, 2 unrelated NIP-02 findings skipped; final clean | focused 25/25; full Jest/Bun 1026/1026; hosted Node 16/18/20 + Bun; commands, lint, types, builds, examples, pack                  |
| #117  | `94eed4a`   | current Codex orchestrator; Grok unavailable at auth preflight | PR #126, merge `1838789` | standards/spec pass; local CodeRabbit 1/1 fixed; hosted 2/2 fixed; final hosted clean                                            | focused 273/273; coverage 231/231 with 81.19% aggregate branches; full Jest/Bun 1030/1030; hosted Node 16/18/20 + Bun; all gates   |

## Alignment Decisions

- The ranked audit list is the authoritative scope for cleanup items 1–8.
- The owner's instruction grants approval for the public testing seams, eight-ticket granularity, dependency graph, and agent-performable AFK classification.
- Each ticket uses a dedicated branch and PR, then integrates into `staging` before dependent work begins; this intentionally runs the Feature Dev loop back to back rather than putting all tickets on one feature branch.
- Existing public interfaces are preserved unless authoritative NIP-44 evidence proves current legacy behavior incorrect or unsupported.
- Grok is the exclusive delegated system. If unavailable, the Grok skill requires recording the limitation and local completion; no alternate subagent is substituted.
- Production deployment and release promotion remain out of scope.

## Open Questions

- None.

## Escalations

- Grok preflight: the `agent` and Node CLIs exist, but `agent models` requires authentication. This does not block local work under the Grok skill fallback.
