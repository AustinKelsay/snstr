# Review Packet: #118 Authoritative Protocol Messages

## Fixed Point

- Base: `staging` at `c7cb99f`
- Branch: `feature/protocol-message-types`
- Issue: #118

## Change Story

- `src/types/protocol.ts` is the single owner of supported client/Relay wire tuples.
- Direction-specific unions prevent client and Relay producers from emitting opposite-direction shapes.
- Main Relay subscription, unsubscription, publication, and authentication messages consume canonical client types.
- Ephemeral Relay output consumes the canonical Relay union; its duplicate EVENT alias is removed.
- Protocol types are exposed from the package root as type-only exports, preserving Node/web runtime parity.
- Current NIP-01 `CLOSED` is included because runtime support already existed even though the ticket list omitted it.

## Compatibility

- Existing individual tuple type names remain available.
- JSON tuple serialization is unchanged and explicitly tested.
- No runtime export was added.
- Valid wire parsing and serialization are unchanged; malformed ephemeral Relay REQ filters now use the existing validation boundary instead of an unchecked assertion.

## Review Axes

### Standards

- Canonical type ownership is deep enough to remove producer-side tuple duplication.
- Direction-specific names make ownership and valid use clear.
- Type-only root exports avoid accidental runtime API expansion.

### Specification

- Current NIP-01 client tuples: EVENT, REQ, CLOSE.
- Current NIP-01 Relay tuples: EVENT, OK, EOSE, CLOSED, NOTICE.
- Current NIP-42 AUTH is covered in both directions.
- All ticket acceptance criteria have an implementation and verification seam.

## Verification

- Targeted protocol/Relay: 60/60
- Jest: 73 suites, 994/994
- Bun: pass
- Commands, lint, root/examples typechecks, CJS/ESM build, examples build, pack verification: pass

## Known Tooling Limitation

- Grok could not be delegated because the required `agent` CLI is unauthenticated. Per the Grok skill, no substitute subagent was used.
