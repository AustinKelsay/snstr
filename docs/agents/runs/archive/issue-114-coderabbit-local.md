# CodeRabbit Round: #114 Local Branch

## Round

- Scope: local
- Command: `coderabbit review --agent --type all --base staging`
- Completed: 2026-07-18
- Findings: 9

## Decisions

| Finding group | Decision | Notes |
| --- | --- | --- |
| Malformed response JSON bypassed the supplied client error factory | fixed | Syntax errors now become the caller's protocol error type. |
| Request params accepted arrays | fixed | The canonical request parser now requires a non-array object. |
| Require relays and canonical 32-byte URL keys | skipped | Changes existing `parseNWCURL` acceptance and public behavior; belongs in #117 if approved. |
| Sanitize arbitrary wallet errors | skipped | Existing service intentionally preserves wallet error codes, messages, and data. |
| Override wallet-reported GET_INFO methods | skipped | Existing service preserves wallet info and adds only encryption capabilities. |
| Tighten amount, description, and all parameter bounds | skipped | Changes established accepted inputs; security policy is tracked by #117. |
| Map unknown wire methods to `UNKNOWN` | skipped | Existing behavior returns INVALID_REQUEST correlated to the supplied method. |

## Result

- Worthy findings fixed: 2
- Evidence-based compatibility/scope skips: 7
- Post-review verification: focused 70/70; full Jest/Bun 1021/1021; all types, builds, commands, and pack checks pass
