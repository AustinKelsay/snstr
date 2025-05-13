# NIP-04 Examples

This directory contains examples demonstrating how to use NIP-04 encrypted direct messaging functionality in the SNSTR library.

## Overview

[NIP-04](https://github.com/nostr-protocol/nips/blob/master/04.md) defines a protocol for encrypted direct messages in Nostr. It uses ECDH (Elliptic Curve Diffie-Hellman) to create a shared secret between sender and recipient, then encrypts the message with AES-256-CBC.

**Implementation Details**:
- Uses HMAC-SHA256 with the key "nip04" for shared secret derivation
- Ensures compatibility with nip04 spec compliant nostr libraries and clients
- Provides robust validation of message format and proper error handling

**Note**: NIP-04 is considered less secure than NIP-44 and has been marked as "unrecommended" in favor of NIP-44. It's provided here for compatibility with older clients.

## Examples

### Direct Message Example

The [`direct-message.ts`](./direct-message.ts) example demonstrates:

- Generating keypairs for two users (Alice and Bob)
- Encrypting a message with NIP-04 from Alice to Bob
- Decrypting the message on Bob's side
- Verifying that the shared secret is identical in both directions
- Handling various error conditions with malformed messages

## Running the Examples

To run the direct message example:

```bash
npm run example:nip04
```

## Key Concepts

- **Shared Secret Generation**: Both parties can independently derive the same shared secret using ECDH
- **Shared Secret Processing**: The X coordinate is extracted from the shared point and processed with HMAC-SHA256
- **Message Encryption/Decryption**: Using AES-256-CBC with the derived shared secret
- **Key Exchange**: No direct key exchange is needed; only public keys are shared
- **Cross-Platform Compatibility**: Uses Web Crypto API which works in both browsers and Node.js
- **Interoperability**: Compatible with other Nostr clients like nostr-tools implementations

## Security Considerations

- NIP-04 has known security issues compared to newer encryption methods
- Consider using NIP-44 for new implementations
- The encryption does not provide forward secrecy
- There's no authentication of the encrypted message

## API Functions Used

- `generateKeypair()`: Generate a new Nostr keypair
- `encrypt()`: Encrypt a message using NIP-04
- `decrypt()`: Decrypt a message using NIP-04
- `getSharedSecret()`: Get the shared secret between two keys

## Related NIPs

- [NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md): Encrypted Messaging with Versioning (recommended alternative)
- [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md): Basic Protocol (events and structure) 