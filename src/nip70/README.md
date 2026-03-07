# NIP-70

Helpers for protected events.

Primary exports:

- `PROTECTED_TAG_NAME`
- `PROTECTED_TAG`
- `hasProtectedTag`
- `withProtectedTag`
- `inheritProtectedTag`

Use `withProtectedTag` to add the `["-"]` tag to an event template and
`inheritProtectedTag` when replies or derivative events should preserve a
parent event's protected status.
