# CodeRabbit Round: #112 Local Branch

## Round

- Scope: local
- Round number: 1
- Command or trigger: `coderabbit review --agent --type all --base staging`
- Started: 2026-07-18
- Completed: 2026-07-18
- Availability: completed
- Fallback review thread: none

## Findings To Address

| Finding | Severity | Decision | Notes |
| --- | --- | --- | --- |
| v2 nonce/AAD helpers accepted values longer than 32 bytes | minor | fixed | Both helpers now require exact 32-byte values; 31/33-byte regression tests added. |
| Example README claimed rejection behavior the demo did not execute | minor | fixed | Demo now mutates a valid payload to versions 0, 1, and 3 and calls public decryption. |
| Compatibility demo did not exercise non-v2 decryption | minor | fixed | Public `decryptNIP44` rejection is demonstrated for reserved, undefined, and unknown versions. |
| Compliance output omitted unknown versions | minor | fixed | Summary now includes unknown versions. |
| Basic demo wording omitted unknown versions | major | fixed as wording issue | Existing text already rejected v0/v1; wording now explicitly includes unknown versions. |

## Findings Not Addressed

| Finding | Reason |
| --- | --- |
| None | — |

## Result

- Continue: yes
- Escalate: no
- Notes: Focused NIP-44 tests 25/25, lint, root typecheck, examples build, and the real version-compatibility example passed after fixes. The pre-review integrated matrix was Jest 991/991 and Bun 991/991.
