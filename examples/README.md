# SNSTR Examples

This directory contains example code demonstrating how to use the SNSTR library for various Nostr features and NIPs.

## Running Examples

All examples can be run using npm scripts. Here's how to use them:

**Note**: The custom WebSocket example requires installing the `ws` package first:
```bash
npm install ws @types/ws
```

````bash
# Basic usage examples
npm run example                # Basic usage with an ephemeral relay
npm run example:rate-limits    # Rate limit configuration walkthrough
npm run example:verbose        # Basic usage with verbose logging
npm run example:debug          # Basic usage with debug logging
npm run example:custom-websocket # Use a custom WebSocket implementation (requires 'ws' package)
npm run example:crypto         # Cryptography examples (key generation, signing, verification)
npm run example:dm             # NIP-04 direct message example

# Aggregated runners
npm run example:all            # Alias for the base example
npm run example:basic          # Run base, crypto, and DM examples
npm run example:nip01          # Curated bundle of NIP-01 demos
npm run example:messaging      # Messaging demos (DM, NIP-04, NIP-44, NIP-17)
npm run example:identity       # Identity demos (NIP-05, NIP-07, NIP-19)
npm run example:payments       # Wallet/zap demos (NIP-47, NIP-57)
npm run example:advanced       # Advanced protocol demos (NIP-46 + extras)
npm run example:validation     # Validation-focused helper flows

# NIP-01 examples
npm run example:nip01:event:ordering       # Event ordering demonstration
npm run example:nip01:event:addressable    # Addressable events (kinds 30000-39999)
npm run example:nip01:event:replaceable    # Replaceable events (kinds 0, 3, 10000-19999)
npm run example:nip01:relay:connection     # Relay connection with timeout handling
npm run example:nip01:relay:filters        # Filter type examples
npm run example:nip01:relay:auto-close     # Subscription auto-unsubscribe example
npm run example:nip01:relay:query          # Pooled fetchOne/fetchMany demo
npm run example:nip01:relay:reconnect      # Relay reconnection with exponential backoff
npm run example:nip01:relay:pool           # RelayPool multi-relay demo
npm run example:nip01:relay:pool-url-normalization # RelayPool URL normalization helpers
npm run example:nip01:url-preprocessing    # Relay URL preprocessing utilities
npm run example:nip01:validation           # NIP-01 validation flow

# NIP-02 Examples (Contact Lists)
npm run example:nip02                      # Fetching follows and followers
npm run example:nip02:pubkey-normalization # Pubkey normalization helpers

# Browser / NIP-07 Examples
npm run example:nip07          # Starts HTTP server for browser demos
npm run example:nip07:build    # Build browser bundles without starting the server
npm run example:nip07:dm       # Browser-hosted DM example

# Other NIP-specific examples
npm run example:nip04          # NIP-04 (Encrypted Direct Messages)
npm run example:nip05          # NIP-05 (DNS Identifier Verification)
npm run example:nip09          # NIP-09 deletion request example
npm run example:nip10          # NIP-10 threading and reply management
npm run example:nip11          # NIP-11 (Relay Information Document)
npm run example:nip17          # NIP-17 gift wrapped messaging
npm run example:nip44          # NIP-44 (Encrypted Direct Messages with ChaCha20)
npm run example:nip44:js       # NIP-44 JavaScript implementation
npm run example:nip44:version-compat # NIP-44 version compatibility
npm run example:nip44:test-vector    # NIP-44 test vectors
npm run example:nip44:compliance     # NIP-44 compliance/regression demo
npm run example:nip46          # NIP-46 remote signing (main example)
npm run example:nip46:minimal  # Minimal implementation
npm run example:nip46:basic    # Basic implementation with error handling
npm run example:nip46:advanced # Advanced implementation with auth challenges
npm run example:nip46:from-scratch # Implementation without library classes
npm run example:nip46:simple   # Simple example
npm run example:nip46:simple-client # Simple client test
npm run example:nip46:test-all # Run every NIP-46 example sequentially
npm run example:nip46:connection-string-validation # Validate connection URIs
npm run example:nip47          # Basic NIP-47 example
npm run example:nip47:verbose  # Verbose logging for basic example
npm run example:nip47:client-service # Client-service example
npm run example:nip47:error-handling # Error handling example
npm run example:nip47:expiration # Request expiration example
npm run example:nip47:nip44    # NIP-44 encrypted payload flow
npm run example:nip47:encryption-negotiation # Custom encryption negotiation
npm run example:nip47:nip44    # NIP-44 encrypted payload flow
npm run example:nip47:encryption-negotiation # Custom encryption negotiation
npm run example:nip50          # NIP-50 search capability
npm run example:nip57          # Basic NIP-57 example
npm run example:nip57:client   # Zap client example
npm run example:nip57:lnurl    # LNURL server simulation
npm run example:nip57:validation # Invoice validation example
npm run example:nip65          # Relay list metadata demo
npm run example:nip66          # Relay discovery and monitoring demo
````
## NIP-19 Examples

