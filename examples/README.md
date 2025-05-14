# SNSTR Examples

This directory contains example code demonstrating how to use the SNSTR library for various Nostr features and NIPs.

## Running Examples

All examples can be run using npm scripts. Here's how to use them:

```bash
# Basic usage examples
npm run example                # Basic usage with ephemeral relay
npm run example:verbose        # Basic usage with verbose logging
npm run example:debug          # Basic usage with debug logging

# Connection management examples
npm run example:relay-connection # Relay connection with timeout handling

# Crypto examples
npm run example:crypto         # Cryptography examples

# Direct message examples
npm run example:dm             # NIP-04 direct message example
npm run example:dm:verbose     # NIP-04 direct message with verbose logging
npm run example:dm:public      # NIP-04 direct message using public relays

# Addressable events (kinds 30000-39999)
npm run example:addressable         # Addressable events example
npm run example:addressable:verbose # Addressable events with verbose logging
npm run example:addressable:public  # Addressable events using public relays

# Replaceable events (kinds 0, 3, 10000-19999)
npm run example:replaceable         # Replaceable events example
npm run example:replaceable:verbose # Replaceable events with verbose logging
npm run example:replaceable:public  # Replaceable events using public relays

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
npm run example:nip19:security # Security features like relay URL validation and TLV entry limits
npm run example:nip19:demo     # Interactive demo with various encoding/decoding operations
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
- `/client` - Client-related examples
  - `relay-connection.ts` - Connection management with error handling
  - `event-ordering-demo.ts` - Event ordering demonstration
  - `filter-types.ts` - Filter type examples
  - `addressable-events.ts` - Addressable events (kinds 30000-39999)
  - `replaceable-events.ts` - Replaceable events (kinds 0, 3, 10000-19999)
  - `validation-flow.ts` - NIP-01 validation flow
  - `relay-reconnect.ts` - Relay reconnection with exponential backoff
- `/nip04` - NIP-04 (Encrypted Direct Messages) examples
  - `direct-message.ts` - Direct messaging example
- `/nip05` - NIP-05 (DNS Identifier Verification) examples 
- `/nip07` - NIP-07 (Web Browser Extension) examples
- `/nip11` - NIP-11 (Relay Information Document) examples
- `/nip19` - NIP-19 (Bech32-encoded entities) examples
  - `nip19-demo.ts` - Comprehensive overview of all NIP-19 functionality
  - `bech32-example.ts` - Basic Bech32 encoding/decoding (npub, nsec, note)
  - `tlv-example.ts` - TLV entity encoding/decoding (nprofile, nevent, naddr)
  - `validation-example.ts` - Validation and error handling for NIP-19 entities
  - `nip19-security.ts` - Security features like relay URL validation and TLV entry limits
- `/nip44` - NIP-44 (Encrypted Direct Messages with ChaCha20) examples
  - `nip44-demo.ts` - TypeScript implementation of NIP-44 encryption
  - `nip44-demo.js` - JavaScript implementation of NIP-44 encryption
  - `nip44-version-compatibility.ts` - Demonstrates versioned encryption compatibility
  - `nip44-test-vector.ts` - Test vectors for NIP-44 encryption
- `/nip46` - NIP-46 (Nostr Connect/Remote Signing) examples
- `/nip47` - NIP-47 (Nostr Wallet Connect) examples
- `/nip57` - NIP-57 (Lightning Zaps) examples

## Building Examples

If you want to compile the examples to JavaScript:

```bash
npm run build:examples
```

This will compile all examples to the `dist-examples` directory. 

## Client Examples

### Relay Management
- **[Relay Reconnection](./client/relay-reconnect.ts)**: Demonstrates how to configure and use automatic reconnection with exponential backoff when connections to relays are interrupted.

### NIP-01 Implementation
- **[Validation Flow](./client/validation-flow.ts)**: Shows the complete validation pipeline for events, including cryptographic validation.
- **[Addressable Events](./client/addressable-events.ts)**: Demonstrates how to work with addressable events (kinds 30000-39999).
- **[Replaceable Events](./client/replaceable-events.ts)**: Shows how to publish and update replaceable events (kinds 0, 3, 10000-19999).

### Event Handling
- **[Event Ordering](./client/event-ordering-demo.ts)**: Demonstrates how events are ordered according to NIP-01 specifications.
- **[Filter Types](./client/filter-types.ts)**: Shows different filter types and how to use them effectively.