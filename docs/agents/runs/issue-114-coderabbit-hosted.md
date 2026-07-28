# CodeRabbit Round: #114 Hosted PR

## Round

- Scope: PR #123
- Command: `@coderabbit full review`
- Completed: 2026-07-18
- Inline findings: 7

## Decisions

| Finding | Decision | Notes |
| --- | --- | --- |
| Parser accepted relay-less NWC URLs | fixed | Parse and generate now share the required-relay invariant. |
| Malformed request envelopes became INTERNAL_ERROR | fixed | Typed parse errors now map to INVALID_REQUEST with UNKNOWN correlation. |
| Invalid secondary lookup identifier reached the wallet | fixed | Both optional identifiers are validated when present. |
| Normalize all unknown methods to UNKNOWN | skipped | Existing public behavior correlates unsupported-method errors to the supplied method. |
| Require make-invoice description | skipped | Existing runtime intentionally accepts omission despite the stricter TypeScript wallet interface. |
| Add broad sanitization and redact wallet exceptions | deferred | Material behavior/security policy change belongs to #117. |
| Exhaustively cover every branch | partially addressed | Added regression tests for every hosted fix; existing public suite covers all methods and encryption/lifecycle behavior. |

## Result

- Hosted fixes: 3
- Evidence-based skips/deferments: 4
- Post-fix focused verification: lint, strict typecheck, and NIP-47 71/71 pass
