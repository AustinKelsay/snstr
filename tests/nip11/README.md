# NIP-11 Tests

This directory contains tests for the NIP-11 implementation, which covers relay information documents and capability discovery.

## Components Tested

- ✅ **Relay Information Fetching**: Tests for fetching relay information documents.
- ✅ **Capability Discovery**: Tests for discovering relay capabilities and limitations.
- ✅ **Information Parsing**: Tests for parsing the relay information JSON document.
- ✅ **NIP Support Detection**: Tests for determining which NIPs a relay supports.
- ✅ **Fee Information**: Tests for handling relay fee information.
- ✅ **Rate Limit Information**: Tests for processing rate limit data.
- ✅ **Error Handling**: Tests for invalid responses and network failures.

## Running the Tests

```bash
# Run all NIP-11 tests
npm run test:nip11
```

## Test Files

- `nip11.test.ts`: Tests for NIP-11 implementation, covering relay information document fetching and parsing.

## Test Coverage

The tests in this directory ensure that all aspects of the NIP-11 protocol are correctly implemented, including:

1. Making proper HTTP requests with appropriate headers
2. Parsing JSON responses according to the NIP-11 spec
3. Extracting supported NIPs from the relay information
4. Handling relay contact information
5. Processing software and version information
6. Managing fee schedules and payment information
7. Interpreting rate limiting policies
8. Error handling for network failures or invalid responses
9. Caching of relay information with appropriate expiration

NIP-11 is an important utility NIP that allows clients to discover relay capabilities before connecting, which helps optimize relay selection and provides users with important information about relay policies. 