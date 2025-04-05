# NIP-46 Architecture Overview

## Components

```
+-------------+                +---------------+
|             |  Encrypted     |               |
|   Client    |  Requests      |    Bunker     |
|  (App)      | -------------> |  (Key Store)  |
|             |                |               |
|             |  Encrypted     |               |
|             | <------------- |               |
+-------------+  Responses     +---------------+
                                      ^
                                      |
                                      | Controls
                                      |
                                +---------------+
                                |               |
                                |     User      |
                                |               |
                                +---------------+
```

## Event Flow

1. Client generates a client keypair
2. Client connects to bunker via a connection string
3. Client sends encrypted requests to bunker (sign_event, get_public_key, etc.)
4. Bunker processes requests and returns encrypted responses
5. All communication happens through Nostr relays

## Data Flow

```
+-------------+                +---------------+
|             |                |               |
|   Client    |                |    Bunker     |
|             |                |               |
+-------------+                +---------------+
      |                               |
      | 1. Generate                   |
      |    client keypair             |
      |                               |
      | 2. connect(bunker_url)        |
      |------------------------------>|
      |                               |
      | 3. request(sign_event, etc.)  |
      |------------------------------>|
      |                               | 4. Process request
      |                               |    Sign with user key
      | 5. response(signed_event)     |
      |<------------------------------|
      |                               |
      | 6. Use signed event           |
      |                               |
```

## Communication Format

All requests and responses use kind 24133 events with NIP-04/NIP-44 encrypted content:

### Request Event
```
{
  "kind": 24133,
  "pubkey": <client_pubkey>,
  "content": <encrypted_request>,
  "tags": [["p", <bunker_pubkey>]]
}
```

### Response Event
```
{
  "kind": 24133,
  "pubkey": <bunker_pubkey>,
  "content": <encrypted_response>,
  "tags": [["p", <client_pubkey>]]
}
```

## Security Model

- Private keys remain on the bunker and never travel over the network
- All communication is encrypted end-to-end
- Permissions system controls what clients can request
- Optional authentication challenges for sensitive operations 