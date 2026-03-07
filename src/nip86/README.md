# NIP-86

Relay management client and NIP-98 authorization helpers.

Primary exports:

- `RelayManagementClient`
- `useRelayManagementFetchImplementation`
- `toRelayManagementHttpUrl`
- `createHttpAuthEventTemplate`
- `createHttpAuthHeader`

`RelayManagementClient` speaks the JSON-RPC-like HTTP API described by NIP-86
and can attach NIP-98 `Authorization: Nostr ...` headers when a `Signer` is
provided.
