# Centralize Nostr Event validation

SNSTR currently validates Nostr Events in the event module, a generic security utility, and Relay-private methods, which splits locality for the same protocol facts. We will preserve the public `validateEvent` interface while introducing a dedicated internal validation module with separate seams for unknown input sanitization and signed-event verification, so Relay accepts events by using that module rather than carrying its own validation implementation.

## Considered Options

- Keep Relay-private validation and only extract helpers. Rejected because it keeps tests tied to private Relay implementation and leaves validation rules split across modules.
- Replace the public `validateEvent` export. Rejected because it would break callers for a cleanup whose value is internal depth and locality.

## Consequences

- Tests should exercise validation through public event and Relay behavior wherever possible.
- Relay-specific exceptions, such as NIP-46 encrypted events, must be explicit options at the validation seam rather than hidden branches in Relay.
