# CodeRabbit Local Review: Issue #139

## Scope

- Branch: `feature/ephemeral-relay-internals`
- Base: `staging` / fixed point `3c1e905`
- Full-diff command: `coderabbit review --agent --type all --base staging`
- Incremental command: `coderabbit review --agent --type uncommitted --base staging`

## Findings Addressed

| Severity | Finding | Resolution |
| --- | --- | --- |
| Minor | CLOSE coverage did not prove server-side subscription removal | Wait for `NostrRelay.subs` to empty, publish again, and assert no stale delivery |
| Major | NIP-46 routing re-derived the subscription ID from the map key | Route with the subscription owner's typed `subscriptionId` |
| Major | Rejected session shutdown could skip transport cleanup | Put timeout, listener, and owned-state cleanup under `finally` while preserving the original rejection |
| Major | Native server lost its only `error` listener after startup | Retain a runtime error handler for native and in-memory servers |
| Major | Timed-out test polling could continue scheduling callbacks | Make polling cancellation explicit and clear all timeout handles |

## Findings Not Addressed

| Severity | Finding | Reason |
| --- | --- | --- |
| Minor | Send an event only once when multiple filters in one subscription match | Pre-existing observable wire behavior; changing it is outside this compatibility-preserving structural ticket |
| Minor | Add a maximum connection count in transport acceptance | New product/security policy with no specified limit or existing shared policy; outside issue #139 |

## Result

- Final incremental review of the last polling fix: 0 findings.
- All production findings from the full-diff reviews were fixed except the two explicitly rejected scope changes above.
- Focused Jest/Bun regression checks and the complete project gate matrix passed after production fixes.
