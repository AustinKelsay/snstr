# Review Packet: #114 NIP-47 Protocol Machinery

## Fixed Point

- Base: `staging` at `da7361e`
- Branch: `feature/nip47-protocol-codecs`
- Issue: #114

## Change Story

- One internal codec owns NWC URLs, request JSON parsing, response JSON parsing, and response envelope validation.
- One internal dispatcher owns supported-method gating, method parameter guards, wallet invocation, response envelopes, and compatible error mapping.
- Stateful client/service classes retain encryption negotiation, event handling, request correlation, timeouts, relays, and notifications.
- Direct codec/dispatcher tests supplement the unchanged public integration suite.

## Verification

- Focused NIP-47 after hosted review: 8 suites, 71/71
- Full Jest: 76 suites, 1021/1021
- Full Bun: 1021/1021
- Commands, lint, root/examples typechecks, CJS/ESM build, examples build, and pack verification: pass
- Local CodeRabbit: 2 findings fixed; 7 compatibility/security-scope suggestions skipped with evidence
- Hosted CodeRabbit: relay-less URLs, malformed-envelope error mapping, and invalid secondary lookup identifiers fixed; broader security/behavior changes deferred to #117 or skipped for compatibility

## Known Tooling Limitation

- Grok could not be delegated because the required `agent` CLI is unauthenticated. Per the Grok skill, no substitute subagent was used.
