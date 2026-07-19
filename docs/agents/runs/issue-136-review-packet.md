# Review Packet: #136 NIP-46 Protocol Core

## Issue

- Issue: #136
- Slice type: AFK structural cleanup
- Acceptance criteria: canonical request correlation, encryption/decryption, timeout, dispatch, and lifecycle ownership; four compatible public facades; redacted diagnostics; cross-facade success/failure/timeout/reconnect/shutdown tests; duplicate machinery removed
- Baseline: `ed9fa4a`
- Current diff: committed branch against `ed9fa4a`

## Implementation Summary

The four public NIP-46 facades now delegate transport behavior to four internal owners: `NIP46Wire`, `NIP46RequestCorrelator`, `NIP46ClientEngine`, and `NIP46BunkerEngine`. The engines retain facade-specific policies for connect parameters and return values, request error handling, relay composition, delays, response filtering, publish result handling, and disconnect errors. Advanced bunker security, rate limiting, replay defense, auth challenges, and permission handlers remain adapter-owned hooks; top-level method dispatch and response transport are canonical. The diff removes 1,757 lines while adding 1,489 lines including 330 lines of public seam and focused protocol-core coverage.

## Implementation Evidence

- `implement` session: `issue-136-session.md`
- `tdd` used: characterization-first for behavior-preserving refactoring
- Baseline characterization: the public seam suite passed before consolidation, fixing expected observable outcomes
- Green implementation: 10 NIP-46 suites / 185 tests, including both facade pairings, typed protocol failures, both timeout contracts, simple and advanced reconnect, client shutdown, bunker shutdown, concurrent bunker lifecycle, serialized client success/failure transitions, restart-safe rate limiting, correlation settle/timeout/cancel cleanup, malformed envelopes, and extension methods
- Commands run: focused Jest/Bun, full NIP-46, full Jest/Bun, command/package-manager policy, strict TypeScript, ESLint, CJS/ESM builds, examples, pack verification, and diff checks

## Review Instructions

Review only issue #136 unless a severe cross-slice regression appears. Keep standards and spec axes separate. Verify that the four public constructors and method contracts are unchanged; simple and advanced connect/ping/error/delay differences are explicit; NIP-44 wire event creation and parsing exist only in `NIP46Wire`; request registration, timeout, settlement, rejection, and cancellation exist only in `NIP46RequestCorrelator`; relay subscription and client/bunker lifecycle exist only in the engines; top-level bunker dispatch has one handler map; advanced security hooks retain ordering and redaction; no fallback protocol implementation remains in a facade.

## Reviewer Output

```text
STANDARDS_STATUS: pass
STANDARDS_FINDINGS:
- initial correlator bypass, dead auth path, disconnect-error collapse, and seam-coverage gaps fixed
- explicit client and bunker publish bounds added
- final targeted Grok follow-ups passed with no remaining P0-P2 findings

SPEC_STATUS: pass
SPEC_FINDINGS:
- all acceptance criteria met; zero remaining findings

CODERABBIT_STATUS: local and hosted pass; PR #145 merged into `staging`
CODERABBIT_FINDINGS:
- initial six issues fixed: envelope schemas, duplicate IDs, validation order, lifecycle serialization, publish deadline, browser-safe process access
- two follow-up test issues addressed with timeout/cancel coverage and deterministic synthetic keypairs
- final committed-diff review raised 0 issues across all 10 changed files
- hosted full review found stale PR tracking and a leaked advanced-client transport after a rejected connect response; tracking is synchronized and the catch path now awaits canonical engine cleanup before preserving the public error
- follow-up hosted review found client lifecycle, bunker rate-limiter restart, simple typed-error, tracking, and correlator-coverage gaps; all were fixed and local CodeRabbit returned 0 findings
- the raw engine-log finding was rejected because the canonical diagnostic logger redacts `params` and `result`, with dedicated secret-leak regression coverage
```
