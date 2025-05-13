# SNSTR - Simple Nostr Software Toolkit for Retards
### Still Under Construction 🚧

SNSTR is a lightweight TypeScript library for interacting with the Nostr protocol. It provides a simple, easy-to-use API with minimal dependencies.

## Table of Contents

- [Features](#features)
- [Supported NIPs](#supported-nips)
- [Installation](#installation)
- [API Reference](#api-reference)
  - [Core Classes](#core-classes)
  - [Cryptographic Functions](#cryptographic-functions)
  - [Nostr Client Methods](#nostr-client-methods)
  - [Relay Methods](#relay-methods)
  - [Event Utilities](#event-utilities)
  - [Ephemeral Relay](#ephemeral-relay)
  - [NIP-04: Encrypted Direct Messages](#nip-04-encrypted-direct-messages-aes-cbc)
  - [NIP-44: Versioned Encryption](#nip-44-versioned-encryption-chacha20--hmac)
  - [NIP-19: Bech32-Encoded Entities](#nip-19-bech32-encoded-entities)
  - [NIP-05: DNS Identifiers](#nip-05-dns-identifiers)
  - [NIP-07: Browser Extensions](#nip-07-browser-extensions)
  - [NIP-11: Relay Information Document](#nip-11-relay-information-document)
  - [NIP-46: Remote Signing Protocol](#nip-46-remote-signing-protocol)
  - [NIP-57: Lightning Zaps](#nip-57-lightning-zaps)
  - [NIP-47: Nostr Wallet Connect](#nip-47-nostr-wallet-connect)
- [Basic Usage](#basic-usage)
- [Using the Ephemeral Relay](#using-the-ephemeral-relay)
- [Direct Messaging Example](#direct-messaging-example)
- [NIP-05 Identity Verification](#nip-05-identity-verification)
- [Encryption with NIP-44](#encryption-with-nip-44)
- [Browser Extensions (NIP-07)](#browser-extensions-nip-07)
- [Relay Information with NIP-11](#relay-information-with-nip-11)
- [Relay Connection Management](#relay-connection-management)
- [Using Public Relays vs Ephemeral Relay](#using-public-relays-vs-ephemeral-relay)
- [Testing](#testing)
- [Development](#development)
- [Encryption Support](#encryption-support)
- [Remote Signing with NIP-46](#remote-signing-with-nip-46)
- [Nostr Wallet Connect with NIP-47](#nip-47-nostr-wallet-connect)
- [Code Standardization](#code-standardization)
- [Examples](#examples)

## Features

### Core Functionality
- Event creation and signing
- Message encryption/decryption (NIP-04 and NIP-44)
- Relay connections with automatic reconnect
- Filter-based subscriptions
- NIP-01 compliant event validation and verification
  - Full cryptographic validation before event acceptance
  - Complete NIP-01 §7 compliance for event validation
  - Protection against malformed and falsely-signed events
- Support for replaceable events (kinds 0, 3, 10000-19999)
- Support for addressable events (kinds 30000-39999)

### Advanced Features
- NIP-01: Basic protocol
- NIP-04: Encrypted Direct Messages
- NIP-05: Mapping Nostr keys to DNS-based internet identifiers
- NIP-07: Web browser extension
- NIP-11: Relay Information Document
- NIP-19: bech32-encoded entities
- NIP-44: Versioned Encryption
- NIP-46: Remote Signing Protocol (Nostr Connect)
- NIP-57: Lightning Zaps
- NIP-47: Nostr Wallet Connect

## Supported NIPs

SNSTR currently implements the following Nostr Implementation Possibilities (NIPs):

- NIP-01: Basic protocol functionality (events, subscriptions, relay connections) with comprehensive event validation
  - Replaceable events: Support for events where only the latest one per pubkey+kind is stored
  - Addressable events: Support for events uniquely identified by pubkey+kind+d-tag
- NIP-04: Encrypted direct messages using AES-CBC
- NIP-05: DNS identifier verification and relay discovery
- NIP-11: Relay Information Document for discovering relay metadata and capabilities
- NIP-44: Improved encryption with ChaCha20 and HMAC-SHA256 authentication
- NIP-07: Browser extension integration for key management and signing
- NIP-46: Remote signing (bunker) support for secure key management
- NIP-57: Lightning Zaps protocol for integrating Bitcoin payments via the Lightning Network
- NIP-47: Nostr Wallet Connect for secure wallet communication

## Installation

coming soon

## API Reference

### Core Classes

```typescript
// Main client for interacting with Nostr
import { Nostr } from 'snstr';

// Individual relay connection management
import { Relay } from 'snstr';
```

### Cryptographic Functions

```typescript
// Key generation and management
import { 
  generateKeypair,
  getPublicKey, 
  signEvent, 
  verifySignature 
} from 'snstr';

// Create Nostr events
import { createEvent } from 'snstr';
```

### NIP-04: Encrypted Direct Messages (AES-CBC)

```typescript
import { 
  encryptNIP04,
  decryptNIP04,
  getNIP04SharedSecret 
} from 'snstr';
```

Our NIP-04 implementation uses HMAC-SHA256 with the key "nip04" for shared secret derivation, ensuring compatibility with nip04 spec compliant libraries and nostr clients while providing robust validation and error handling.

### NIP-44: Versioned Encryption (ChaCha20 + HMAC)

```typescript
import { 
  encryptNIP44, 
  decryptNIP44, 
  generateNIP44Nonce,
  getNIP44SharedSecret 
} from 'snstr';
```

### NIP-19: Bech32-Encoded Entities

```typescript
import {
  // Core encoding/decoding
  encodeBech32,
  decodeBech32,
  decode,
  
  // Public keys (npub)
  encodePublicKey,
  decodePublicKey,
  
  // Private keys (nsec)
  encodePrivateKey,
  decodePrivateKey,
  
  // Note IDs (note)
  encodeNoteId,
  decodeNoteId,
  
  // Profiles (nprofile)
  encodeProfile,
  decodeProfile,
  
  // Events (nevent)
  encodeEvent,
  decodeEvent,
  
  // Addresses (naddr)
  encodeAddress,
  decodeAddress,
  
  // Enums and types
  Prefix,
  TLVType
} from 'snstr';
```

SNSTR's NIP-19 implementation includes robust security features:

- **Strict Relay URL Validation**: Prevents XSS and injection attacks by validating all relay URLs during encoding
- **TLV Entry Limits**: Enforces limits on the number of TLV entries (max 20) to prevent DoS attacks
- **Size Constraints**: Enforces reasonable size limits for relay URLs (512 chars) and identifiers (1024 chars)
- **Robust Error Handling**: Provides clear error messages for debugging and security

⚠️ **Security Note**: When decoding profiles, be aware that `decodeProfile()` only warns about invalid URLs but still includes them in the decoded result. Always filter invalid relay URLs after decoding:

```typescript
// Example of filtering invalid URLs after decoding
function filterInvalidRelays(profile) {
  if (!profile.relays || profile.relays.length === 0) return profile;
  
  function isValidRelayUrl(url) {
    try {
      if (!url.startsWith('wss://') && !url.startsWith('ws://')) return false;
      const parsedUrl = new URL(url);
      if (parsedUrl.username || parsedUrl.password) return false;
      return true;
    } catch (error) {
      return false;
    }
  }
  
  return {
    ...profile,
    relays: profile.relays.filter(url => isValidRelayUrl(url))
  };
}

// Usage
const decodedProfile = decodeProfile(nprofileString);
const safeProfile = filterInvalidRelays(decodedProfile);
```

All entities are validated during encoding while maintaining the permissive decoding approach required by the NIP-19 specification.

## NIP-19 Security

Recent security improvements to the NIP-19 implementation include:

- **Reduced MAX_TLV_ENTRIES**: Limited to 20 entries (down from 100) to prevent denial of service attacks
- **Relay URL validation**: Strict validation of relay URLs during encoding to prevent XSS and other injection attacks
- **Size limits enforcement**: Maximum relay URL length (512 chars) and identifier length (1024 chars)

⚠️ **Important Security Note**: When decoding profiles, events, or addresses, you MUST filter invalid relay URLs after decoding to prevent security issues. The decoder follows the NIP-19 specification by accepting invalid URLs while warning about them.

```typescript
// Example safe usage pattern for decoding NIP-19 entities with relays
import { decodeProfile } from 'snstr';

// Decode the nprofile
const profile = decodeProfile(nprofileString);

// Filter invalid relay URLs before using
function filterInvalidRelays(data) {
  if (!data.relays || data.relays.length === 0) return data;
  
  function isValidRelayUrl(url) {
    try {
      if (!url.startsWith('wss://') && !url.startsWith('ws://')) return false;
      const parsedUrl = new URL(url);
      if (parsedUrl.username || parsedUrl.password) return false;
      return true;
    } catch (error) {
      return false;
    }
  }
  
  return { ...data, relays: data.relays.filter(isValidRelayUrl) };
}

// Apply the filtering to get a safe profile
const safeProfile = filterInvalidRelays(profile);
```

See the [NIP-19 README](src/nip19/README.md) for detailed information and more examples of secure usage.

### NIP-05: DNS Identifiers

```typescript
import {
  verifyNIP05,
  lookupNIP05,
  getNIP05PubKey,
  getNIP05Relays
} from 'snstr';
```

### NIP-07: Browser Extensions

```typescript
import {
  // NIP-07 browser extension wrapper
  Nip07Nostr,
  
  // Utility functions
  hasNip07Support,
  getNip07PublicKey,
  signEventWithNip07,
  encryptNip04WithExtension,
  decryptNip04WithExtension,
  encryptNip44WithExtension,
  decryptNip44WithExtension
} from 'snstr';
```

### NIP-11: Relay Information Document

```typescript
import {
  // Relay information fetching
  fetchRelayInformation,
  
  // Helper functions
  supportsNIP11,
  relaySupportsNIPs,
  getRelayPaymentInfo,
  relayRequiresPayment,
  
  // Types
  RelayInfo,
  RelayLimitation,
  RelayFees,
  FeeSchedule
} from 'snstr';
```

### NIP-46: Remote Signing Protocol

```typescript
import { 
  // Client for connecting to remote signers
  SimpleNIP46Client,
  NostrRemoteSignerClient,
  
  // Server-side bunker implementation
  SimpleNIP46Bunker,
  NostrRemoteSignerBunker,
  
  // Types
  NIP46Method,
  NIP46Request, 
  NIP46Response, 
  NIP46ClientOptions,
  NIP46BunkerOptions,
  NIP46Metadata,
  
  // Utilities
  generateKeypair,
  generateRequestId,
  createRequest,
  createSuccessResponse,
  createErrorResponse,
  Logger,
  LogLevel
} from 'snstr';
```

### NIP-57: Lightning Zaps

```typescript
import {
  // Core zap functions
  createZapRequest,
  createZapReceipt,
  validateZapReceipt,
  
  // Zap client for higher-level API
  NostrZapClient,
  ZapClient,
  
  // Zap split utilities
  parseZapSplit,
  calculateZapSplitAmounts,
  
  // Lightning utilities
  fetchLnurlPayMetadata,
  parseBolt11Invoice,
  getLightningAddressUrl,
  
  // Types
  ZapRequestOptions,
  ZapReceiptOptions,
  ZapValidationResult,
  ZapStats,
  LnurlPayResponse
} from 'snstr';
```

### NIP-47: Nostr Wallet Connect

```typescript
import { 
  NostrWalletConnectClient, 
  NostrWalletService 
} from 'snstr';
```

### Core Types

```typescript
import {
  // Event structure
  NostrEvent,
  EventTemplate,
  
  // Subscription and filters
  NostrFilter,
  Filter,
  Subscription,
  
  // Relay events
  RelayEvent,
  RelayEventHandler
} from 'snstr';
```

### Testing Utilities

```typescript
import { NostrRelay } from 'snstr/utils/ephemeral-relay';
```

### Nostr Client Methods

The main `Nostr` class provides the following methods:

```typescript
// Initialize client with relay URLs
const client = new Nostr(['wss://relay.example.com']);

// Initialize with relay options
const client = new Nostr(
  ['wss://relay.example.com', 'wss://relay.nostr.band'], 
  {
    relayOptions: {
      connectionTimeout: 5000 // 5 second connection timeout for all relays
    }
  }
);

// Relay management
client.addRelay(url: string): Relay
client.removeRelay(url: string): void
client.connectToRelays(): Promise<void>
client.disconnectFromRelays(): void

// Key management
client.setPrivateKey(privateKey: string): void
client.generateKeys(): Promise<{ privateKey: string; publicKey: string }>
client.getPublicKey(): string | undefined

// Event publishing
client.publishEvent(event: NostrEvent): Promise<NostrEvent | null>
client.publishTextNote(content: string, tags?: string[][]): Promise<NostrEvent | null>
client.publishDirectMessage(content: string, recipientPubkey: string, tags?: string[][]): Promise<NostrEvent | null>
client.publishMetadata(metadata: Record<string, any>): Promise<NostrEvent | null>

// Direct message decryption
client.decryptDirectMessage(event: NostrEvent): string

// Subscriptions
client.subscribe(
  filters: Filter[],
  onEvent: (event: NostrEvent, relay: string) => void,
  onEOSE?: () => void
): string[]
client.unsubscribe(subscriptionIds: string[]): void
client.unsubscribeAll(): void

// Event handling
client.on(event: RelayEvent, callback: (relay: string, ...args: any[]) => void): void
```

### Relay Methods

The `Relay` class provides the following methods for working with individual Nostr relays:

```typescript
// Initialize a relay connection
const relay = new Relay('wss://relay.example.com');

// Initialize with connection timeout (recommended)
const relay = new Relay('wss://relay.example.com', { 
  connectionTimeout: 5000 // 5 seconds
});

// Connection management
relay.connect(): Promise<boolean>
relay.disconnect(): void
relay.setConnectionTimeout(timeout: number): void
relay.getConnectionTimeout(): number

// Event handling
relay.on<T extends RelayEvent>(event: T, callback: RelayEventHandler[T]): void

// Publishing
relay.publish(event: NostrEvent, options?: { timeout?: number }): Promise<{ success: boolean; reason?: string }>

// Subscriptions
relay.subscribe(
  filters: Filter[],
  onEvent: (event: NostrEvent) => void,
  onEOSE?: () => void
): string
relay.unsubscribe(id: string): void
```

### Event Utilities

The library provides the following utilities for creating and manipulating Nostr events:

```typescript
// Event creation
import { 
  createEvent,
  createSignedEvent,
  createTextNote,
  createDirectMessage,
  createMetadataEvent,
  getEventHash
} from 'snstr';

// Create an unsigned event from a template
const unsignedEvent = createEvent(
  { kind: 1, content: 'Hello world', tags: [] },
  publicKey
);

// Create and sign an event 
const signedEvent = await createSignedEvent(unsignedEvent, privateKey);

// Create a text note (kind 1)
const textNote = createTextNote('Hello world', [['t', 'nostr']]);

// Create an encrypted direct message (kind 4)
const directMessage = createDirectMessage(
  'Hello, this is private',
  recipientPublicKey,
  myPrivateKey
);

// Create a metadata event (kind 0)
const metadataEvent = createMetadataEvent(
  { name: 'Alice', about: 'Nostr user', picture: 'https://example.com/pic.jpg' },
  privateKey
);

// Calculate the event hash (for verification)
const eventHash = await getEventHash(event);
```

### Ephemeral Relay

The library provides an in-memory relay implementation for testing and development:

```typescript
import { NostrRelay } from 'snstr/utils/ephemeral-relay';

// Create an ephemeral relay on port 3000
// Optional: purge events every 60 seconds
const relay = new NostrRelay(3000, 60);

// Start the relay server
await relay.start();

// Get the relay URL for clients to connect to
const relayUrl = relay.url; // 'ws://localhost:3000'

// Access cached events and subscriptions
const cachedEvents = relay.cache;
const activeSubscriptions = relay.subs;

// Register a callback for when the relay is connected
relay.onconnect(() => {
  console.log('Relay is listening for connections');
});

// Manually store an event in the relay
relay.store(signedEvent);

// Close the relay and clean up resources
await relay.close();
```

## Basic Usage

```typescript
import { Nostr, RelayEvent } from 'snstr';

async function main() {
  // Initialize with relays and connection timeout
  const client = new Nostr(
    ['wss://relay.primal.net', 'wss://relay.nostr.band'],
    { 
      relayOptions: { 
        connectionTimeout: 5000 // 5 second timeout
      } 
    }
  );

  // Generate keypair
  const keys = await client.generateKeys();
  console.log('Public key:', keys.publicKey);

  // Connect to relays with error handling
  try {
    await client.connectToRelays();
    console.log('Connected to relays');
  } catch (error) {
    console.error('Failed to connect to relays:', error);
    // Handle connection failure
    return;
  }
  
  // Set up event handlers
  client.on(RelayEvent.Connect, (relay) => {
    console.log(`Connected to ${relay}`);
  });
  
  client.on(RelayEvent.Disconnect, (relay) => {
    console.log(`Disconnected from ${relay}`);
  });
  
  client.on(RelayEvent.Error, (relay, error) => {
    console.error(`Error from ${relay}:`, error);
  });

  // Publish a note
  const note = await client.publishTextNote('Hello, Nostr!');
  console.log(`Published note with ID: ${note?.id}`);

  // Subscribe to events
  const subIds = client.subscribe(
    [{ kinds: [1], limit: 10 }], // Filter for text notes
    (event, relay) => {
      console.log(`Received event from ${relay}:`, event);
    }
  );

  // Cleanup
  setTimeout(() => {
    client.unsubscribe(subIds);
    client.disconnectFromRelays();
  }, 10000);
}

main().catch(console.error);
```

## Using the Ephemeral Relay

SNSTR includes a built-in ephemeral relay for testing and development that doesn't require external connections. All data remains in-memory and can be automatically purged at regular intervals.

```typescript
import { Nostr } from 'snstr';
import { NostrRelay } from 'snstr/utils/ephemeral-relay';

async function main() {
  // Start an ephemeral relay on port 3000
  const relay = new NostrRelay(3000, 60); // Purge events every 60 seconds
  await relay.start();
  
  // Connect to the ephemeral relay using its url property
  const client = new Nostr([relay.url]);
  await client.generateKeys();
  await client.connectToRelays();
  
  // Use the client as normal
  const note = await client.publishTextNote('Hello, ephemeral world!');
  
  // Clean up
  setTimeout(() => {
    client.disconnectFromRelays();
    relay.close();
  }, 5000);
}

main().catch(console.error);
```

### Debugging and Verbosity

The ephemeral relay supports different logging levels:

```typescript
// Enable verbose logging
process.env.VERBOSE = 'true';

// For even more detailed debug output
process.env.DEBUG = 'true';

// Or use the provided npm scripts
// npm run example:ephemeral     - Run with verbose logging
// npm run example:debug         - Run with debug logging
```

## Direct Messaging Example

```typescript
import { Nostr } from 'snstr';
import { NostrRelay } from 'snstr/utils/ephemeral-relay';

async function main() {
  // Start an ephemeral relay
  const relay = new NostrRelay(3001, 60);
  await relay.start();
  
  // Create two clients (Alice and Bob)
  const alice = new Nostr([relay.url]);
  const bob = new Nostr([relay.url]);
  
  // Generate keys for both
  const aliceKeys = await alice.generateKeys();
  const bobKeys = await bob.generateKeys();
  
  // Connect both to the relay
  await Promise.all([
    alice.connectToRelays(),
    bob.connectToRelays()
  ]);
  
  // Bob subscribes to receive messages
  bob.subscribe(
    [{ kinds: [4], '#p': [bobKeys.publicKey] }],
    (event) => {
      try {
        // Decrypt incoming messages
        const decrypted = bob.decryptDirectMessage(event);
        console.log(`Bob received: ${decrypted}`);
      } catch (error) {
        console.error('Failed to decrypt message');
      }
    }
  );
  
  // Alice sends an encrypted message to Bob
  const dmEvent = await alice.publishDirectMessage(
    "Hello Bob! This is a secret message.",
    bobKeys.publicKey
  );
  
  // Clean up after 5 seconds
  setTimeout(() => {
    alice.disconnectFromRelays();
    bob.disconnectFromRelays();
    relay.close();
  }, 5000);
}

main().catch(console.error);
```

## NIP-05 Identity Verification

SNSTR includes a complete implementation of [NIP-05](https://github.com/nostr-protocol/nips/blob/master/05.md), which allows mapping Nostr public keys to DNS-based identifiers (like username@domain.com).

```typescript
import { 
  verifyNIP05, 
  getNIP05PubKey,
  getNIP05Relays
} from 'snstr';

async function main() {
  // Verify if a NIP-05 identifier matches a public key
  const isValid = await verifyNIP05(
    'username@example.com',
    'pubkey_in_hex_format'
  );
  
  console.log(`Verification result: ${isValid ? 'Valid ✅' : 'Invalid ❌'}`);
  
  // Find a public key from a NIP-05 identifier
  const pubkey = await getNIP05PubKey('username@example.com');
  if (pubkey) {
    console.log(`Found public key: ${pubkey}`);
    
    // Get recommended relays for this identifier
    const relays = await getNIP05Relays('username@example.com', pubkey);
    if (relays && relays.length > 0) {
      console.log('Recommended relays:');
      relays.forEach(relay => console.log(`  - ${relay}`));
    }
  }
}

main().catch(console.error);
```

### Key Features of NIP-05 Implementation

- **DNS-based Verification**: Links Nostr public keys to human-readable identifiers
- **Relay Discovery**: Finds recommended relays for users from their NIP-05 identifiers
- **Root Domain Support**: Properly handles `_@domain.com` format for domain-level identifiers
- **Error Handling**: Gracefully handles network errors and invalid responses
- **Well-Known URL**: Follows the standard protocol for `.well-known/nostr.json` discovery

## Encryption with NIP-44

SNSTR includes a complete implementation of [NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md), which provides more secure direct messaging encryption than the older NIP-04 standard. NIP-44 uses ChaCha20 with HMAC-SHA256 authentication to prevent tampering.

```typescript
import { 
  generateKeypair, 
  encryptNIP44, 
  decryptNIP44 
} from 'snstr';

async function main() {
  // Generate keypairs for Alice and Bob
  const aliceKeypair = await generateKeypair();
  const bobKeypair = await generateKeypair();
  
  // Alice encrypts a message for Bob
  const encrypted = encryptNIP44(
    'Hello Bob, this is a secure message!',
    aliceKeypair.privateKey,
    bobKeypair.publicKey
  );
  
  console.log(`Encrypted: ${encrypted}`);
  
  // Bob decrypts the message from Alice
  const decrypted = decryptNIP44(
    encrypted,
    bobKeypair.privateKey,
    aliceKeypair.publicKey
  );
  
  console.log(`Decrypted: ${decrypted}`);
}

main().catch(console.error);
```

### Key Features of NIP-44 Implementation

- **Authenticated Encryption**: Uses ChaCha20 + HMAC-SHA256 to prevent message tampering
- **Message Length Hiding**: Pads messages to hide their exact length
- **Proper Key Derivation**: Uses HKDF instead of raw ECDH output for better security
- **Forward-Compatible**: Includes version byte for future algorithm upgrades
- **Constant-Time Operations**: Prevents timing attacks during cryptographic operations
- **Comprehensive Validation**: Thorough input validation and error handling
- **Test Vectors**: Validated against official NIP-44 test vectors

## Browser Extensions (NIP-07)

SNSTR includes a complete implementation of [NIP-07](https://github.com/nostr-protocol/nips/blob/master/07.md), which allows web applications to interact with browser extensions that manage Nostr keys and signing.

```typescript
import { 
  Nip07Nostr, 
  hasNip07Support, 
  getNip07PublicKey 
} from 'snstr';

async function main() {
  // Check if a NIP-07 extension is available
  if (!hasNip07Support()) {
    console.error('NIP-07 extension not available');
    return;
  }
  
  // Get the public key from the extension
  const publicKey = await getNip07PublicKey();
  console.log(`Using public key: ${publicKey}`);
  
  // Create a client that uses the extension for signing
  const client = new Nip07Nostr([
    'wss://relay.damus.io',
    'wss://relay.nostr.band'
  ]);
  
  await client.connectToRelays();
  
  // Initialize with the extension's public key
  await client.initializeWithNip07();
  
  // Publish a note (will be signed by the extension)
  const note = await client.publishTextNote('Hello from SNSTR using NIP-07!');
  console.log(`Published note with ID: ${note?.id}`);
  
  // No need to handle private keys - they never leave the extension!
}

main().catch(console.error);
```

### Key Features of NIP-07 Implementation

- **Browser Extension Integration**: Connect to extensions like nos2x, Alby, or noStrudel
- **Security**: Private keys never leave the browser extension
- **Signing**: Events are signed by the extension, not your application
- **Encryption**: Supports both NIP-04 and NIP-44 encryption through the extension
- **Transparent API**: Same API as regular SNSTR client, but uses extension for cryptographic operations
- **Fallbacks**: Gracefully falls back between encryption methods if needed
- **Error Handling**: Clear error messages when extension functionality is unavailable

## Relay Information with NIP-11

SNSTR includes a complete implementation of [NIP-11](https://github.com/nostr-protocol/nips/blob/master/11.md), which allows clients to fetch metadata about relays such as supported NIPs, limitations, and payment requirements.

```typescript
import { 
  fetchRelayInformation, 
  supportsNIP11, 
  relaySupportsNIPs 
} from 'snstr';

async function main() {
  // Check if a relay supports NIP-11
  const hasNIP11 = await supportsNIP11('wss://relay.example.com');
  
  if (hasNIP11) {
    // Fetch detailed relay information
    const info = await fetchRelayInformation('wss://relay.example.com');
    
    console.log(`Relay name: ${info.name}`);
    console.log(`Operator pubkey: ${info.pubkey}`);
    console.log(`Contact: ${info.contact}`);
    
    // Check for supported NIPs
    if (info.supported_nips) {
      console.log(`Supported NIPs: ${info.supported_nips.join(', ')}`);
    }
    
    // Check for relay limitations
    if (info.limitation) {
      console.log(`Max message length: ${info.limitation.max_message_length} bytes`);
      console.log(`Max subscriptions: ${info.limitation.max_subscriptions}`);
      console.log(`Requires payment: ${info.limitation.payments_required ? 'Yes' : 'No'}`);
    }
    
    // Check if the relay supports specific NIPs
    const supportsZaps = await relaySupportsNIPs('wss://relay.example.com', [57]);
    console.log(`Supports Zaps: ${supportsZaps ? 'Yes' : 'No'}`);
  }
}

main().catch(console.error);
```

### Key Features of NIP-11 Implementation

- **Metadata Discovery**: Learn about relay capabilities, limitations, and contact information
- **Connection Options**: Discover maximum subscriptions, message sizes, and other limitations
- **NIP Support Detection**: Check if relays support specific protocol features
- **Payment Information**: Determine if a relay requires payment and get payment details
- **Efficient Caching**: Automatically caches relay information to reduce network requests
- **Timeout Handling**: Configurable timeouts to prevent hanging on slow relays
- **Robust Error Handling**: Gracefully handles connection issues and invalid responses

Try the NIP-11 example:

```bash
npm run example:nip11
```

## Relay Connection Management

SNSTR provides robust relay connection management with features to handle timeouts, errors, and race conditions gracefully:

```typescript
import { Relay, RelayEvent } from 'snstr';

// Create a relay with connection timeout
const relay = new Relay('wss://relay.example.com', { 
  connectionTimeout: 10000 // 10 second timeout
});

// Set up event handlers
relay.on(RelayEvent.Connect, (url) => console.log(`Connected to ${url}`));
relay.on(RelayEvent.Disconnect, (url) => console.log(`Disconnected from ${url}`));
relay.on(RelayEvent.Error, (url, error) => console.error(`Error from ${url}:`, error));

// Connect with proper error handling
try {
  const connected = await relay.connect();
  if (connected) {
    console.log('Successfully connected');
  } else {
    console.error('Failed to connect');
    
    // Adjust timeout and retry
    relay.setConnectionTimeout(15000); // Increase timeout
    const retryResult = await relay.connect();
    // Handle retry result
  }
} catch (error) {
  console.error('Connection error:', error);
}

// Disconnect when done
relay.disconnect();
```

### Key Features of Connection Management

- **Configurable Timeouts**: Set custom connection timeouts to avoid hanging connections
- **Robust Error Handling**: Proper promise rejection with detailed error information
- **Race Condition Prevention**: Carefully manages WebSocket lifecycle to prevent race conditions
- **Retry Mechanism**: Easily retry connections with different parameters
- **Client Integration**: Set connection options for all relays from the Nostr client

Try the connection management example:

```bash
npm run example:relay
```

## Lightning Zaps with NIP-57

SNSTR includes a complete implementation of [NIP-57](https://github.com/nostr-protocol/nips/blob/master/57.md), which standardizes the integration of Bitcoin Lightning Network payments (zaps) with Nostr.

```typescript
import { 
  Nostr,
  NostrZapClient,
  createZapRequest,
  getLightningAddressUrl
} from 'snstr';

async function main() {
  // Initialize client
  const client = new Nostr(['wss://relay.example.com']);
  await client.setPrivateKey(privateKey);
  await client.connectToRelays();
  
  // Create a ZapClient for easier interaction
  const zapClient = new NostrZapClient({
    client,
    defaultRelays: ['wss://relay.example.com']
  });
  
  // Convert Lightning address to LNURL endpoint
  const lnurlEndpoint = getLightningAddressUrl('user@domain.com');
  console.log(`LNURL endpoint: ${lnurlEndpoint}`);
  
  // Send a zap
  await zapClient.sendZap({
    recipientPubkey: 'recipient_pubkey',
    lnurl: 'lightning_address_or_lnurl',
    amount: 1000000, // 1000 sats in millisats
    comment: 'Great post!'
  }, myPrivateKey);
  
  // Fetch zaps received by a user
  const receivedZaps = await zapClient.fetchUserReceivedZaps('user_pubkey');
  
  // Calculate zap statistics
  const stats = await zapClient.getTotalZapsReceived('user_pubkey');
  console.log(`Total: ${stats.total / 1000} sats across ${stats.count} zaps`);
}

main().catch(console.error);
```

### Key Features of NIP-57 Implementation

- **Lightning Integration**: Connect Nostr events to Lightning Network payments
- **Zap Requests & Receipts**: Create and validate zap requests and receipts
- **Lightning Address Support**: Automatic handling of `user@domain.com` format addresses
- **Security**: Proper validation of description hashes to prevent tampering
- **Zap Splits**: Support for splitting payments between multiple recipients
- **Statistics**: Calculate detailed zap statistics (totals, averages, etc.)
- **Anonymous Zaps**: Support for sending zaps anonymously
- **Client API**: High-level API for common zap operations

## Nostr Wallet Connect with NIP-47

SNSTR includes a complete implementation of [NIP-47](https://github.com/nostr-protocol/nips/blob/master/47.md), which enables applications to connect securely to Lightning wallets over Nostr.

### Key Features

- **Secure Wallet Communication**: Communicate with Lightning wallets over encrypted Nostr events
- **Full Method Support**: Includes all standard methods: get_info, get_balance, make_invoice, pay_invoice, etc.
- **Request Expiration**: Built-in handling of request expiration for enhanced security
- **Robust Error Handling**: Comprehensive error codes and descriptive messages
- **Notification System**: Support for payment and other wallet notifications
- **Extensible Architecture**: Easily extend with custom wallet implementations

### Basic Example

```typescript
import { 
  NostrWalletConnectClient, 
  NostrWalletService 
} from 'snstr';

async function main() {
  // Create a wallet service (typically on the wallet side)
  const walletService = new NostrWalletService({
    relayUrls: ['wss://relay.example.com'],
    privateKey: 'wallet_service_private_key'
  });
  await walletService.initialize();
  
  // Generate connection URL to share with client
  const nwcUrl = walletService.generateNWCURL();
  console.log(`Share this URL with the client: ${nwcUrl}`);
  
  // On the client side, connect to the wallet
  const client = new NostrWalletConnectClient();
  await client.connect(nwcUrl);
  
  // Get wallet information
  const info = await client.getInfo();
  console.log('Wallet info:', info);
  
  // Check balance
  const balance = await client.getBalance();
  console.log(`Balance: ${balance} sats`);
  
  // Create an invoice
  const invoice = await client.makeInvoice({
    amount: 5000,
    description: 'Coffee'
  });
  console.log(`Invoice: ${invoice.bolt11}`);
  
  // Pay an invoice
  const paymentResult = await client.payInvoice({
    invoice: 'lnbc...'
  });
  console.log(`Payment success! Preimage: ${paymentResult.preimage}`);
}

main().catch(console.error);
```

### Client Setup with Error Handling

```typescript
import { NostrWalletConnectClient, NIP47ErrorCode } from 'snstr';

async function main() {
  const client = new NostrWalletConnectClient();
  
  try {
    // Connect to wallet using NWC URL
    await client.connect('nostr+walletconnect://...');
    
    // Get balance with error handling
    try {
      const balance = await client.getBalance();
      console.log(`Balance: ${balance} sats`);
    } catch (error) {
      if (error.code === NIP47ErrorCode.UNAUTHORIZED) {
        console.error('Not authorized to access balance');
      } else {
        console.error('Error getting balance:', error.message);
      }
    }
    
    // Make payment with error handling
    try {
      const result = await client.payInvoice({
        invoice: 'lnbc...'
      });
      console.log('Payment successful!');
    } catch (error) {
      if (error.code === NIP47ErrorCode.INSUFFICIENT_BALANCE) {
        console.error('Not enough funds to make payment');
      } else if (error.code === NIP47ErrorCode.INVOICE_ALREADY_PAID) {
        console.log('Invoice was already paid');
      } else {
        console.error('Payment failed:', error.message);
      }
    }
  } catch (error) {
    console.error('Failed to connect to wallet:', error);
  }
}

main();
```

Run the examples with:

```bash
# Basic NIP-47 example
npm run example:nip47

# With verbose logging
npm run example:nip47:verbose
```

For more examples, see the [examples/nip47](examples/nip47) directory.

## Using Public Relays vs Ephemeral Relay

The examples in SNSTR can run with either the built-in ephemeral relay or connect to public Nostr relays. This is controlled by the `USE_EPHEMERAL` environment variable:

```typescript
// In your code:
const USE_EPHEMERAL = process.env.USE_EPHEMERAL !== 'false';

// Then conditionally create clients
let client: Nostr;
if (USE_EPHEMERAL) {
  // Use ephemeral relay
  const ephemeralRelay = new NostrRelay(3000);
  await ephemeralRelay.start();
  client = new Nostr([ephemeralRelay.url]);
} else {
  // Use public relays
  client = new Nostr(['wss://relay.primal.net', 'wss://relay.nostr.band']);
}
```

The library includes scripts for both approaches:

```bash
# Run with ephemeral relay (default)
npm run example:ephemeral
npm run example:ephemeral:dm

# Run with public relays (Primal.net and Nostr.band)
npm run example:public
npm run example:public:dm
```

## Testing

The project includes a comprehensive test suite that uses the ephemeral relay for all tests, eliminating the need for external connections during testing.

### Test Structure

- **Unit Tests**: Testing individual functions and classes
  - `crypto.test.ts`: Tests for cryptographic functions
  - `event.test.ts`: Tests for event creation and manipulation
  - `relay.test.ts`: Tests for the Relay class using ephemeral relay
  - `nostr.test.ts`: Tests for the Nostr client using ephemeral relay
  
- **NIP-44 Tests**: Tests for the NIP-44 encryption implementation
  - `nip44/nip44-compatibility.test.ts`: Compatibility with official NIP-44 spec
  - `nip44/nip44-official-vectors.test.ts`: Tests against official test vectors
  - `nip44/nip44-padding-hmac.test.ts`: Tests for padding and HMAC implementation
  - `nip44/nip44-vectors.test.ts`: Additional test cases for robustness
  
- **NIP-57 Tests**: Tests for the Lightning Zaps implementation
  - `nip57/zap.test.ts`: Tests for zap request/receipt creation and validation
  
- **Integration Tests**: Tests that simulate real usage
  - `integration.test.ts`: End-to-end tests using ephemeral relay

### Running Tests

Run all tests:

```bash
npm run test:all
```

Run tests by category:

```bash
npm run test:core     # Core functionality tests (event, nostr, relay)
npm run test:crypto   # Encryption and crypto tests (NIP-04, NIP-44)
npm run test:identity # Identity-related tests (NIP-05, NIP-07, NIP-19)
npm run test:protocols # Protocol implementation tests (NIP-46, NIP-47, NIP-57)
npm run test:integration # Integration tests
```

Run a specific test file:

```bash
npm test -- tests/crypto.test.ts
```

### Test Coverage

The test suite aims for high coverage of all critical paths and edge cases:

- Key generation and management
- Event signing and verification 
- NIP-04 encryption/decryption
- NIP-44 encryption/decryption
- Relay connections and behavior
- Event publishing and subscription
- Zap request/receipt creation and validation
- Error handling

## Development

### Building the project

```bash
npm run build
```

### Running examples

```bash
# Example groups by functionality
npm run example:all      # Run the basic usage example
npm run example:basic    # Run core examples (basic, crypto, direct messages)
npm run example:messaging # Run messaging examples (dm, nip04, nip44)
npm run example:identity # Run identity examples (nip05, nip07, nip19)
npm run example:payments # Run payment examples (nip47, nip57)
npm run example:advanced # Run advanced protocol examples (nip46, error handling)

# Individual examples
npm run example          # Basic example (default ephemeral relay)
npm run example:dm       # Direct messaging example
npm run example:crypto   # Cryptography demo

# NIP-specific examples
npm run example:nip04    # Encrypted direct messages (NIP-04)
npm run example:nip05    # DNS identifiers (NIP-05)
npm run example:nip19    # bech32-encoded entities (NIP-19)
npm run example:nip44    # Versioned encryption (NIP-44)
npm run example:nip46    # Remote signing protocol (NIP-46)
npm run example:nip57    # Lightning Zaps (NIP-57)

# Examples with logging options
npm run example:verbose  # With verbose logging
npm run example:debug    # With debug logging
```

## Encryption Support

SNSTR supports both NIP-04 and NIP-44 encryption schemes for direct messages:

### NIP-04 (AES-CBC)

```typescript
import { generateKeypair, encryptNIP04, decryptNIP04 } from 'snstr';

const aliceKeypair = await generateKeypair();
const bobKeypair = await generateKeypair();

// Alice encrypts a message for Bob
const encrypted = encryptNIP04(
  'Hello Bob!',
  aliceKeypair.privateKey,
  bobKeypair.publicKey
);

// Bob decrypts the message from Alice
const decrypted = decryptNIP04(
  encrypted,
  bobKeypair.privateKey,
  aliceKeypair.publicKey
);
```

Our NIP-04 implementation:
- Uses HMAC-SHA256 with the key "nip04" for shared secret derivation
- Ensures compatibility with nostr-tools and other Nostr clients
- Includes robust validation and detailed error reporting
- Works consistently across browsers and Node.js environments

For more details on the NIP-04 implementation, see [src/nip04/README.md](src/nip04/README.md).

### NIP-44 (ChaCha20 with HMAC-SHA256)

```typescript
import { generateKeypair, encryptNIP44, decryptNIP44 } from 'snstr';

const aliceKeypair = await generateKeypair();
const bobKeypair = await generateKeypair();

// Alice encrypts a message for Bob with NIP-44
const encrypted = encryptNIP44(
  'Hello Bob!',
  aliceKeypair.privateKey,
  bobKeypair.publicKey
);

// Bob decrypts the message from Alice
const decrypted = decryptNIP44(
  encrypted,
  bobKeypair.privateKey,
  aliceKeypair.publicKey
);
```

For more details on the NIP-44 implementation, see [src/nip44/README.md](src/nip44/README.md).

## Remote Signing with NIP-46

SNSTR includes a complete implementation of [NIP-46](https://github.com/nostr-protocol/nips/blob/master/46.md), which enables secure remote signing through a "bunker" that holds your private keys.

For a visual explanation and architecture diagrams, see [examples/nip46/ARCHITECTURE.md](examples/nip46/ARCHITECTURE.md).

### Unified Example

The easiest way to get started with NIP-46 is through our unified example:

```bash
npm run example:nip46:unified
```

This example demonstrates:
- Setting up a bunker with proper permissions
- Connecting a client to the bunker
- Remotely signing events
- Verifying signatures

### Client Example

```typescript
import { SimpleNIP46Client } from 'snstr';

async function main() {
  // Create a client with relays to use for communication
  const client = new SimpleNIP46Client(['wss://relay.example.com']);

  // Connect to a remote signer using a connection string
  // Format: bunker://signer_pubkey?relay=wss%3A%2F%2Frelay.example.com
  await client.connect('bunker_connection_string_here');

  // Get the user's public key from the bunker
  const userPubkey = await client.getPublicKey();
  console.log('User public key:', userPubkey);

  // Sign an event remotely
  const signedEvent = await client.signEvent({
    kind: 1,
    content: 'Hello from a remote signer!',
    created_at: Math.floor(Date.now() / 1000),
    tags: []
  });

  console.log('Signed event:', signedEvent);
}

main().catch(console.error);
```

### Bunker Example

```typescript
import { SimpleNIP46Bunker, generateKeypair } from 'snstr';

async function main() {
  // Generate or load keypairs
  const userKeypair = await generateKeypair();
  
  // Create a bunker instance
  const bunker = new SimpleNIP46Bunker(
    ['wss://relay.example.com'],  // Relays to use for communication
    userKeypair.publicKey,        // User public key (identity)
    userKeypair.publicKey,        // Signer public key (same as user key in this example)
    {
      defaultPermissions: ['sign_event:1', 'get_public_key', 'ping'] 
    }
  );

  // Set the private keys (these never leave the bunker)
  bunker.setUserPrivateKey(userKeypair.privateKey);
  bunker.setSignerPrivateKey(userKeypair.privateKey);

  // Start the bunker
  await bunker.start();

  // Get the connection string to share with clients
  const connectionString = bunker.getConnectionString();
  console.log('Share this with clients:', connectionString);
  // Example output: bunker://signer_pubkey?relay=wss%3A%2F%2Frelay.example.com
}

main().catch(console.error);
```

## Code Standardization

To maintain consistency across the codebase, SNSTR follows standardized patterns for implementation, tests, and examples.

### Standardization Guides

- [NIP Implementation Standardization](src/NIP_STANDARDIZATION.md) - Guidelines for consistent NIP implementations in source code
- [Test Standardization](tests/TEST_STANDARDIZATION.md) - Standards for writing and organizing tests
- [Example Standardization](examples/EXAMPLE_STANDARDIZATION.md) - Best practices for creating consistent, well-documented examples

These guides ensure that all code follows similar patterns, making it easier for contributors to understand and extend the library.

## Examples

For complete examples of how to use SNSTR, see the [examples directory](./examples/README.md). We've organized examples by feature and NIP, with a consistent structure and naming convention.

You can run any example using the npm scripts:

```bash
# Basic usage example
npm run example

# NIP-specific examples
npm run example:nip04   # Encrypted direct messages (NIP-04)
npm run example:nip05   # DNS identifiers (NIP-05)
npm run example:nip19   # bech32-encoded entities (NIP-19)
npm run example:nip44   # Versioned encryption (NIP-44)
npm run example:nip46   # Remote signing protocol (NIP-46)
npm run example:nip57   # Lightning Zaps (NIP-57)
```

See the [examples README](./examples/README.md) for the full list of available examples and more details on how to run them.

## Security Considerations

### NIP-01 Event Validation

SNSTR implements comprehensive validation of Nostr events according to NIP-01 requirements:

1. **Structure and Field Validation**:
   - Verifies all required fields are present (id, pubkey, created_at, kind, tags, content, sig)
   - Validates proper data types and field lengths
   - Ensures tags are properly formatted as arrays of strings

2. **Cryptographic Verification**:
   - Verifies event ID matches the SHA-256 hash of the serialized event data
   - Validates event signature with Schnorr cryptography
   - Performs computationally expensive validations asynchronously for better performance

3. **Timestamp Validation**:
   - Rejects events with timestamps too far in the future
   - Warns about unusually old events

This validation prevents various attacks including event forgery, content tampering, and replay attacks.

### NIP-19 Security Enhancements

The SNSTR library implements enhanced security measures for NIP-19 encoded identifiers:

1. **Strict Relay URL Validation**: All relay URLs are validated to ensure they:
   - Use only websocket protocols (`wss://` or `ws://`)
   - Contain no credentials (username/password)
   - Are properly formatted URLs

2. **Filtering Functions**:
   - `filterProfile()`: Removes invalid relay URLs from decoded profiles
   - `filterEvent()`: Removes invalid relay URLs from decoded events
   - `filterAddress()`: Removes invalid relay URLs from decoded addresses
   - `filterEntity()`: Automatically detects entity type and filters appropriately

3. **Denial of Service Protection**:
   - Maximum length limits for relay URLs (512 bytes)
   - Maximum number of TLV entries (20)
   - Maximum length for identifiers (1024 bytes)

Example of secure usage:
```typescript
import { decodeProfile, filterProfile } from 'snstr';

// First decode the nprofile
const profile = decodeProfile(nprofileString);

// Then filter it to remove any malicious relay URLs
const safeProfile = filterProfile(profile);

// Now it's safe to use
console.log(safeProfile.relays); // Only contains valid relay URLs
```

IMPORTANT: Always filter entities after decoding to prevent XSS and other injection attacks.