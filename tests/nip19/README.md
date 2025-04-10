# NIP-19 Tests

This directory contains tests for the NIP-19 (Bech32-Encoded Entities) implementation, which defines human-readable encodings for various Nostr entities.

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

## Test Structure

The tests are organized by entity type and functionality:

1. **Basic Entities**: Tests for simple entities like npub, nsec, note
2. **TLV Entities**: Tests for complex entities that use Type-Length-Value format
3. **Universal Decoder**: Tests for the generic decode function
4. **Validation**: Tests for validation logic
5. **Error Handling**: Tests for proper error handling with invalid inputs
6. **Edge Cases**: Tests for handling unusual inputs and boundary conditions

## Implementation Details

The tests verify that the implementation:

- Properly encodes and decodes all entity types
- Handles TLV (Type-Length-Value) format correctly
- Validates relay URLs and other components
- Provides helpful error messages for invalid inputs
- Respects size limits to prevent DoS attacks
- Follows the NIP-19 specification 