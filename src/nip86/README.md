# NIP-86

Relay management client and NIP-98 authorization helpers.

Primary exports:

- `RelayManagementClient`
- `useRelayManagementFetchImplementation`
- `toRelayManagementHttpUrl`
- `createHttpAuthEventTemplate`
- `createHttpAuthHeader`

## Request and response shape

`RelayManagementClient` sends HTTP `POST` requests with
`Content-Type: application/nostr+json+rpc` and a JSON-RPC-like payload:

```json
{
  "method": "listbannedpubkeys",
  "params": []
}
```

Each request uses a method name such as `supportedmethods`, `banpubkey`,
`listbannedpubkeys`, or `allowevent`, plus a positional `params` array.

Successful responses are expected to include a defined `result` field:

```json
{
  "result": []
}
```

Relay or transport failures are surfaced through either HTTP error statuses or
payloads with an `error` field:

```json
{
  "error": "unauthorized"
}
```

`RelayManagementClient.call()` throws `RelayManagementError` for non-OK HTTP
statuses, payload errors, invalid JSON, missing `result`, and request-level
failures.

## URL conversion

Use `toRelayManagementHttpUrl()` to turn a relay URL into its management
endpoint URL. The function canonicalizes websocket relay strings using the same
shared relay normalization rules used elsewhere in the library, then maps:

- `ws://...` to `http://...`
- `wss://...` to `https://...`

Existing `http://` and `https://` URLs are preserved, and unsupported schemes
still throw.

```ts
toRelayManagementHttpUrl("wss://relay.example.com");
// => "https://relay.example.com/"

toRelayManagementHttpUrl("relay.example.com/admin");
// => "https://relay.example.com/admin"
```

## Fetch wiring

`RelayManagementClient` uses the fetch implementation registered through
`useRelayManagementFetchImplementation()`. In environments with a global
`fetch`, the default behavior is usually enough. In tests, React Native, or
custom runtimes, install the correct transport once before making requests:

```ts
useRelayManagementFetchImplementation(fetch);
```

## Signer-based auth flow

When a `Signer` is provided to `RelayManagementClient`, the client attaches a
NIP-98 `Authorization: Nostr ...` header automatically.

The flow is:

1. `createHttpAuthEventTemplate()` builds the unsigned NIP-98 event with `u`,
   `method`, and optional `payload` tags.
2. The supplied `Signer` signs that template.
3. `createHttpAuthHeader()` base64-encodes the signed event into the HTTP
   `Authorization` header.

That keeps relay-management auth aligned with the same signer abstraction used
throughout the rest of the library.

## Timeout and error semantics

Each `RelayManagementClient` request creates an `AbortController` and aborts the
underlying fetch when `timeoutMs` elapses. The default timeout is `5000ms`.

The client does not retry automatically. If the request is aborted, the network
fails, the relay returns invalid JSON, or the relay responds with an error, the
caller receives a `RelayManagementError` and can decide whether to retry.

## Minimal example

```ts
import {
  LocalKeySigner,
  RelayManagementClient,
} from "snstr";

const signer = new LocalKeySigner(process.env.NOSTR_PRIVATE_KEY!);
const client = new RelayManagementClient("wss://relay.example.com", {
  signer,
  timeoutMs: 5000,
});

const bannedPubkeys = await client.listBannedPubkeys();
console.log(bannedPubkeys);
```

`RelayManagementClient` speaks the JSON-RPC-like HTTP API described by NIP-86
and can attach NIP-98 `Authorization: Nostr ...` headers when a `Signer` is
provided.
