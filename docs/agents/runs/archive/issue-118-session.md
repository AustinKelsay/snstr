# Issue Session: #118 Authoritative Protocol Messages

## Scope

- Fixed point: `c7cb99f` (`staging` after PR #120)
- Branch: `feature/protocol-message-types`
- Issue: #118
- Owner: current Codex orchestrator; Grok unavailable because `agent` authentication is required

## Acceptance Map

| Acceptance criterion | Implementation / verification seam |
| --- | --- |
| One canonical owner for EVENT, REQ, CLOSE, OK, EOSE, NOTICE, and AUTH tuples | `src/types/protocol.ts`; current NIP-01 `CLOSED` support is included as well |
| Main and ephemeral Relay consume canonical definitions | `src/nip01/relay.ts`, `src/utils/ephemeral-relay.ts` |
| Remove stale local aliases and comments | `ClientMessage` and `NostrRelayEventMessage` removed |
| Preserve runtime behavior and compile-time coverage | direction-specific tuple assertions and serialization tests |
| Full verification matrix | completed; see verification results below |

## Decisions

- Keep the existing individual public tuple names for compatibility.
- Add direction-specific `NostrClientMessage` and `NostrRelayMessage` unions so producers cannot accidentally emit a tuple belonging to the opposite side.
- Re-export the authoritative protocol module from the package root.
- Preserve JSON parsing and serialization behavior; this ticket changes type ownership, not wire semantics.
- Include the existing runtime-supported `CLOSED` tuple, which current NIP-01 defines but the ticket list omitted.

## Verification

- `npx tsc --noEmit`: pass
- Targeted protocol and Relay suites: 60/60 pass
- Full Jest: 73 suites, 994/994 pass
- Full Bun: pass
- Commands, lint, root/examples typecheck, CJS/ESM build, examples build, and pack verification: pass
