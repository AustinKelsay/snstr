# Local CodeRabbit Review: #135 NIP-57 Client Consolidation

## Review

- Command: `coderabbit review --agent --type committed --base staging -c AGENTS.md`
- Reviewed commit: `0909227`
- Initial result: four findings (one critical, two major, one minor)
- Re-review: pending after the review-fix commit

## Findings and Resolutions

1. Anonymous zap requests used an all-zero event pubkey that could not match the signing private key. Fixed by deriving the request pubkey from the supplied ephemeral private key and verifying the resulting signature through the public client result.
2. LNURL capability cache entries were reused after a profile LNURL changed and grew without a bound. Fixed with URL-aware hits and instance-local least-recently-used eviction above 256 entries.
3. The LNURL invoice callback had no request bound and accepted successful payloads without a usable invoice. Fixed with abort-backed 10-second timeout cleanup and non-empty invoice validation.
4. The review packet still described full verification as pending. Fixed to match the completed session record.

## Verification Before Retry

- Focused public-client Jest/Bun: 22/22
- NIP-57 Jest: 4/4 suites, 40/40 tests
- Full Jest: 83/83 suites, 1081/1081 tests
- Full Bun: 83 files, 1081/1081 tests
- Commands/package-manager policy, ESLint, strict TypeScript, CJS/ESM builds, examples, and pack verification: green
- Grok standards/spec and targeted review-fix passes: clean with no remaining findings
- Final CodeRabbit committed review: pending
