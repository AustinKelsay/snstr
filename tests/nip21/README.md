# NIP-21 Tests

This directory contains tests for the NIP-21 URI scheme implementation.

## Components Tested

- ✅ `encodeNostrURI` – building URIs from NIP‑19 strings
- ✅ `decodeNostrURI` – parsing URIs back to decoded entities

## Running the Tests

```bash
npm run test:nip21
```

## Test Files

- `nip21.test.ts`: Unit tests for encoding and decoding `nostr:` URIs.
