# NIP-19 Tests

This directory contains tests for the Nostr NIP-19 implementation, which provides bech32-encoded entities for Nostr.

## Test Coverage

- ✅ Basic entity encoding/decoding (npub, nsec, note)
- ✅ Complex TLV-based entities (nprofile, nevent, naddr)
- ✅ Universal decoder functionality
- ✅ Error handling for invalid inputs
- ✅ Edge cases with unusual inputs
- ✅ Entity validation

## Running the Tests

```bash
# Run all NIP-19 tests
npm run test:nip19

# Run a specific test file
npx jest tests/nip19/bech32.test.ts
```

## Test Files

- `bech32.test.ts`: Tests for basic Bech32 encoding/decoding
- `tlv.test.ts`: Tests for TLV-based entities (nprofile, nevent, naddr)
- `validation.test.ts`: Tests for validation, error handling, and edge cases
- `security.test.ts`: Comprehensive security tests for URL validation, TLV limits, and more

## Test Structure

The tests are organized by entity type and functionality:

1. **Basic Entities**: Tests for simple entities like npub, nsec, note
2. **TLV Entities**: Tests for complex entities that use Type-Length-Value format
3. **Universal Decoder**: Tests for the generic decode function
4. **Validation**: Tests for validation logic
5. **Error Handling**: Tests for proper error handling with invalid inputs
6. **Edge Cases**: Tests for handling unusual inputs and boundary conditions
7. **Security**: Tests for security features and protections against attacks

## Implementation Details

The tests verify that the implementation:

- Properly encodes and decodes all entity types
- Handles TLV (Type-Length-Value) format correctly
- Validates relay URLs and other components
- Provides helpful error messages for invalid inputs
- Respects size limits to prevent DoS attacks
- Follows the NIP-19 specification 

## Security Features

Our implementation includes security features to prevent potential attacks:

1. **Relay URL Validation**: All relay URLs are validated to ensure they:
   - Use proper WebSocket protocols (`ws://` or `wss://`)
   - Have a valid URL format
   - Don't contain potentially malicious content (e.g., JavaScript injection)

2. **TLV Entry Limits**: We enforce limits on TLV entries to prevent DoS attacks:
   - Maximum of 20 TLV entries per encoded entity
   - Maximum relay URL length of 512 bytes
   - Maximum identifier length of 1024 bytes

3. **Error Handling**: Proper error handling for all encoding and decoding operations

## Key Test Cases

### Relay URL Validation

Tests ensure all encoding functions (`encodeProfile`, `encodeEvent`, `encodeAddress`) properly validate relay URLs:

```typescript
// Valid relay URL
const validProfile = {
  pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
  relays: ['wss://relay.example.com']
};

// Invalid relay URL
const invalidProfile = {
  pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
  relays: ['not-a-valid-url']
};

// Valid URL should work, invalid should throw
expect(() => encodeProfile(validProfile)).not.toThrow();
expect(() => encodeProfile(invalidProfile)).toThrow(/Invalid relay URL/);
```

### TLV Entry Limits

Tests verify enforcement of TLV entry limits to prevent DoS attacks:

```typescript
// Create many relays (exceeding MAX_TLV_ENTRIES)
const manyRelays = Array(21).fill(0).map((_, i) => `wss://relay${i}.example.com`);

const profileWithManyRelays = {
  pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
  relays: manyRelays
};

// Should throw due to too many relays
expect(() => encodeProfile(profileWithManyRelays)).toThrow(/Too many relay entries/);
```

These tests ensure our implementation complies with the NIP-19 spec while also providing protection against common security vulnerabilities. 