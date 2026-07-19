# Local CodeRabbit Review: #136 NIP-46 Protocol Core

## Review

- Commands: committed review from `ed9fa4a`; follow-up uncommitted reviews after hosted fixes
- Reviewed commits: `cf3819b` through `1c38f2c`
- Initial result: six issues (five major, one minor)
- Follow-up result: two test issues
- Final result: 0 issues across all 9 follow-up files after two iterative passes
- Hosted result: the initial two findings and the later lifecycle, rate-limiter, typed-error, tracking, and correlator-coverage findings are fixed; the raw-log claim was rejected because the canonical diagnostic boundary redacts those fields

## Findings and Resolutions

1. Decrypted wire payloads relied on unchecked casts. Added distinct request and response shape validation while preserving well-shaped extension methods and supported large NIP-44/event parameters.
2. Duplicate request IDs could overwrite an existing pending entry. The correlator now rejects duplicate registration without replacing the original owner.
3. Advanced bunker envelope validation followed the rate-limit hook and was optional for simple bunkers. Validation is mandatory and runs before every profile hook, decrypt, or dispatch.
4. Concurrent bunker start/stop calls could race. A shared transition queue and explicit running state now coalesce starts and make stops idempotent.
5. Client publishes did not carry the request deadline. Client publishes use the facade timeout, and bunker response/metadata publishes explicitly retain the relay's 10-second bound.
6. Simple facade logger initialization assumed Node's global `process`. All touched facade initializers now guard browser access.
7. Focused timeout and `cancelAll` cleanup coverage was missing. Portable Jest/Bun tests assert settlement errors and empty pending state.
8. Wire tests used random keypairs. Fixed synthetic test-only private keys now make the round-trip setup reproducible without real credentials.
9. PR tracking still said pending and omitted two commits. The ledger and session now record PR #145, its hosted state, and the complete implementation commit set.
10. A connect error returned by the bunker was raised after `engine.connect` completed, so the advanced facade did not invoke engine cleanup. The facade now awaits `engine.disconnect` in every catch path, with a public rejected-connect then successful-retry regression test.
11. Advanced bunker stop/start destroyed the rate-limiter cleanup interval permanently. The limiter now has an idempotent start operation invoked by bunker start, with restart coverage.
12. Client connect/disconnect transitions could interleave. The client engine now serializes session transitions, including success and failed-connect cleanup paths, while ordinary requests remain concurrent and disconnect cancels pending correlation.
13. Simple-client engine-level rejection made typed signing/encryption/decryption branches unreachable. Error envelopes now reach facade inspection, including explicit public-key and relay error handling.
14. Normal correlator settlement lacked direct coverage. The focused core suite now proves successful resolution and pending-entry removal.
15. A local suggestion to serialize all client requests was rejected after Grok review because it would deadlock nested CONNECT/DISCONNECT operations, collapse concurrent RPC throughput, and replace prompt disconnect cancellation with timeout waits.

## Verification Before Final Review

- NIP-46 Jest: 10/10 suites, 185/185 tests
- Full Jest: 85/85 suites, 1096/1096 tests
- Full Bun: 85 files, 1096/1096 tests
- Commands/package-manager policy, ESLint, strict TypeScript, CJS/ESM builds, examples, and pack verification: green
- Grok design, standards/spec, finding-fix, and publish-bound follow-ups: pass
- Final CodeRabbit follow-up review: 0 issues across all 9 changed files
