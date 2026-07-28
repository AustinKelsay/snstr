# Issue Session: #116 Ephemeral Relay Ownership

## Scope

- Fixed point: `9e3aca8` (`staging` after PR #124)
- Branch: `feature/ephemeral-relay-ownership`
- Issue: #116
- Owner: current Codex orchestrator; Grok unavailable because `agent` authentication is required

## Acceptance Map

| Acceptance criterion                                 | Implementation / verification seam                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Stability and intended consumers documented          | README defines `NostrRelay` as a supported Node-only testing utility, not production relay infrastructure                            |
| Test-only globals and helpers do not ship            | private source helpers removed; tarball verifier rejects their former CJS/ESM paths                                                  |
| Retained public testing surface works in CJS and ESM | canonical `snstr/testing` export plus compatible legacy `snstr/utils/ephemeral-relay` alias; automated package self-reference checks |
| Cleanup is lifecycle-observable                      | test setup awaits `NostrRelay.close()` without a fixed delay or swallowed teardown failure                                           |
| Full verification                                    | focused lifecycle Bun 25/25; full Jest/Bun 1026/1026; commands, types, builds, examples, and pack pass                               |

## Decisions

- Keep `NostrRelay` supported for Node integration tests through the canonical `snstr/testing` subpath.
- Retain the legacy subpath for 0.x compatibility while teaching all repository consumers the canonical boundary.
- Keep integration-only setup in `tests/`; production builds and tarballs must not contain private test helpers or ambient test globals.
