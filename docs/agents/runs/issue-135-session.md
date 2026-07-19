# Issue Session: #135 NIP-57 Client Consolidation

## Issue

- Issue: #135
- Fixed point before session: `25e055d`
- Worker session: current Codex orchestrator; Grok 4.5 High reviewers
- Commit: `0909227`; review fixes: `1b12872`
- Status: all local review and verification complete; ready for hosted review

## Inputs

- Spec issue: #130
- Ticket: #135
- Relevant glossary terms: Nostr Event, Relay, Subscription Filter, NIP-57
- Relevant ADRs: none
- Prototype answer and source branch, if any: none

## Implementation

- Public interface used: existing `NostrZapClient` and `ZapClient` facades
- Behaviors covered: persistent LNURL cache and collaborators, equivalent filters and statistics, explicit zero limits, and 0.x-compatible exports and methods
- `tdd` used: yes; public-facade tests cover persistent, isolated, URL-aware, and bounded cache state; equivalent receipt filters and statistics; explicit zero limits; valid anonymous signing; invoice response validation; and callback timeout cleanup
- Commands run during implementation: focused Jest and Bun public-facade suites, NIP-57 Jest regression suite, strict TypeScript, ESLint, and diff checks
- Full suite command: `npm test -- --runInBand --coverage=false`; `bun test ./tests --max-concurrency 1 --timeout 30000`; repository policy, lint, type, build, example, and pack gates

## Review

- Review fixed point: `25e055d`
- Design findings: Grok mapped the short-lived `ZapClient` allocations, duplicated filter and statistics logic, cache ownership, subscription semantics, and export asymmetry; a targeted follow-up confirmed that five additive `ZapClient` receipt/statistics delegates are required to satisfy the literal public-facade equivalence criterion
- Standards findings: initial pass found exported adapter JSDoc drift, facade-only filter comparisons without golden shapes, and a compatibility drift where targeted user queries inherited the general `events` filter; all were fixed and the targeted re-review passed with zero findings; Grok also passed the subsequent CodeRabbit-driven delta with zero findings
- Spec findings: passed every acceptance criterion with zero findings
- Worthy fixes applied: one instance-owned private core, persistent per-facade LNURL state, shared receipt filter and statistics implementations, explicit zero-limit preservation, public `ZapClient` receipt/statistics delegates, exported adapter JSDoc, golden filter assertions that protect targeted-query compatibility, valid ephemeral-key anonymous signatures, URL-aware bounded LNURL caching, a bounded invoice callback, and successful-response invoice validation
- Findings ignored with reasons: additional duplicate subscription-lifecycle tests through `ZapClient` were optional because both adapters delegate to the same private collector and the parity tests exercise the new facade routes; the private core remains in the existing client module to avoid a circular or overly fragmented NIP-57 implementation; final local CodeRabbit review completed with zero findings

## Verification

- Focused: Jest/Bun public-client suite 22/22; NIP-57 regression 4/4 suites and 40/40 tests
- Full Jest: 83/83 suites and 1081/1081 tests
- Full Bun: 83 files and 1081/1081 tests
- Repository gates: commands and package-manager policy, ESLint, strict TypeScript, CJS/ESM builds, examples, pack verification, and diff checks all green

## Risks

- Consolidation must preserve both public constructor shapes and return values while removing duplicated behavior ownership.
- A shared persistent implementation must not share cache state between distinct public client instances.
