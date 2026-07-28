## Issue

- Issue: #95 — Sync supported NIP documentation and targeted test commands
- Fixed point before session: `2f6a6f4`
- Worker session: current orchestrator through `implement`
- Commit: `3daf6ad`
- Status: implementation and review complete

## Inputs

- Spec issue: #93
- Ticket: #95
- Relevant glossary terms: NIP, Nostr Event, Relay
- Relevant ADRs: none
- Prototype answer and source branch, if any: none

## Implementation

- Public interface used: README supported-NIP/testing guidance and npm targeted-test scripts
- Behaviors covered: all shipped NIP test directories have targeted commands; NIP-29, NIP-42, NIP-56, NIP-70, and NIP-86 are documented
- `tdd` used: yes; `npm run test:nip29` failed because the script was absent, then all five added commands passed
- Commands run during implementation: `npm run test:nip29 -- --runInBand`, `npm run test:nip42 -- --runInBand`, `npm run test:nip56 -- --runInBand`, `npm run test:nip70 -- --runInBand`, `npm run test:nip86 -- --runInBand`, `npm run lint`, `npx tsc --noEmit -p tsconfig.json`
- Full suite command: `npm run test:coverage -- --runInBand` (final integrated result recorded in the feature ledger)

## Review

- Review fixed point: `2f6a6f4`
- Standards findings: no documented-standard violations; reviewer flagged the README's pre-existing duplicated script inventories as Duplicated Code/Shotgun Surgery heuristics
- Spec findings: initial NIP-70 description overstated relay behavior
- Worthy fixes applied: changed NIP-70 wording to describe protected-event tag helpers for authenticated-author publishing; spec re-review passed
- Findings ignored with reasons: generating or collapsing the README's existing duplicate script catalogs is a separate documentation-architecture refactor and exceeds #95's truthful-inventory scope

## Risks

- The NIP-86 targeted test passes but retains Jest's pre-existing delayed-exit warning.
