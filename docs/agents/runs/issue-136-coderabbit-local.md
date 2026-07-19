# Local CodeRabbit Review: #136 NIP-46 Protocol Core

## Review

- Command: `coderabbit review --agent --type committed --base ed9fa4a -c AGENTS.md`
- Reviewed commits: `cf3819b` through `d983bae`
- Initial result: six issues (five major, one minor)
- Follow-up result: two test issues
- Final result: 0 issues across all 10 changed files

## Findings and Resolutions

1. Decrypted wire payloads relied on unchecked casts. Added distinct request and response shape validation while preserving well-shaped extension methods and supported large NIP-44/event parameters.
2. Duplicate request IDs could overwrite an existing pending entry. The correlator now rejects duplicate registration without replacing the original owner.
3. Advanced bunker envelope validation followed the rate-limit hook and was optional for simple bunkers. Validation is mandatory and runs before every profile hook, decrypt, or dispatch.
4. Concurrent bunker start/stop calls could race. A shared transition queue and explicit running state now coalesce starts and make stops idempotent.
5. Client publishes did not carry the request deadline. Client publishes use the facade timeout, and bunker response/metadata publishes explicitly retain the relay's 10-second bound.
6. Simple facade logger initialization assumed Node's global `process`. All touched facade initializers now guard browser access.
7. Focused timeout and `cancelAll` cleanup coverage was missing. Portable Jest/Bun tests assert settlement errors and empty pending state.
8. Wire tests used random keypairs. Fixed synthetic test-only private keys now make the round-trip setup reproducible without real credentials.

## Verification Before Final Review

- NIP-46 Jest: 10/10 suites, 178/178 tests
- Full Jest: 85/85 suites, 1091/1091 tests
- Full Bun: 85 files, 1091/1091 tests
- Commands/package-manager policy, ESLint, strict TypeScript, CJS/ESM builds, examples, and pack verification: green
- Grok design, standards/spec, finding-fix, and publish-bound follow-ups: pass
- Final CodeRabbit committed review: 0 issues across all 10 changed files
