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
