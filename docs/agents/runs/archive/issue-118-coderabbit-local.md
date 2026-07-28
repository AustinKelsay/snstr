# CodeRabbit Round: #118 Local Branch

## Round

- Scope: local
- Round number: 1
- Command: `coderabbit review --agent --type all --base staging`
- Completed: 2026-07-18
- Findings: 5

## Decisions

| Finding | Decision | Notes |
| --- | --- | --- |
| Session acceptance map still said full verification was pending | fixed | Status now matches the completed matrix. |
| Review packet and other run artifacts had inconsistent verification status | fixed | Session and ledger now report the same completed results. |
| Ledger still described #118 as pending / targeted-only | fixed | Both #118 ledger rows now contain the full verified matrix. |
| Main Relay uses `Filter[]` while the wire tuple uses `NostrFilter[]` | skipped | `Filter` is intentionally the public extensible subtype of `NostrFilter`; strict TypeScript proves it is assignable, while changing subscription storage would remove custom-filter support. |
| Ephemeral Relay asserted attacker-controlled REQ filters as trusted | fixed | REQ subscription ids are narrowed and filters now pass through the existing security validator before `_onreq`. |

## Result

- Worthy findings fixed: 4
- Findings skipped with evidence: 1
- Post-fix verification: lint and strict typecheck pass; focused protocol, Relay, ephemeral Relay, filter, and export-policy suites pass 85/85

## Hosted PR Round

- Scope: PR #121
- Trigger: `@coderabbit full review`
- Completed: 2026-07-18
- Findings: 2

| Finding | Decision | Notes |
| --- | --- | --- |
| Invalid REQ filters were reported as generic parse failures | fixed | `SecurityValidationError` now maps to the stable `invalid: REQ filters` NOTICE. |
| Public direction-specific aliases were missing from the type inventory | fixed | All four EVENT/AUTH direction aliases are documented. |

- Post-hosted-review verification: lint and strict typecheck pass; filter, protocol type, and export-policy suites pass 20/20, including a raw-WebSocket malformed REQ regression test.
- CI portability follow-up: the first raw socket test bypassed the repository's in-memory transport under Bun. It now sends through the connected Relay test seam; the filter suite passes 13/13 in both Jest and Bun.
