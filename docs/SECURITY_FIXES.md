# Security Fixes

This document outlines security improvements made to the SNSTR library.

## NIP-19 Implementation Security Enhancements

### 1. Relay URL Validation during Encoding

**Issue:** The `validateRelayUrl` function was defined but not properly used in all encoding functions, allowing potentially malicious or invalid relay URLs to be included in encoded strings.

**Fix:** Implemented consistent relay URL validation in all encoding functions (`encodeProfile`, `encodeEvent`, `encodeAddress`). The validation ensures that:
- URLs must start with the correct websocket protocol (`wss://` or `ws://`)
- URLs must be valid according to the URL constructor
- URLs must not exceed a reasonable length limit

**Impact:** This prevents potential injection attacks through malformed relay URLs and ensures that all encoded entities contain valid relay URLs.

### 2. TLV Entry Limits Enforcement

**Issue:** While the code defined a `MAX_TLV_ENTRIES` constant of 100, this limit was not consistently enforced across all functions, potentially allowing denial of service attacks.

**Fix:** Enforced consistent checking of TLV entry counts:
- Added explicit checks in all encoding functions to prevent exceeding the maximum number of relay entries
- The `decodeTLV` function now properly enforces the maximum number of entries
- Added validation and error handling for oversized entries in TLV data

**Impact:** This prevents potential denial of service attacks that could occur when processing an extremely large number of TLV entries, similar to protections in reference implementations like nostr-tools.

### 3. Size Limits for URL and Identifier Fields

**Issue:** No explicit size limits were enforced on relay URLs and identifiers, potentially allowing extremely large strings to be encoded and processed.

**Fix:** Implemented reasonable size limits:
- Maximum relay URL length: 512 characters
- Maximum identifier length: 1024 characters
- Default bech32 data limit: 5000 bytes

**Impact:** This prevents potential memory issues or denial of service attacks through oversized data fields.

### 4. Comprehensive Test Coverage

**Issue:** Security edge cases were not adequately tested, making it hard to verify the robustness of the implementation.

**Fix:** Added comprehensive tests that specifically verify:
- Validation of malformed relay URLs
- Enforcement of size limits
- Error handling for invalid inputs
- Edge cases such as empty arrays and large values

**Impact:** Improved test coverage helps ensure that security measures are properly implemented and maintained.

## Recommendations for Users

1. Update to the latest version of the library to benefit from these security improvements.
2. When implementing custom code that uses NIP-19 entities, always validate inputs before encoding, especially when accepting relay URLs from user input.
3. When processing decoded entities, be aware that the library is intentionally permissive during decoding (following the Nostr specification), so additional validation may be necessary depending on your use case.

## Additional Resources

- [NIP-19 Specification](https://github.com/nostr-protocol/nips/blob/master/19.md)
- [Implementation README](./src/nip19/README.md)
- [Test Cases](./tests/nip19/validation.test.ts) 