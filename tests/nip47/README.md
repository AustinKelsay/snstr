# NIP-47 Test Suite

This directory contains tests for the NIP-47 (Nostr Wallet Connect) implementation. The tests verify that our library correctly implements the NIP-47 protocol for connecting Lightning wallets to Nostr clients.

## Test Files

### nip47.test.ts
The main test file that covers:
- URL handling (generating and parsing Nostr Wallet Connect URLs)
- Client-service communication basics
- Request/response message format
- Wallet functionality (getInfo, getBalance, etc.)

### error-handling.test.ts
Tests specifically for error handling functionality:
- `NIP47ClientError` class implementation
- Error codes, categories, and recovery hints
- Proper error handling for NOT_FOUND errors in lookupInvoice
- Standardized error properties matching the NIP-47 specification

### client-validation.test.ts
Tests for parameter validation in client methods:
- Input validation for lookupInvoice method
- Proper error codes for invalid inputs
- Document and handle NOT_FOUND error conditions

## Recent Improvements

Recent improvements to error handling include:
- Enhanced NOT_FOUND error handling for lookupInvoice
- Consistent error messages between client and service
- Helpful recovery hints for common error scenarios
- Better user-facing error messages

## Running the Tests

To run all NIP-47 tests:

```bash
npm test -- tests/nip47
```

To run a specific test file:

```bash
npm test -- tests/nip47/error-handling.test.ts
```

## Related Code

- Implementation: `src/nip47`
- Examples: `examples/nip47`
- Documentation: `src/nip47/README.md`

## Contributing

When adding new features to NIP-47, please ensure:
1. Tests are added for the new functionality
2. Error handling follows the established patterns
3. Documentation is updated in both the code and README files 