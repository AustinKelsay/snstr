# Goal Ledger: Tier A+B API Surface Cleanup

## Run

- Run ID: `snstr-cleanup-tier-ab-20260728`
- Loop: feature-dev
- Target repo: `snstr`
- Base branch: `staging`
- Feature branch: `feature/cleanup-tier-ab-api-surface`
- Human owner: plebdev
- Started: 2026-07-28
- Current status: implementation + review fixes complete; preparing commits, CodeRabbit, staging PR
- Skill setup status: present and verified

## Goal

Complete Tier A and Tier B cleanup end to end: close stale shipped issues, publish a 1.0 deprecation kill-list, archive agent run dumps, add NIP-42 docs, collapse/deprecate dual public facades (NIP-57 Zap clients, NIP-46 Simple vs Full), align overlapping NIP-46 validators with canonical security paths, and replace root `export *` type dumps with an explicit allowlist — then open a non-draft PR into `staging`.

## Durable Artifacts

- CONTEXT updates: Public Facade, Compatibility Alias
- ADRs: `docs/adr/0003-plan-public-facade-removals.md`
- Prototype source branch, if any: none
- Spec issue: [#154](https://github.com/AustinKelsay/snstr/issues/154)
- Tickets: #155–#162
- Ticket sessions: orchestrator-driven under full-autonomy grant (no separate parked HITL)
- Agent briefs: Grok/Opus bounded review sidecars for standards/spec; implementation on orchestrator + Opus sidecar
- Review packets: inline standards/spec review in this run; worthy findings fixed
- Local CodeRabbit report: pending
- PR URL: pending

## Commands

- Install: `corepack prepare npm@9.8.1 --activate`; `npm ci`
- Typecheck: `npx tsc --noEmit -p tsconfig.json`; `npx tsc --noEmit -p examples/tsconfig.json`
- Test: `npm test -- --runInBand` (1076 passed)
- Build: `npm run lint && npm run build && npm run build:examples && npm run pack:verify`
- Visual verification: not applicable

## Ticket Ledger

| Issue | Type | Status | Review thread | Fixes needed | Verified |
| --- | --- | --- | --- | --- | --- |
| #155 Close stale issues | AFK | closed | n/a (gh-only) | none | yes |
| #156 Kill-list ADR | AFK | implemented | standards/spec | none after ADR+changelog | yes |
| #157 Archive runs | AFK | implemented | standards/spec | README index | yes |
| #158 NIP-42 README | AFK | implemented | standards/spec | fixed wrong export names + structure | yes |
| #159 ZapClient deprecate | AFK | implemented | standards/spec | none | yes |
| #160 SimpleNIP46 deprecate | AFK | implemented | standards/spec | examples note + docblock wording | yes |
| #161 NIP-46 validators | AFK | implemented | standards/spec | changelog Security for curve-order | yes |
| #162 Type allowlists | AFK | implemented | standards/spec | NIP-11 duplicate export resolved | yes |

## Parked HITL Slices

| Issue | Why parked | Blocks | Required human action | Final PR decision |
| --- | --- | --- | --- | --- |
| None | — | — | — | — |

## Issue Session Ledger

| Issue | Fixed point | Worker session | Commit | Review result | Checks |
| --- | --- | --- | --- | --- | --- |
| #155 | staging | orchestrator | (gh-only) | n/a | issues closed |
| #156–#162 | staging | orchestrator + Opus implement | pending | standards/spec findings fixed | tsc, lint, 1076 routine |

## Open Questions

- None. Owner granted full end-to-end autonomy.

## Alignment Decisions (locked)

1. Close `#82`, `#88–91`, `#93–98` as shipped.
2. Keep Compatibility Aliases through 0.x; document 1.0 removals in ADR 0003.
3. `NostrZapClient` canonical; deprecate `ZapClient`.
4. `NostrRemoteSigner*` production; deprecate `SimpleNIP46*` for 1.0.
5. NIP-46 boolean validators → `isValidNip46*`; private-key uses canonical key-validation.
6. Explicit root/web type allowlists including Compatibility Aliases.
7. Archive session dumps; keep ledgers.
8. Out of scope: Tier C splits, alias removals, release to main.

## Escalations

- None.
