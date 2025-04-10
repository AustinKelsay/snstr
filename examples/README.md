# SNSTR Examples

This directory contains example code demonstrating how to use the SNSTR library for various Nostr features and NIPs.

## Running Examples

All examples can be run using npm scripts. Here's how to use them:

```bash
# Basic usage examples
npm run example                # Basic usage with ephemeral relay
npm run example:verbose        # Basic usage with verbose logging
npm run example:debug          # Basic usage with debug logging

# Crypto examples
npm run example:crypto         # Cryptography examples

# Direct message examples
npm run example:dm             # Direct message example
npm run example:dm:verbose     # Direct message with verbose logging
npm run example:dm:public      # Direct message using public relays

# NIP-specific examples
npm run example:nip04          # NIP-04 (Encrypted Direct Messages)
npm run example:nip05          # NIP-05 (DNS Identifier Verification)
npm run example:nip44          # NIP-44 (Encrypted Direct Messages with ChaCha20)
```

## NIP-19 Examples

For NIP-19 (Bech32-encoded entities), we have several examples demonstrating different aspects:

```bash
npm run example:nip19          # Main NIP-19 example with all features
npm run example:nip19:verbose  # Verbose logging for main example
npm run example:nip19:bech32   # Basic Bech32 entities (npub, nsec, note)
npm run example:nip19:tlv      # TLV entities (nprofile, nevent, naddr)
npm run example:nip19:validation # Validation and error handling
```

See the [NIP-19 README](./nip19/README.md) for more details on the Bech32 encoding examples.

## NIP-46 Examples

For NIP-46 (Nostr Connect/Remote Signing), we have several examples demonstrating different aspects:

```bash
npm run example:nip46          # Main NIP-46 example (recommended)
npm run example:nip46:minimal  # Minimal implementation
npm run example:nip46:basic    # Basic implementation with error handling
npm run example:nip46:advanced # Advanced implementation with auth challenges
npm run example:nip46:from-scratch # Implementation without library classes
```

See the [NIP-46 README](./nip46/README.md) for more details on the remote signing examples.

## Directory Structure

- `basic-usage.ts` - Core functionality demo
- `crypto-demo.ts` - Cryptography examples
- `direct-message.ts` - Direct messaging example
- `nip04/` - NIP-04 (Encrypted Direct Messages) examples
- `nip05/` - NIP-05 (DNS Identifier Verification) examples 
- `nip07/` - NIP-07 (Web Browser Extension) examples
- `nip19/` - NIP-19 (Bech32-encoded entities) examples
- `nip44/` - NIP-44 (Encrypted Direct Messages with ChaCha20) examples
- `nip46/` - NIP-46 (Nostr Connect/Remote Signing) examples
- `nip47/` - NIP-47 (Nostr Wallet Connect) examples
- `nip57/` - NIP-57 (Lightning Zaps) examples
- `javascript/` - JavaScript examples for non-TypeScript environments

## Building Examples

If you want to compile the examples to JavaScript:

```bash
npm run build:examples
```

This will compile all examples to the `dist-examples` directory. 