# NIP-19 Examples

This directory contains examples for using NIP-19 (Bech32-Encoded Entities) functionality in the SNSTR library.

## Overview

NIP-19 defines how Nostr entities are encoded using the Bech32 format, making them human-readable and easier to share. These examples demonstrate how to encode and decode various Nostr entities.

## Running Examples

```bash
# Basic NIP-19 demo
npm run example:nip19

# NIP-19 with verbose logging
npm run example:nip19:verbose

# Specific examples
npm run example:nip19:bech32     # Basic Bech32 entities
npm run example:nip19:tlv        # TLV entities
```

## Example Files

- `basic-demo.ts` - Comprehensive demo of all NIP-19 functionality
- `bech32-example.ts` - Examples focusing on basic Bech32 entities (npub, nsec, note)
- `tlv-example.ts` - Examples focusing on TLV entities (nprofile, nevent, naddr)
- `validation-example.ts` - Examples of validation and error handling

## Key Concepts

### Basic Bech32 Entities

- **npub** - Public keys encoded in Bech32 format
- **nsec** - Private keys encoded in Bech32 format
- **note** - Note IDs encoded in Bech32 format

### TLV (Type-Length-Value) Entities

- **nprofile** - Profile with optional relay information
- **nevent** - Event with optional relay and author information
- **naddr** - Parameterized replaceable event address

### Generic Decoding

The generic `decode()` function can handle any NIP-19 entity type and return the appropriate data.

## Integration with Other NIPs

NIP-19 entities can be used with:

- NIP-01 events (referencing notes and public keys)
- NIP-05 DNS identifiers (with npub)
- NIP-07 browser extensions (for signing)
- NIP-46 Nostr Connect (for remote signing)

## Best Practices

- Always validate inputs before encoding
- Handle decoding errors gracefully
- Use the appropriate entity type for each use case
- Prefer the generic `decode()` function when the entity type is unknown 