# NIP-46 Remote Signing

## Overview

NIP-46 is a protocol that enables remote signing of Nostr events, allowing separation of private keys (in a "bunker") from client applications while maintaining security through encrypted communication.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for diagrams and a visual explanation of how NIP-46 works.

## Key Concepts

- **Bunker**: A secure server that holds private keys and signs events on request
- **Client**: An application that requests signatures from the bunker
- **User Keypair**: The identity keypair used to sign Nostr events
- **Signer Keypair**: The keypair used for encrypted communication between client and bunker
- **Connection String**: Format `bunker://{signer_pubkey}?relay={relay_url}`

## Examples

### Unified Example (`unified-example.ts`) - RECOMMENDED

A single comprehensive example that shows the core functionality:

```bash
npm run example:nip46:unified
```

Key features demonstrated:
- Setting up a bunker with proper permissions
- Connecting a client to the bunker
- Remotely signing events
- Verifying signatures

### Other Examples

For specific use cases or educational purposes:

1. **Minimal** (`minimal.ts`): The most basic functionality
2. **Advanced** (`advanced/`): More complex features including auth challenges
3. **From Scratch** (`from-scratch/`): Implementation without using library classes

## Implementation Details

This library provides two implementations:

1. **Simple Implementation** (`SimpleNIP46Client` / `SimpleNIP46Bunker`)
   - Lightweight with core functionality
   - Uses NIP-04 encryption only
   - Basic permissions support

2. **Full-featured Implementation** (`NostrRemoteSignerClient` / `NostrRemoteSignerBunker`)
   - Advanced features including auth challenges
   - Supports both NIP-04 and NIP-44 encryption
   - Extensive permissions system and metadata

## Best Practices

- Always use `await` with `verifySignature` as it returns a Promise
- Be explicit about allowed permissions when setting up a bunker
- Use separate keypairs for user identity and signer communication in production
- Store private keys securely in real applications

## Specification

For full details, see [NIP-46 Specification](https://github.com/nostr-protocol/nips/blob/master/46.md). 