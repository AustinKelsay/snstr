# NIP-57 Tests

This directory contains tests for the NIP-57 (Lightning Zaps) implementation, which standardizes the integration of Bitcoin Lightning Network payments with Nostr.

## Test Coverage

- ✅ Zap request creation and validation
- ✅ Zap receipt creation and validation
- ✅ LNURL-pay integration
- ✅ Invoice parsing and validation
- ✅ Description hash verification
- ✅ Zap split functionality
- ✅ Lightning address parsing
- ✅ Anonymous zaps
- ✅ NostrZapClient functionality

## Running the Tests

```bash
# Run all NIP-57 tests
npm run test:nip57

# Run a specific test file
npx jest tests/nip57/zap.test.ts
```

## Test Files

- `zap.test.ts`: Comprehensive tests for all NIP-57 functionality

## Test Fixtures

The tests use several types of fixtures:

1. **Mock Zap Requests/Receipts**: Preset events that follow the NIP-57 format
2. **Mock LNURL-pay Responses**: Simulated responses from Lightning payment servers
3. **Bolt11 Invoices**: Test Lightning invoices for validation
4. **Mock Event IDs**: For testing zaps to specific events

## Security Validation

The tests ensure that the implementation properly secures the Zap protocol:

- Validates receipt signatures from expected LNURL servers
- Verifies that bolt11 invoices commit to the correct zap request
- Checks description hash validation to prevent invoice tampering
- Ensures proper validation of all zap receipt fields

## Implementation Details

The tests verify that the implementation follows the NIP-57 specification, including:

- Proper event kinds and tags
- Correct relay formatting
- Validation of all required and optional fields
- Handling of zap splits with weight-based distribution
- Support for anonymous zaps through `P` tags
- Integration with LNURL-pay protocol
- Support for a-tags for parameterized replaceable events 