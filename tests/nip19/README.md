# NIP-19 Tests

This directory contains tests for the Nostr NIP-19 implementation, which provides bech32-encoded entities for Nostr.

## Test Coverage

- ✅ Basic entity encoding/decoding (npub, nsec, note)
- ✅ Complex TLV-based entities (nprofile, nevent, naddr)
- ✅ Universal decoder functionality
- ✅ Error handling for invalid inputs
- ✅ Edge cases with unusual inputs
- ✅ Entity validation
- ✅ Comprehensive security testing

## Running the Tests

```bash
# Run all NIP-19 tests
npm run test:nip19

# Run a specific test file
npx jest tests/nip19/bech32.test.ts

# Run security tests specifically
npx jest tests/nip19/security.test.ts
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
   - Don't include credentials, null bytes, or other dangerous characters
   - Use valid port numbers (1-65535)
   - Handle international domain names properly

2. **TLV Entry Limits**: We enforce limits on TLV entries to prevent DoS attacks:
   - Maximum of 20 TLV entries per encoded entity
   - Maximum relay URL length of 512 bytes
   - Maximum identifier length of 1024 bytes

3. **Error Handling**: Proper error handling for all encoding and decoding operations

4. **Input Filtering**: Security-focused functions to filter untrusted inputs:
   - `filterProfile`: Remove invalid relay URLs from profiles
   - `filterEvent`: Remove invalid relay URLs from events
   - `filterAddress`: Remove invalid relay URLs from addresses
   - `isValidRelayUrl`: Validate relay URLs before using them

## Comprehensive Security Tests

The `security.test.ts` file includes tests for:

1. **URL Validation and Sanitization**
   - Protocol validation
   - Malicious URL detection
   - Credentials handling
   - URLSearchParams validation
   - Fragment validation

2. **Host Validation**
   - Domain validation
   - International domain name handling
   - Homograph attack detection awareness

3. **TLV Entry Limits**
   - Preventing DoS via excessive entries

4. **Decode Security**
   - Handling of manually crafted TLV entries
   - Relay count validation

5. **Integration with Decoders**
   - Safe decoding of potentially malicious profiles

6. **Edge Cases**
   - Port number validation
   - URL special characters
   - Various extreme URL formats

## Security Best Practices

When working with NIP-19 and relay URLs:

1. Always validate any relay URL before processing or connecting
2. Use the `filterProfile`, `filterEvent`, and `filterAddress` functions when receiving untrusted inputs
3. Be cautious with URL parameters and fragments which may contain malicious content
4. Consider homograph attacks when displaying internationalized domain names
5. Apply URL length limits to prevent DoS attacks
6. Use the `isValidRelayUrl` function to validate any relay URL

## References

- [NIP-19 Specification](https://github.com/nostr-protocol/nips/blob/master/19.md)
- [OWASP URL Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) 