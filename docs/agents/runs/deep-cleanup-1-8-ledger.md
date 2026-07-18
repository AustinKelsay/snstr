# Feature Dev Run Ledger: Deep Cleanup 1–8

## Run

- Run ID: `snstr-deep-cleanup-1-8-20260718`
- Loop: eight sequential `feature-dev` runs
- Target repo: `snstr`
- Base branch: `staging`
- Feature branches: one branch per approved ticket, rebased from the latest integrated `staging`
- Human owner: plebdev
- Started: 2026-07-18
- Current status: issue #112 implementation and integrated verification complete; local CodeRabbit gate pending
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
- Local CodeRabbit report: created per branch
- PR URLs: recorded per ticket after push

## Commands

- Install: `npm ci`; compatibility lane `bun install --frozen-lockfile`
- Typecheck: `npx tsc --noEmit -p tsconfig.json` and `npx tsc --noEmit -p examples/tsconfig.json`
- Test: targeted Jest/Bun suites per ticket; `npm test -- --runInBand --detectOpenHandles`; `npm run test:bun`
- Build: `npm run commands:verify && npm run lint && npm run build && npm run build:examples && npm run pack:verify`
- Visual verification: not applicable

## Ticket Ledger

| Issue | Type | Status | Branch | Review | Verified |
| --- | --- | --- | --- | --- | --- |
| #112 NIP-44 legacy behavior | AFK | local review passed | `feature/nip44-legacy-compat` | standards/spec pass after one fix | yes |
| #118 authoritative protocol messages | AFK | ready | `feature/protocol-message-types` | pending | no |
| #113 Relay event-store seam | AFK | blocked by #118 | `feature/relay-event-store` | pending | no |
| #114 NIP-47 protocol machinery | AFK | blocked by #118 | `feature/nip47-protocol-codecs` | pending | no |
| #115 Nostr relay registry | AFK | blocked by #113 | `feature/nostr-relay-registry` | pending | no |
| #116 ephemeral Relay ownership | AFK | blocked by #113 | `feature/ephemeral-relay-ownership` | pending | no |
| #117 security validation ownership | AFK | blocked by #113 and #115 | `feature/security-validation-ownership` | pending | no |
| #119 package-manager policy | AFK | ready | `feature/package-manager-policy` | pending | no |

## Parked HITL Slices

| Issue | Why parked | Blocks | Required human action | Final PR decision |
| --- | --- | --- | --- | --- |
| None | — | — | — | — |

## Issue Session Ledger

| Issue | Fixed point | Implementation owner | Commit | Review result | Checks |
| --- | --- | --- | --- | --- | --- |
| #112 | `df13432` | current Codex orchestrator; Grok unavailable at auth preflight | `ab22d13` + review fix pending | standards/spec pass after one fix | NIP-44 107/107; Jest 991/991; Bun 991/991; lint, types, builds, commands, pack |

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