For [NIP-19](https://github.com/nostr-protocol/nips/blob/master/19.md) (Bech32-encoded entities), we have several examples demonstrating different aspects:

```bash
npm run example:nip19          # Main NIP-19 example with all features
npm run example:nip19:bech32   # Basic Bech32 entities (npub, nsec, note)
npm run example:nip19:tlv      # TLV entities (nprofile, nevent, naddr)
npm run example:nip19:validation # Validation and error handling
npm run example:nip19:security # Security features like relay URL validation and TLV entry limits
npm run example:nip19:security-example # Advanced security scenarios and mitigations
npm run example:nip19:demo     # Interactive demo with various encoding/decoding operations

### NIP-10: Text Notes and Threads

```bash
npm run example:nip10          # Threading and reply management
```

### NIP-21: URI Scheme

```bash
npm run example:nip21          # URI scheme for nostr entities
```
````

## NIP-07 Examples

For [NIP-07](https://github.com/nostr-protocol/nips/blob/master/07.md) (Browser Extension Provider), we have browser-based examples:

```bash
npm run example:nip07          # Starts a local HTTP server for NIP-07 examples
npm run example:nip07:build    # Builds browser bundles without starting the server
npm run example:nip07:dm       # Runs the browser-based DM example
```

**Important**: Browser extensions cannot access local files loaded via the `file://` protocol. The example script automatically starts an HTTP server to properly test NIP-07 functionality.

## NIP-46 Examples

For [NIP-46](https://github.com/nostr-protocol/nips/blob/master/46.md) (Nostr Connect/Remote Signing), we have several examples demonstrating different aspects:

```bash
npm run example:nip46          # Main NIP-46 example (recommended)
npm run example:nip46:minimal  # Minimal implementation
npm run example:nip46:basic    # Basic implementation with error handling
npm run example:nip46:advanced # Advanced implementation with auth challenges
npm run example:nip46:from-scratch # Implementation without library classes
npm run example:nip46:simple   # Simple example
npm run example:nip46:simple-client # Simple client test
npm run example:nip46:test-all # Run every NIP-46 example sequentially
npm run example:nip46:connection-string-validation # Validate connection URIs
```

## NIP-47 Examples

For [NIP-47](https://github.com/nostr-protocol/nips/blob/master/47.md) (Nostr Wallet Connect), we have several examples:

```bash
npm run example:nip47          # Basic NIP-47 example
npm run example:nip47:verbose  # Verbose logging for basic example
npm run example:nip47:client-service # Client-service example
npm run example:nip47:error-handling # Error handling example
npm run example:nip47:expiration # Request expiration example
npm run example:nip47:nip44    # NIP-44 encrypted payload flow
npm run example:nip47:encryption-negotiation # Custom encryption negotiation
```

## NIP-50 Examples

For [NIP-50](https://github.com/nostr-protocol/nips/blob/master/50.md) (Search capability):

```bash
npm run example:nip50          # Basic search filter example
```

## NIP-57 Examples

For [NIP-57](https://github.com/nostr-protocol/nips/blob/master/57.md) (Lightning Zaps), we have several examples:

```bash
npm run example:nip57          # Basic NIP-57 example
npm run example:nip57:client   # Zap client example
npm run example:nip57:lnurl    # LNURL server simulation
npm run example:nip57:validation # Invoice validation example
```

## NIP-65 Examples

For [NIP-65](https://github.com/nostr-protocol/nips/blob/master/65.md) (Relay List Metadata):

```bash
npm run example:nip65          # Relay list metadata demo
```

## NIP-66 Examples

For [NIP-66](https://github.com/nostr-protocol/nips/blob/master/66.md) (Relay Discovery and Liveness Monitoring):

```bash
npm run example:nip66          # Relay discovery and monitoring demo
```

## Example Categories

You can also run example groups:

```bash
npm run example:all           # Run basic example
npm run example:basic         # Run example, crypto, and dm examples
npm run example:nip01         # Run a curated bundle of NIP-01 demos
npm run example:messaging     # Run dm, nip04, nip44 and nip17 examples
npm run example:identity      # Run nip05, nip07, and nip19 examples
npm run example:payments      # Run nip47 and nip57 examples
npm run example:advanced      # Run nip46 and nip47:error-handling examples
npm run example:validation    # Run validation-focused helper flows
```

## Directory Structure

- `basic-usage.ts` - Core functionality demo including event creation, signing, and relay publishing
- `crypto-demo.ts` - Cryptography examples including key pair generation, signing, and verification
- `rate-limit-configuration-example.ts` - Configure and monitor built-in rate limits
- `/nip01` - [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md) (Core Protocol) examples
  - `/event` - Event-related examples
    - `event-ordering-demo.ts` - Event ordering demonstration with timestamp and lexicographic ordering
    - `addressable-events.ts` - Addressable events (kinds 30000-39999) with semantic content addressing
    - `replaceable-events.ts` - Replaceable events (kinds 0, 3, 10000-19999) with update mechanisms
  - `/relay` - Relay-related examples
    - `relay-connection-example.ts` - Connection management with error handling and timeout configuration
    - `relay-reconnect.ts` - Relay reconnection with exponential backoff strategies
    - `relay-pool.ts` - Manage multiple relays with RelayPool
    - `relay-pool-url-normalization-example.ts` - Normalize relay URLs before connecting
    - `filter-types.ts` - Filter type examples for event retrieval optimization
    - `auto-unsubscribe-example.ts` - Demonstrates automatic subscription cleanup
  - `url-preprocessing-example.ts` - Relay URL preprocessing utilities for clients
- `/client` - Client-related examples
  - `validation-flow.ts` - NIP-01 validation flow for event verification
- `/nip02` - [NIP-02](https://github.com/nostr-protocol/nips/blob/master/02.md) (Contact Lists) examples
  - `nip02-demo.ts` - Fetching a user's follows and followers list
  - `pubkey-normalization-example.ts` - Normalize contact list pubkeys safely
- `/nip04` - [NIP-04](https://github.com/nostr-protocol/nips/blob/master/04.md) (Encrypted Direct Messages) examples
  - `direct-message.ts` - Direct messaging example with shared secret encryption
- `/nip05` - [NIP-05](https://github.com/nostr-protocol/nips/blob/master/05.md) (DNS Identifier Verification) examples
- `/nip09` - [NIP-09](https://github.com/nostr-protocol/nips/blob/master/09.md) (Event Deletion Requests) examples
- `/nip07` - [NIP-07](https://github.com/nostr-protocol/nips/blob/master/07.md) (Web Browser Extension) examples
  - `browser.ts` - Browser extension example for text notes and subscriptions
  - `direct-message.ts` - Direct message example using extension encryption features
  - `index.html` - Browser interface for the basic example
  - `direct-message.html` - Browser interface for direct messaging
  - `README.md` - Specific documentation for NIP-07 examples
- `/nip11` - [NIP-11](https://github.com/nostr-protocol/nips/blob/master/11.md) (Relay Information Document) examples
  - `relay-info-example.ts` - Relay information example for metadata and capabilities
- `/nip19` - [NIP-19](https://github.com/nostr-protocol/nips/blob/master/19.md) (Bech32-encoded entities) examples
  - `nip19-demo.ts` - Comprehensive overview of all NIP-19 functionality
  - `bech32-example.ts` - Basic Bech32 encoding/decoding (npub, nsec, note)
  - `tlv-example.ts` - TLV entity encoding/decoding (nprofile, nevent, naddr)
  - `validation-example.ts` - Validation and error handling for NIP-19 entities
  - `nip19-security.ts` - Security features like relay URL validation and TLV entry limits
  - `security-example.ts` - Advanced security scenarios and mitigations
- `/nip44` - [NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md) (Encrypted Direct Messages with ChaCha20) examples
  - `nip44-demo.ts` - TypeScript implementation of NIP-44 encryption
  - `nip44-demo.js` - JavaScript implementation of NIP-44 encryption
  - `nip44-version-compatibility.ts` - Demonstrates versioned encryption compatibility
  - `nip44-test-vector.ts` - Test vectors for NIP-44 encryption
  - `nip44-compliance-demo.ts` - Compliance and regression-focused flows
- `/nip17` - [NIP-17](https://github.com/nostr-protocol/nips/blob/master/17.md) (Gift wrapped direct messages)
  - `nip17-demo.ts` - Create and decrypt a gift wrapped message
- `/nip46` - [NIP-46](https://github.com/nostr-protocol/nips/blob/master/46.md) (Nostr Connect/Remote Signing) examples
  - `unified-example.ts` - Main example with complete implementation
  - `minimal.ts` - Minimal implementation for basic use cases
  - `basic-example.ts` - Basic implementation with error handling
  - `advanced/` - Advanced implementations with auth challenges
  - `from-scratch/` - Implementation without library classes
  - `simple/` - Simple example implementations
  - `test-all-examples.ts` - Runner that executes every NIP-46 example
  - `connection-string-validation-example.ts` - Validate NIP-46 connection URIs
- `/nip47` - [NIP-47](https://github.com/nostr-protocol/nips/blob/master/47.md) (Nostr Wallet Connect) examples
  - `basic-example.ts` - Basic example with payment request flow
  - `basic-client-service.ts` - Client-service example with request/response
  - `error-handling-example.ts` - Error handling example with failure cases
  - `request-expiration-example.ts` - Request expiration example with timeout handling
  - `nip44-encryption.ts` - Demonstrates encrypting payloads via NIP-44
  - `encryption-negotiation.ts` - Shows custom encryption negotiation flows
- `/nip57` - [NIP-57](https://github.com/nostr-protocol/nips/blob/master/57.md) (Lightning Zaps) examples
  - `basic-example.ts` - Basic example with zap flow
  - `zap-client-example.ts` - Zap client example for sending zaps
  - `lnurl-server-simulation.ts` - LNURL server simulation for zap endpoints
  - `invoice-validation-example.ts` - Invoice validation example for zap verification
- `/nip50` - [NIP-50](https://github.com/nostr-protocol/nips/blob/master/50.md) (Search capability)
  - `search-demo.ts` - Basic search filter usage
- `/nip66` - [NIP-66](https://github.com/nostr-protocol/nips/blob/master/66.md) (Relay Discovery and Liveness Monitoring)
  - `nip66-demo.ts` - Relay discovery and monitoring demo
  - `README.md` - Documentation for NIP-66 examples

## Building Examples

If you want to compile the examples to JavaScript:

```bash
npm run build:examples
```

This will compile all examples to the `dist-examples` directory.
