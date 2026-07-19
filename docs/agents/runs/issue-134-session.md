# Issue Session: #134 NIP-47 Service Lifecycle

## Issue

- Issue: #134
- Fixed point before session: `2a3556d`
- Worker session: current Codex orchestrator; Grok 4.5 High reviewers
- Commit: `569b266`; verification artifacts: `644b52f`
- Status: merged through PR #143 into `staging` at `25e055d`; issue closed

## Inputs

- Spec issue: #130
- Ticket: #134
- Relevant glossary terms: Relay, Subscription Filter, NIP-47
- Relevant ADRs: none
- Prototype answer and source branch, if any: none

## Implementation

- Public interface used: existing `NostrWalletService.init()` and `disconnect()` methods
- Behaviors covered: sequential and concurrent initialization, idempotent disconnect, restart with one fresh request subscription, and expiration-aware request handling after restart
- `tdd` used: yes; the focused suite observes service behavior through the public service API and the exported ephemeral Relay test surface
- Commands run during implementation: focused Jest/Bun lifecycle suites, NIP-47 Jest regression suite, strict TypeScript, ESLint, and diff checks
- Full suite command: `npm test -- --runInBand`; `npm run test:bun`; repository policy, lint, type, build, example, and pack gates

## Review

- Review fixed point: `2a3556d`
- Design findings: Grok confirmed duplicate sequential/concurrent subscriptions, a permanently stopped TTL cleanup interval after disconnect, and stale initialization races; it recommended client-parity single-flight and generation state while preserving the public API
- Standards findings: initial review found that a second disconnect cancelled a queued initialization without attaching a rejection observer for fire-and-forget callers; re-review found the same observer was attached too late on the primary disconnect path; both paths now synchronously absorb expected cancellation while preserving rejection for callers that await the original promise
- Spec findings: passed all five acceptance criteria; noted only partial public observability of the TTL cleanup interval and session-document drift
- Worthy fixes applied: client-parity single-flight initialization, generation cancellation, teardown serialization, attempt-scoped subscription cleanup, restartable TTL cleanup, stale callback generation guard, and cancellation rejection absorption
- Findings ignored with reasons: direct TTL interval assertions require private-shape access and conflict with the public-API test criterion; restart behavior is instead proved by an encrypted expired request after reconnect; hosted CodeRabbit completed with no findings

## Verification

- Focused: Jest/Bun lifecycle suite 6/6 after review-driven additions; NIP-47 Jest regression 9/9 suites and 76/76 tests
- Full Jest: 83/83 suites and 1073/1073 tests
- Full Bun: 83 files and 1073/1073 tests
- Repository gates: commands and package-manager policy, ESLint, strict TypeScript, CJS/ESM builds, examples, pack verification, and all four hosted CI lanes green

## Risks

- Disconnect must invalidate stale initialization without allowing it to publish or retain a zombie subscription.
- Reinitialization must restart or recreate lifecycle-owned expiration tracking rather than leave a destroyed TTL map inactive.
