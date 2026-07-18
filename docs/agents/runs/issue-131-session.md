# Issue Session: #131 NIP-46 Diagnostic Redaction

## Issue

- Issue: #131
- Fixed point before session: `f4bda34`
- Worker session: current Codex orchestrator; Grok authentication pending
- Commit: pending
- Status: TDD red phase

## Inputs

- Spec issue: #130
- Ticket: #131
- Relevant glossary terms: Nostr Event, Relay, NIP
- Relevant ADRs: ADR 0002 — unify diagnostics compatibly
- Prototype answer and source branch, if any: none

## Implementation

- Public interface used: diagnostic logger options on all four NIP-46 client and bunker constructors
- Behaviors covered: connection secrets, request parameters, decrypted protocol payloads, and event plaintext never reach injected diagnostics; safe method and correlation metadata remains
- `tdd` used: yes; cross-facade public integration tests written before the logger adapter
- Commands run during implementation: pending
- Full suite command: `npm test -- --runInBand --detectOpenHandles`

## Review

- Review fixed point: `f4bda34`
- Standards findings: pending
- Spec findings: pending
- Worthy fixes applied: pending
- Findings ignored with reasons: pending

## Risks

- Recursive diagnostic sanitization must handle cycles and error objects without changing application behavior.
