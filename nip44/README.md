# NIP-44 Implementation

This directory contains the resources for the NIP-44 encryption implementation:

- **vectors/** - Test vectors for NIP-44 implementation and testing
  - `nip44-official-vectors.json` - Test vectors from the official NIP-44 spec
  - `nip44.vectors.json` - Additional test vectors

## About NIP-44

[NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md) is a Nostr Implementation Possibility that defines a new encryption scheme for direct messages. It replaces NIP-04 with a more secure approach using ChaCha20 + HMAC-SHA256.

Key features:
- Better security properties with authenticated encryption
- Protection against tampering via HMAC-SHA256 authentication
- Future-proof design with a version byte for upgradability
- Proper key derivation using HKDF
- Message length hiding via a custom padding scheme
- Secure nonce handling with 32-byte nonces

## Implementation

The implementation of NIP-44 is located in `src/nip44/index.ts`. It follows the NIP-44 v2 specification exactly, with proper error handling and security considerations.

## Testing

Test files for NIP-44 are located in `tests/nip44/`. The tests include:

- Verification against official test vectors
- Comprehensive edge case testing
- Padding scheme validation
- HMAC authentication tests
- Error handling validation

Run the tests with:

```bash
npm test tests/nip44
```

## Examples

Example usage of NIP-44 encryption can be found in:

- `examples/nip44/` - TypeScript examples
- `examples/javascript/nip44-demo.js` - JavaScript example using the compiled code

Run the JavaScript example with:

```bash
node examples/javascript/nip44-demo.js
```

## Documentation

Full documentation for the NIP-44 implementation is available in `docs/nip44/README.md`. 