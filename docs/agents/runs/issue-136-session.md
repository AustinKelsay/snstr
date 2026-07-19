# Issue Session: #136 NIP-46 Protocol Core

## Issue

- Issue: #136
- Fixed point before session: `ed9fa4a`
- Worker session: current Codex orchestrator; Grok 4.5 High reviewers
- Commits: `cf3819b`, `baa2bf2`, `03a6652`, `7b5a7d0`, `2d4fc6f`, `d983bae`, `bc342cd`, `9e029be`, `1c38f2c`
- Status: PR #145 merged into `staging` as `8b970e4`; follow-up hosted and local findings fixed; all local and hosted gates green

## Inputs

- Spec issue: #130
- Ticket: #136
- Relevant glossary terms: Nostr Event, Relay, Subscription Filter, NIP-46
- Relevant ADRs: ADR 0002 for compatible diagnostic consolidation
- Prototype answer and source branch, if any: none

## Implementation

- Public interface used: supported simple and advanced NIP-46 client and bunker facades
- Behaviors covered: request correlation, encryption/decryption, timeout, dispatch, lifecycle, redacted diagnostics, and reconnect/shutdown behavior
- `tdd` used: yes, as characterization-first refactoring; the new public seam suite was green against the duplicated baseline, then protected success, protocol failure, timeout, reconnect, client shutdown, bunker shutdown, and concurrent bunker lifecycle behavior throughout consolidation
- Commands run during implementation: focused Jest/Bun protocol-core, facade-seam, diagnostic-redaction, validation, and performance suites; NIP-46 regression suite; strict TypeScript; targeted and full ESLint; diff checks
- Full suite command: `npm test -- --runInBand --coverage=false`; `bun test ./tests --max-concurrency 1 --timeout 30000`; repository policy, build, example, and pack gates

## Review

- Review fixed point: `ed9fa4a`
- Design findings: Grok mapped the two client and two bunker facades, their return-value and timeout differences, relay/subscription policies, private compatibility seams, advanced-only security behavior, simple-only permissions, and the requirement for one client engine plus one bunker engine behind thin adapters
- Standards findings: the initial Grok review found a correlator ownership bypass, dead advanced-client auth machinery, collapsed simple/advanced disconnect errors, and incomplete reconnect/shutdown coverage; all were fixed and the follow-up passed. Later passes required an explicit bunker publish bound, validated rejected-connect cleanup, confirmed client lifecycle serialization and restart-safe rate limiting, and preserved concurrent request cancellation rather than incorrectly serializing all RPCs
- Spec findings: final Grok review passed every acceptance criterion with no remaining findings
- Worthy fixes applied: distinct request/response envelope validation, extension-method compatibility, duplicate correlation-ID rejection, facade-specific disconnect errors, mandatory pre-dispatch envelope validation, serialized idempotent bunker transitions, serialized client connect/disconnect transitions, restart-safe rate-limiter cleanup, typed simple-client protocol errors, bounded client/bunker publishes, browser-safe logger initialization, portable correlator cleanup tests, deterministic synthetic wire keys, and advanced-client cleanup after rejected connect responses
- Findings ignored with reasons: raw `params`/`result` logging remains safe because `NIP46DiagnosticLogger` redacts those field names and leak tests cover the boundary. Serializing every request behind the lifecycle queue was rejected because concurrent RPCs are intentional and disconnect must promptly cancel pending correlation rather than wait for timeouts

## Verification

- Focused: NIP-46 10/10 suites and 185/185 tests; focused protocol-core, public seam, performance-security, and diagnostic suites green
- Full Jest: 85/85 suites and 1096/1096 tests
- Full Bun: 85 files and 1096/1096 tests
- Repository gates: command and package-manager policy, ESLint, strict TypeScript, CJS/ESM builds, examples, pack verification, and diff checks all green

## Risks

- Simple and advanced compatibility differences are explicit engine policies rather than parallel transport implementations.
- Existing private-shape compatibility getters remain only where the current suite depends on them; issue #138 owns moving those tests to public behavior and can then remove the getters.
