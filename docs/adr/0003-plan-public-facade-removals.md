# Plan Public Facade consolidations and Compatibility Alias removals

SNSTR will keep Compatibility Aliases through the remaining 0.x line and remove them deliberately in the next major release. Each dual Public Facade gains one canonical replacement now; deprecated aliases stay exported and documented until that major bump. This preserves downstream imports while making the supported surface intentional for agents and humans.

## Kill list (planned next major)

| Compatibility Alias / dual | Canonical replacement | Notes |
| --- | --- | --- |
| `ZapClient` | `NostrZapClient` | NIP-57 Public Facade |
| `SimpleNIP46Client` / `SimpleNIP46Bunker` | `NostrRemoteSignerClient` / `NostrRemoteSignerBunker` | Simple is demo/compat only |
| `initializeCrypto` (root/web NIP-17 alias) | `initializeNIP17Crypto` | Already `@deprecated` |
| `nip19.validateRelayUrl` | `isValidRelayUrl` from NIP-19 secure helpers | Already `@deprecated` |
| `RelayInformation` | `RelayInfo` | Already `@deprecated` |
| NIP-47 `LogArgument` / logger type aliases | Root `DiagnosticLogArgument` / `DiagnosticLogger` | ADR 0002 |
| NIP-02 `Logger` warn-only alias | `WarningLogger` / root diagnostics | ADR 0002 |
| NIP-46 `getPublicKey` | `getUserPublicKey` | Already `@deprecated` |
| NIP-46 boolean validators named like `validateEventContent` / `validatePrivateKey` / overlapping peers | NIP-specific `isValidNip46*` names | Keep old names as aliases until major |

## Considered Options

- Remove Compatibility Aliases immediately in 0.x. Rejected because it breaks consumers without a major version signal.
- Keep dual Public Facades indefinitely without deprecation. Rejected because agents and docs treat both as first-class and the surfaces drift.

## Consequences

- 0.x work may deprecate and document, but must not delete listed aliases.
- New code and examples should prefer the canonical Public Facade.
- Simple NIP-46 must not gain new capabilities; Full is the production path.
- Root/web type exports should be explicit allowlists that still include listed aliases until the major removal.
