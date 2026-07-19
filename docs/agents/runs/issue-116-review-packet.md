# Review Packet: #116 Ephemeral Relay Ownership

## Fixed Point

- Base: `staging` at `9e3aca8`
- Branch: `feature/ephemeral-relay-ownership`
- Issue: #116

## Change Story

- `snstr/testing` is now the canonical Node-only package boundary for the supported in-memory `NostrRelay` integration utility.
- The legacy ephemeral-relay subpath remains compatible, while source tests, examples, and consumer documentation use the canonical export.
- Test setup moved out of production source and now observes teardown by awaiting `close()` instead of sleeping for a fixed delay.
- Unused ambient test globals were removed, and package verification rejects both former private support surfaces.
- Package verification executes CJS and ESM self-reference checks for the canonical subpath and a CJS compatibility check for the legacy alias.

## Verification

- Focused ephemeral Relay lifecycle/integration Bun: 3 files, 25/25
- Full Jest: 77 suites, 1026/1026
- Full Bun: 1026/1026
- Commands, lint, root/examples typechecks, CJS/ESM build, examples build, and pack verification: pass
- Local CodeRabbit: zero findings
- Hosted CodeRabbit: 2 package-verification findings fixed; 2 unrelated pre-existing NIP-02 example findings skipped as outside this branch's behavior

## Known Tooling Limitation

- Grok could not be delegated because the required `agent` CLI is unauthenticated. Per the Grok skill, no substitute subagent was used.
