# Issue 104 Session

## Issue

- Issue: #104 — Exercise security limits through public event and Relay behavior
- Fixed point before session: `6d563ec`
- Worker session: `/root/issue_104_worker`
- Commit: pending
- Status: implementation in progress

## Inputs

- Spec issue: #100 — https://github.com/AustinKelsay/snstr/issues/100
- Ticket: #104 — https://github.com/AustinKelsay/snstr/issues/104
- Relevant glossary terms: Nostr Event, Relay, Subscription Filter
- Relevant ADRs: `docs/adr/0001-centralize-nostr-event-validation.md`
- Prototype answer and source branch, if any: none

## Implementation

- Public interfaces under test: event constructors and signed-event validation, `LocalKeySigner`, and `Nostr` subscription/rate-limit behavior
- Pre-agreed seams: assert public behavior wherever validation is reachable; call pure utilities directly only for branches with no meaningful public path and label that reason in the test structure
- Required invariants: accepted boundary values remain accepted; malformed filters, tags, ranges, keys, signatures, identifiers, and over-limit operations are rejected deterministically
- `tdd` used: yes; the focused fixed-point public suites passed their 99 behavior assertions but failed an ephemeral 50% per-file branch gate at 26.66%, then the expanded public-first suite passed the same gate at 79.04%
- Full fixed-point coverage baseline: `security-validator.ts` 57.89% statements, 37.14% branches, 78.12% functions, 57.97% lines
- Baseline command: `npm run test:coverage -- --runInBand --coverageReporters=json-summary --coverageReporters=text`
- Baseline suite result: 67/68 suites and 910/911 tests passed; one pre-existing lifecycle assertion failed in `tests/utils/ephemeral-relay-lifecycle.test.ts` (`close disconnects an active Relay before it resolves`)
- Public-first coverage: Event constructors cover content, tag, addressable-kind, d-tag, key, identifier, and signature boundaries; `Nostr.subscribe` covers malformed filter collections and every bounded filter field; a public rate-limit test covers allow, block, blocked retry, and exact-window reset
- Direct pure-helper coverage: four tests cover only negative helper indexes, guarded non-array fallback, caller-selected secure identifier length, and bounded-map eviction; public consumers cannot supply those exact helper branches after their own guards, while reachable valid, malformed, short, and 10,001-element array behavior is asserted through public Event and NIP-10 flows
- Focused baseline: 47.84% statements, 26.66% branches, 65.62% functions, 47.82% lines across 99 existing public Event, Nostr, and Signer tests
- Focused post-change coverage: 83.73% statements, 79.04% branches, 78.12% functions, 83.57% lines across 156 tests; the temporary 50% per-file branch gate passed
- Full post-change coverage: `security-validator.ts` 86.12% statements, 80.00% branches, 84.37% functions, 85.99% lines
- Commands run during implementation:
  - Focused public baseline with `--collectCoverageFrom=src/utils/security-validator.ts` and an ephemeral 50% per-file branch gate (red: 26.66% branches)
  - `npx jest tests/security/security-limits-public.test.ts tests/utils/security-validator.test.ts --runInBand` (initial red: expected legacy identifier wording differed; green: 56/56)
  - Focused public and supporting suites with the same ephemeral branch gate (155/155; 79.04% branches)
  - `npx jest tests/security/security-limits-public.test.ts tests/utils/security-validator.test.ts --runInBand --detectOpenHandles` (56/56; no open handles)
  - After the spec-review seam fix, focused public and supporting coverage remained 79.04% branches across 156/156 tests; the ticket suites passed 57/57 with no open handles
  - `npm run lint` (passed)
  - `npx tsc --noEmit -p tsconfig.json` (passed)
  - `npm run build` (passed)
  - `npm run test:coverage -- --runInBand --coverageReporters=json-summary --coverageReporters=text` (69/70 suites, 966/967 tests; exact pre-existing lifecycle failure; after metrics recorded above)
  - `npm test -- --runInBand` (69/70 suites, 966/967 tests; same pre-existing lifecycle failure)
  - `npx jest tests/utils/ephemeral-relay-lifecycle.test.ts --runInBand --detectOpenHandles -t "close disconnects an active Relay before it resolves"` (isolated lifecycle assertion passed 1/1 in 64 ms)
- Full suite disposition: the same lifecycle assertion fails at fixed point and after this tests-only ticket only under the loaded all-suite run, while passing in isolation; parent coordination approved keeping #104 scoped and carrying that #102 test-load issue into integrated disposition

## Review

- Review fixed point: `6d563ec`
- Standards findings: pending
- Spec findings: pending
- Worthy fixes applied: moved reachable array-helper behavior, including the 10,001-element guard, from direct tests to public `validateEvent` direct-message and NIP-10 parser behavior; narrowed the direct helper explanation to exact negative-index and guarded non-array branches public consumers structurally cannot supply
- Findings ignored with reasons: pending

## Risks

- Keep production behavior and public APIs unchanged unless a public regression test proves a defect.
- Do not introduce a repository-wide coverage threshold.
- Avoid private-method tests; a direct pure-helper test must explain why no public route exists.
- The fixed-point full coverage run exposed one unrelated lifecycle failure; reproduce it separately before treating it as a ticket regression.
