# NIP-05 Examples

This directory contains examples demonstrating how to use NIP-05 (Mapping Nostr keys to DNS-based internet identifiers) functionality in the SNSTR library.

## Overview

[NIP-05](https://github.com/nostr-protocol/nips/blob/master/05.md) defines a protocol for verifying the ownership of internet identifiers (like `name@example.com`) and mapping them to Nostr public keys. It works through DNS-based verification by having the domain serve a specific JSON file.

## Examples

### NIP-05 Demonstration

The [`nip05-demo.ts`](./nip05-demo.ts) example demonstrates:

- Looking up NIP-05 identifiers to find associated public keys
- Verifying if a NIP-05 identifier matches a specific public key
- Getting recommended relays for a user from their NIP-05 record
- Testing with both valid and invalid identifiers

## Running the Examples

To run the NIP-05 example:

```bash
npm run example:nip05
```

For more detailed logging, enable verbose mode:

```bash
VERBOSE=true npm run example:nip05
```

## Key Concepts

- **NIP-05 Identifiers**: Internet identifiers in the format `name@domain.com`
- **Verification Process**: The domain hosts a `/.well-known/nostr.json` file mapping names to public keys
- **Relay Recommendations**: Domains can suggest preferred relays for their users
- **Secure Connections**: All NIP-05 lookups use secure HTTPS connections with TLS certificate validation

## API Functions Used

- `lookupNIP05()`: Query a domain for NIP-05 records
- `verifyNIP05()`: Check if a NIP-05 identifier matches a given public key
- `getNIP05PubKey()`: Extract a public key from a NIP-05 identifier
- `getNIP05Relays()`: Get recommended relays for a NIP-05 identifier and pubkey

## Sample Output

When running the example with real identifiers like `jack@cash.app`, you'll see:

- The associated public key (if found)
- Recommended relays (if any)
- Verification results with correct and incorrect public keys

## Security Features

- Case-insensitive username handling
- TLS certificate validation for secure connections
- Cross-platform compatibility (works in both browsers and Node.js)
- Error handling for network issues and malformed responses

## Related NIPs

- [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md): Basic protocol flow (events)
- [NIP-65](https://github.com/nostr-protocol/nips/blob/master/65.md): Relay List Metadata (more sophisticated relay lists)

## Practical Applications

- User-friendly identifiers instead of cryptographic public keys
- Identity verification across Nostr clients
- Directory services for Nostr users 