# NIP-46 (Nostr Connect) Examples

This directory contains examples showcasing how to use the NIP-46 Remote Signing protocol implementation in the `snstr` library.

## What is NIP-46?

NIP-46 (Nostr Connect) is a protocol that allows for secure remote signing of Nostr events. It enables separation between:

* A **Bunker** (signer): holds private keys and performs cryptographic operations
* A **Client**: requests operations from the bunker without needing direct access to private keys

This separation enhances security by keeping private keys isolated, while still allowing applications to interact with Nostr.

## NIP-46 Implementation

This library provides two sets of implementations:

### 1. Simple/Modular Implementation (Recommended)

The new modular implementation is easier to use and understand:

* `SimpleNIP46Client`: Lightweight client for requesting operations
* `SimpleNIP46Bunker`: Straightforward bunker for handling signing requests
* Improved logging with `LogLevel` enum for better debugging
* Clean separation of concerns and better error handling

### 2. Full-Featured Implementation (Original)

The original implementation offers more customization:

* `NostrRemoteSignerClient`: Feature-rich client with extensive options
* `NostrRemoteSignerBunker`: Configurable bunker with advanced settings
* More complex but with additional flexibility

## Examples Structure

The examples are organized by complexity:

### Minimal Examples

Basic examples to get started quickly:

* `minimal.ts`: The simplest possible implementation
* Demonstrates client-bunker connection and basic signing

### Simple Examples

Slightly more detailed examples:

* Examples in the `simple/` directory
* More detailed logging and error handling
* Various basic use cases

### Advanced Examples

Complex scenarios and debugging tools:

* `advanced/remote-signing-demo.ts`: Full demonstration with encryption, permissions, and more
* `advanced/debug-example.ts`: Enhanced logging and step-by-step verification for troubleshooting

## How to Run Examples

1. Make sure you have compiled the library:

```bash
npm run build
```

2. Run an example using ts-node:

```bash
npx ts-node examples/nip46/minimal.ts
# or
npx ts-node examples/nip46/advanced/remote-signing-demo.ts
```

3. For debugging with more verbose output, use:

```bash
npx ts-node examples/nip46/advanced/debug-example.ts
```

## Key Features Demonstrated

* Creating and managing bunkers and clients
* Secure connection establishment
* Remote event signing
* NIP-04 encryption and decryption
* Permission management
* Error handling and debugging

## Implementing in Your Application

To integrate NIP-46 in your application:

1. Create a bunker with your user's private key:

```typescript
import { SimpleNIP46Bunker } from 'snstr';

const bunker = new SimpleNIP46Bunker(
  relays,
  userPublicKey,
  signerPublicKey
);
bunker.setUserPrivateKey(userPrivateKey);
await bunker.start();
```

2. Share the connection string with clients:

```typescript
const connectionString = bunker.getConnectionString();
// Share this connection string securely
```

3. Connect clients to the bunker:

```typescript
import { SimpleNIP46Client } from 'snstr';

const client = new SimpleNIP46Client(relays);
await client.connect(connectionString);
```

4. Use the client to sign events remotely:

```typescript
const event = {
  kind: 1,
  content: 'Hello, Nostr!',
  created_at: Math.floor(Date.now() / 1000),
  tags: []
};

const signedEvent = await client.signEvent(event);
```

## Security Considerations

* **Private Keys**: Never share private keys between applications
* **Permissions**: Configure bunker permissions carefully
* **Encryption**: Use separate relays for NIP-46 communication when possible 