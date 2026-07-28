# Issue Session: #114 NIP-47 Protocol Machinery

## Scope

- Fixed point: `da7361e` (`staging` after PR #122)
- Branch: `feature/nip47-protocol-codecs`
- Issue: #114
- Owner: current Codex orchestrator; Grok unavailable because `agent` authentication is required

## Acceptance Map

| Acceptance criterion | Implementation / verification seam |
| --- | --- |
| Canonical URL and wire validation owners | `src/nip47/protocol.ts` |
| Client and service delegate pure protocol work | client delegates URL/response codecs; service delegates request parsing and dispatch |
| Exhaustive compatible dispatch | `src/nip47/requestDispatcher.ts` plus direct tests |
| Preserve lifecycle and encryption negotiation | existing public NIP-47 and NIP-44 integration suites |
| Full verification | post-hosted-review focused 71/71; full Jest/Bun 1021/1021; commands, types, builds, pack; hosted CodeRabbit and Bun/Node 16/18/20 checks green |

## Decisions

- Keep relays, encryption, correlation, timeouts, TTL state, and publishing in the client/service.
- Preserve historical loose public parameter acceptance and wallet error propagation; stricter security policy belongs to #117.
- Keep the codec and dispatcher internal rather than expanding the package export surface.
