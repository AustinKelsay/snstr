# Unify diagnostics without breaking logger consumers

SNSTR will expand and migrate its logging interfaces before removing legacy contracts: the core logger becomes the canonical diagnostic implementation, public NIP-specific logger types remain compatible aliases or narrow views during the 0.x line, and final removal waits for the next major release. This preserves downstream warn-only NIP-02 loggers while giving new and migrated code one consistent five-level diagnostic interface.

## Considered Options

- Replace the root `Logger` contract immediately. Rejected because downstream NIP-02 consumers may implement only `warn`, and requiring the full diagnostic interface would break them.
- Keep the three unrelated logger contracts indefinitely. Rejected because it preserves ambiguous root ownership and makes each diagnostic cleanup repeat the same adapter work.

## Consequences

- Expansion and migration in the current feature must not remove a public type or require new methods from existing logger implementations.
- Deprecated aliases remain until the next major release, when the contract phase may remove them deliberately.
- Root and web entrypoints must expose equivalent platform-safe diagnostic types.
