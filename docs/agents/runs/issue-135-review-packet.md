# Review Packet: #135 NIP-57 Client Consolidation

## Issue

- Issue: #135
- Slice type: AFK structural cleanup
- Acceptance criteria: repeated operations reuse persistent LNURL cache and collaborators; both public facades produce equivalent receipt filters and statistics for equivalent inputs; explicit `limit: 0` is preserved; existing public exports and 0.x behavior remain compatible; tests exercise both public facades without private helpers
- Baseline: `25e055d`
- Current diff: working tree against `25e055d`

## Implementation Summary

`NostrZapClient` and `ZapClient` now delegate to one instance-owned, non-exported `ZapClientCore`. The core owns the Nostr collaborator, relays, logger, LNURL cache, invoice generation, subscription collection, receipt-filter construction, validation, statistics, and split helpers. Both public constructor shapes and existing method contracts remain intact; `ZapClient` gains additive receipt-query and statistics methods so the two public facades can expose the same behavior without private test seams. Receipt filters now share one builder and preserve explicit zero limits.

## Implementation Evidence

- `implement` session: `issue-135-session.md`
- `tdd` used: yes
- Red tests: `ZapClient` lacked the five receipt-query/statistics methods required to compare both public facades; focused compilation failed on those missing public methods
- Green implementation: both facades reuse per-instance LNURL state, emit equivalent user/event/general receipt filters, preserve `limit: 0`, and calculate equivalent user/event statistics
- Refactor: all behavior ownership remains private; no private shape or production test hook is used
- Commands run: focused Jest/Bun public-client suites, NIP-57 Jest regression suite, strict TypeScript, ESLint, and diff checks; full-suite and packaging gates follow independent review

## Review Instructions

Review only issue #135 unless a severe cross-slice regression appears. Keep standards and spec axes separate. Verify instance-local cache ownership, absence of short-lived internal client allocations, constructor and method compatibility, subscription/EOSE/timeout behavior, filter parity including zero-valued options, statistics parity, additive API safety, export compatibility, logger propagation, and tests through public facades only.

## Reviewer Output

```text
STANDARDS_STATUS: pass
STANDARDS_FINDINGS:
- initial exported-JSDoc and targeted-filter compatibility findings fixed
- golden filter shapes added; final targeted re-review found no remaining findings

SPEC_STATUS: pass
SPEC_FINDINGS:
- all acceptance criteria met; zero findings

CODERABBIT_STATUS: pending
CODERABBIT_FINDINGS:
- pending
```
