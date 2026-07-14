# Feature Dev Run Ledger: Runtime Debt Cleanup 1–7

## Run

- Run ID: `snstr-cleanup-runtime-debt-20260714`
- Loop: feature-dev
- Target repo: `snstr`
- Base branch: `staging`
- Feature branch: `feature/cleanup-runtime-debt`
- Human owner: plebdev
- Started: 2026-07-14
- Current status: implementation; #101–#103 complete
- Skill setup status: present and verified (`AGENTS.md`, GitHub issue tracker, triage labels, single-context domain docs)

## Goal

Complete cleanup items 1–7 from the post-v0.4.0 repository audit end to end: stabilize and test the public NIP-57 client, fix the NIP-86 rejected-fetch timer leak, quiet and harden the ephemeral Relay, raise security-validator branch coverage, collapse script and README inventory duplication, remove or repair stale surfaces, and unify the public logging contracts.

## Durable Artifacts

- CONTEXT updates: none yet; existing Nostr Event, Relay, Subscription Filter, and NIP terms cover the feature
- ADRs: `docs/adr/0002-unify-diagnostics-compatibly.md`
- Prototype source branch, if any: none expected; current evidence is sufficient
- Spec issue: [#100 — Eliminate remaining runtime and maintenance debt](https://github.com/AustinKelsay/snstr/issues/100)
- Tickets: #101–#107 — published and ready for implementation
- Ticket sessions: created as each ticket enters implementation
- Agent briefs: full Codex worker sessions are the default per ticket; OpenCode GLM-5.2 max completed a read-only architecture pass; Grok is unavailable because the required live model is absent
- Review packets: #101–#103 standards/spec review and re-review complete; remaining tickets pending
- Local CodeRabbit report: pending
- PR URL: pending; final target is a non-draft PR into `staging`

## Commands

- Install: `npm ci`
- Typecheck: `npx tsc --noEmit -p tsconfig.json` and `npx tsc --noEmit -p examples/tsconfig.json`
- Test: targeted Jest files per ticket; `npm test -- --runInBand`; `npm run test:coverage -- --runInBand`; `bun run test:bun`
- Build: `npm run lint && npm run build && npm run build:examples && npm run pack:verify`
- Visual verification: not applicable

## Ticket Ledger

| Issue | Type | Status | Review thread | Fixes needed | Verified |
| --- | --- | --- | --- | --- | --- |
| #101 | AFK | closed | standards + spec passed after one fix | exact NIP-02 contextual type restored | yes |
| #102 | AFK | closed | standards + spec passed after worthy fixes | late-connect race and compatibility/parity coverage gaps resolved | yes |
| #103 | AFK | closed | standards + spec passed after worthy fixes | non-throwing diagnostics, exported JSDoc, per-ID cleanup, validation routing, `getZapInvoice` coverage | yes |
| #104 | AFK | blocked by #102 | pending | — | no |
| #105 | AFK | ready | pending | — | no |
| #106 | AFK | ready | pending | — | no |
| #107 | AFK | ready | pending | — | no |

## Parked HITL Slices

| Issue | Why parked | Blocks | Required human action | Final PR decision |
| --- | --- | --- | --- | --- |
| None | — | — | — | — |

## Issue Session Ledger

| Issue | Fixed point | Worker session | Commit | Review result | Checks |
| --- | --- | --- | --- | --- | --- |
| #101 | `f63d9eb` | `/root/issue_101_worker` | `fbfb2d6`, `3c1b6b4` | passed after review fix | lint, types, build, pack, 66 suites / 881 tests |
| #102 | `c3e76df` | `/root/issue_102_worker` | `2b163e0` | standards + spec passed after worthy fixes | focused lifecycle 12/12; related Relay 76/76; lint, types, build, pack, CJS/ESM subpath smoke |
| #103 | `599e41f` | `/root/issue_103_worker` | `46ab31a` | standards + spec passed after worthy fixes | focused NIP-57 30/30 with no open handles; lint, types, build, examples, pack |
| #104 | pending | pending | — | — | — |
| #105 | pending | pending | — | — | — |
| #106 | pending | pending | — | — | — |
| #107 | pending | pending | — | — | — |

## Open Questions

- None. The owner granted full end-to-end autonomy; the exact seven-ticket graph was presented before publication and is recorded on #100.

## Alignment Evidence

- Repository policy says to preserve backward compatibility when possible, and existing deprecated aliases remain until the next major version.
- Human decision: expand and migrate the logger contracts compatibly now; defer final removal to the next major release.
- Human decision: use the proposed highest public testing seams and avoid private-method tests or a repository-wide coverage threshold.
- OpenCode independently confirmed that logger expansion and migration are nonbreaking: the core logger structurally satisfies both the warn-only NIP-02 contract and the five-level NIP-47 contract.
- Final removal of the warn-only NIP-02 contract is inherently breaking and belongs to a later major release if compatibility-first is selected.
- Proposed highest testing seams are the public `NostrRelay` lifecycle, public NIP-57 clients, public `RelayManagementClient` with the existing fetch adapter, public event/Relay behavior plus direct pure security validators where no public path exists, runnable package commands, and root/web logger exports with injected diagnostics.
- Scope-preserving defaults: retain existing timeout values; add no new disposal API; add no repository-wide coverage threshold; do not expand stale-surface removal beyond the dead NIP-04 shim and broken plain-JavaScript NIP-44 demo.
- Proposed ticket dependency shape after logger alignment: logger expand/migrate first; ephemeral Relay hardening depends on it; NIP-57 and public-path security tests depend on the hardened Relay; NIP-86, docs/scripts, and stale-surface tickets are independent.

## Proposed Ticket Graph

1. **Expand and migrate the canonical diagnostic logger** (item 7) — no blockers. Additive root/web exports, compatible NIP-specific aliases or narrow views, injected diagnostics, deprecations without removals, and runtime/type compatibility tests.
2. **Quiet and harden the ephemeral Relay lifecycle** (item 3) — blocked by ticket 1. Remove import-time output, use canonical diagnostics, make timer/start/close/restart behavior deterministic, and verify the public `NostrRelay` lifecycle.
3. **Stabilize and test the public NIP-57 clients** (item 1) — blocked by tickets 1 and 2. Consolidate subscription collection, clear timeout and all subscription resources on every settlement path, use canonical diagnostics, and cover both public clients through observable behavior.
4. **Exercise security limits through public behavior** (item 4) — blocked by ticket 2. Add public event/Relay tests plus direct pure-validator tests only where no public path exists, and materially raise security-validator branch coverage without a repository-wide threshold.
5. **Clear the NIP-86 request timeout on every exit** (item 2) — no blockers. Preserve the existing timeout contract and prove rejected, aborted, parsed, and successful requests leave no timer handle.
6. **Collapse command and README inventory duplication** (item 5) — no blockers. Remove redundant aliases, prevent duplicate grouped execution, keep one canonical README inventory, and verify every documented runnable command exists.
7. **Remove or repair stale package surfaces** (item 6) — no blockers. Delete the unreachable NIP-04 shim, remove the broken redundant JavaScript NIP-44 demo and its references, and prove build/package contents remain correct.

All seven tickets are AFK. Validation is agent-performable; no production access, UI judgment, or human-only operation is required.

## Escalations

- The Grok orchestrator preflight found the required `grok-4.5-xhigh` and `grok-4.5-fast-xhigh` models absent from the live `agent` catalog. Per the skill contract, no substitute model will be used; bounded OpenCode passes and local review will carry the work unless Grok becomes available later.
