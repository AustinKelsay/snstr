# Review Packet: #134 NIP-47 Service Lifecycle

## Issue

- Issue: #134
- Slice type: AFK lifecycle cleanup
- Acceptance criteria: sequential initialization keeps at most one subscription; concurrent initialization is single-flight; disconnect is idempotent and releases lifecycle resources; restart restores one working expiration-aware subscription; tests use the public service API
- Baseline: `2a3556d`
- Current diff: `git diff staging...HEAD`

## Implementation Summary

`NostrWalletService` now owns an explicit single-flight lifecycle. Initialization coalesces concurrent callers, no-ops once ready, waits for active teardown, scopes subscriptions to one lifecycle generation, and cleans failed attempts. Disconnect invalidates stale initialization, coalesces concurrent callers, releases subscriptions, relay connections, and expiration tracking, and synchronously observes expected cancellation rejections without hiding them from callers that await the original initialization promise. Reinitialization restarts expiration cleanup and creates one fresh request subscription.

## Implementation Evidence

- `implement` session: `issue-134-session.md`
- `tdd` used: yes
- Red tests: sequential initialization left two active Relay subscriptions; concurrent initialization returned different promises and duplicated work; a queued restart originally survived a later disconnect
- Green implementation: public lifecycle suite covers sequential and concurrent initialization, repeated disconnect, queued and in-flight cancellation, restart, one active subscription, and an encrypted expired request after restart
- Refactor: lifecycle state and resource ownership remain private to `NostrWalletService`; no production test hook or public API addition was introduced
- Commands run: focused Jest/Bun lifecycle suites, NIP-47 Jest regression suite, strict TypeScript, ESLint, and diff checks; full repository gates pending final review

## Review Instructions

Review only issue #134 unless a severe cross-slice regression appears. Keep standards and spec axes separate. Verify promise identity and failure consistency, all init/disconnect interleavings, synchronous observation of expected cancellation, attempt-scoped subscription cleanup, stale callback suppression, TTL cleanup restart, idempotent resource release, unchanged public signatures, and public-behavior test coverage.

## Reviewer Output

```text
STANDARDS_STATUS: pass
STANDARDS_FINDINGS:
- initial queued-cancellation rejection observer fixed
- primary cancellation observer timing fixed in follow-up
- final targeted re-review found no remaining correctness or standards blockers

SPEC_STATUS: pass
SPEC_FINDINGS:
- all five acceptance criteria met
- no missing or incorrectly implemented criteria
```
