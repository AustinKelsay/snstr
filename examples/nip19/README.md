# NIP-19 Examples

This directory contains examples for using NIP-19 (Bech32-Encoded Entities) functionality in the SNSTR library.

## Overview

NIP-19 defines how Nostr entities are encoded using the Bech32 format, making them human-readable and easier to share. These examples demonstrate how to encode and decode various Nostr entities and highlight the security features implemented.

## Running Examples

```bash
# Basic NIP-19 demo
npm run example:nip19

# NIP-19 with verbose logging
npm run example:nip19:verbose

# Specific examples
npm run example:nip19:bech32     # Basic Bech32 entities
npm run example:nip19:tlv        # TLV entities
npm run example:nip19:validation # Security and validation features
npm run example:nip19:security   # Security features and best practices
```

## Example Files

- `basic-demo.ts` - Comprehensive demo of all NIP-19 functionality
- `bech32-example.ts` - Examples focusing on basic Bech32 entities (npub, nsec, note)
- `tlv-example.ts` - Examples focusing on TLV entities (nprofile, nevent, naddr)
- `validation-example.ts` - Examples of validation, security features, and error handling
- `security-example.ts` - Focused examples on security features, DoS protection, and best practices

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

## Security Features

The SNSTR implementation of NIP-19 includes several important security features:

### 1. Relay URL Validation

All relay URLs are validated during encoding to ensure they:
- Use proper WebSocket protocols (`ws://` or `wss://`)
- Have a valid URL format
- Don't contain potentially malicious content (e.g., JavaScript injection, XSS attempts)
- Cannot use dangerous protocols like `javascript:`, `data:`, or `file:`

```typescript
// Example of relay URL validation
try {
  encodeProfile({ 
    pubkey: "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
    relays: ["javascript:alert(1)"] // Will throw an error due to invalid protocol
  });
} catch (error) {
  console.error(error.message); // "Invalid relay URL format: javascript:alert(1). Must start with wss:// or ws://"
}
```

This protection is applied consistently across all encoding functions:
- `encodeProfile()` - For nprofile entities
- `encodeEvent()` - For nevent entities
- `encodeAddress()` - For naddr entities

### 2. TLV Entry Limits

To prevent denial of service attacks, the implementation enforces strict TLV entry limits:
- Maximum of 20 TLV entries (including relay URLs)
- This limit is enforced during both encoding AND decoding operations
- Prevents attackers from crafting malicious entries that could consume excessive resources

### 3. Size Limits

Additional size constraints protect against resource exhaustion:
- Maximum relay URL length of 512 characters
- Maximum identifier length of 1024 characters
- Default bech32 data limit of 5000 bytes

### 4. Error Handling

The implementation provides comprehensive error handling with clear, informative error messages:

```typescript
// Example of proper error handling
try {
  const encoded = encodeProfile({
    pubkey: "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
    relays: // 21 relays (exceeds maximum)
  });
} catch (error) {
  console.error(error.message); // "Too many relay entries: 21 exceeds maximum of 20"
}
```

### 5. Decoding Security Concerns

There is an important security concern to be aware of regarding decoding operations:

⚠️ **SECURITY CONCERN**: `decodeProfile()` only warns about invalid URLs but still includes them in the decoded result. This is intentionally permissive to follow the Nostr specification, but can lead to security issues if not handled properly.

You should always filter invalid relay URLs after decoding:

```typescript
// Example of filtering invalid URLs after decoding
function filterInvalidRelays(profile) {
  if (!profile.relays || profile.relays.length === 0) return profile;
  
  // Define a function to validate URLs
  function isValidRelayUrl(url) {
    try {
      if (!url.startsWith('wss://') && !url.startsWith('ws://')) return false;
      const parsedUrl = new URL(url);
      if (parsedUrl.username || parsedUrl.password) return false;
      return true;
    } catch (error) {
      return false;
    }
  }
  
  // Create a safe copy with only valid relay URLs
  return {
    ...profile,
    relays: profile.relays.filter(url => isValidRelayUrl(url))
  };
}

// Usage:
const decodedProfile = decodeProfile(nprofileString);
const safeProfile = filterInvalidRelays(decodedProfile);
```

## Integration with Other NIPs

NIP-19 entities can be used with:

- NIP-01 events (referencing notes and public keys)
- NIP-05 DNS identifiers (with npub)
- NIP-07 browser extensions (for signing)
- NIP-46 Nostr Connect (for remote signing)

## Best Practices

- Always validate inputs before encoding, especially when accepting user input
- Use try/catch blocks when working with NIP-19 functions to handle errors gracefully
- Be aware that decoded entities are intentionally permissive (following the Nostr spec)
- Always filter out invalid relay URLs from decoded entities before using them
- Add additional validation for decoded entities in security-sensitive contexts
- Use type-specific encode/decode functions when the entity type is known
- Treat private keys (nsec) with appropriate security measures 