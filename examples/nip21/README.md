# NIP-21: URI Scheme Examples

This directory contains examples for [NIP-21: `nostr:` URI Scheme](https://github.com/nostr-protocol/nips/blob/master/21.md).

## Overview

NIP-21 defines the `nostr:` URI scheme for representing Nostr entities in a standardized way. This allows for:
- Deep linking to Nostr entities in mobile apps
- QR codes containing Nostr identifiers
- Web links that can redirect to Nostr clients
- Standardized sharing of Nostr references

## Running the Examples

```bash
npm run example:nip21
```

## Example Features

### Basic Entity URIs
- Encoding/decoding public keys (`npub` -> `nostr:npub...`)
- Encoding/decoding private keys (`nsec` -> `nostr:nsec...`)
- Encoding/decoding note IDs (`note` -> `nostr:note...`)

### Complex Entity URIs
- Profile URIs with relay information (`nprofile` -> `nostr:nprofile...`)
- Event URIs with metadata (`nevent` -> `nostr:nevent...`)
- Address URIs for replaceable events (`naddr` -> `nostr:naddr...`)

### Error Handling
- Invalid URI formats
- Malformed entities
- Edge cases and validation

### Use Cases
- Mobile app deep links
- QR code generation
- Web link redirects
- Cross-platform sharing

## Key Functions Demonstrated

- `encodeNostrURI()` - Convert NIP-19 entities to nostr: URIs
- `decodeNostrURI()` - Parse nostr: URIs back to entities
- Integration with all NIP-19 entity types
- Proper error handling for invalid URIs

## Security Considerations

- Always validate decoded URIs before using them
- Be cautious with private key URIs in user interfaces
- Validate relay URLs in complex entities
- Handle malformed URIs gracefully

## Related

- [NIP-19 Examples](../nip19/) - Bech32 entity encoding/decoding
- [NIP-21 Implementation](../../src/nip21/) - Source code
- [NIP-21 Tests](../../tests/nip21/) - Test suite 