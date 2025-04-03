# SNSTR - Simple Nostr Software Toolkit for Retards
### Still Under Construction 🚧

SNSTR is a lightweight TypeScript library for interacting with the Nostr protocol. It provides a simple, easy-to-use API with minimal dependencies.

## Features

### Core Functionality
- Event creation and signing
- Message encryption/decryption (NIP-04 and NIP-44)
- Relay connections with automatic reconnect
- Filter-based subscriptions

### Advanced Features
- NIP-01: Basic protocol
- NIP-04: Encrypted Direct Messages
- NIP-05: Mapping Nostr keys to DNS-based internet identifiers
- NIP-07: Web browser extension
- NIP-19: bech32-encoded entities
- NIP-44: Versioned Encryption
- NIP-46: Remote Signing Protocol (Nostr Connect)

## Supported NIPs

SNSTR currently implements the following Nostr Implementation Possibilities (NIPs):

- NIP-01: Basic protocol functionality (events, subscriptions, relay connections)
- NIP-04: Encrypted direct messages using AES-CBC
- NIP-05: DNS identifier verification and relay discovery
- NIP-44: Improved encryption with ChaCha20 and HMAC-SHA256 authentication
- NIP-07: Browser extension integration for key management and signing
- NIP-46: Remote signing (bunker) support for secure key management

## Installation

coming soon

## Basic Usage

```typescript
import { Nostr, RelayEvent } from 'snstr';

async function main() {
  // Initialize with relays
  const client = new Nostr([
    'wss://relay.primal.net',
    'wss://relay.nostr.band'
  ]);

  // Generate keypair
  const keys = await client.generateKeys();
  console.log('Public key:', keys.publicKey);

  // Connect to relays
  await client.connectToRelays();
  
  // Set up event handlers
  client.on(RelayEvent.Connect, (relay) => {
    console.log(`Connected to ${relay}`);
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
  getPublicKeyFromNIP05,
  getRelaysFromNIP05 
} from 'snstr';

async function main() {
  // Verify if a NIP-05 identifier matches a public key
  const isValid = await verifyNIP05(
    'username@example.com',
    'pubkey_in_hex_format'
  );
  
  console.log(`Verification result: ${isValid ? 'Valid ✅' : 'Invalid ❌'}`);
  
  // Find a public key from a NIP-05 identifier
  const pubkey = await getPublicKeyFromNIP05('username@example.com');
  if (pubkey) {
    console.log(`Found public key: ${pubkey}`);
    
    // Get recommended relays for this identifier
    const relays = await getRelaysFromNIP05('username@example.com');
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
  
- **Integration Tests**: Tests that simulate real usage
  - `integration.test.ts`: End-to-end tests using ephemeral relay

### Running Tests

Run all tests:

```bash
npm test
```

Run a specific test file:

```bash
npm test -- tests/crypto.test.ts
```

Run just the NIP-44 tests:

```bash
npm test -- tests/nip44
```

### Test Coverage

The test suite aims for high coverage of all critical paths and edge cases:

- Key generation and management
- Event signing and verification 
- NIP-04 encryption/decryption
- NIP-44 encryption/decryption
- Relay connections and behavior
- Event publishing and subscription
- Error handling

## Development

### Building the project

```bash
npm run build
```

### Running examples

```bash
# Basic example (default ephemeral relay)
npm run example

# Direct messaging example (default ephemeral relay)
npm run example:dm

# Cryptography demo
npm run example:crypto

# NIP-44 encryption demo (runs examples/nip44/nip44-demo.ts)
npm run example:nip44

# Examples with ephemeral relay and verbose logging
npm run example:ephemeral
npm run example:ephemeral:dm

# Examples with public relays (Primal.net and Nostr.band)
npm run example:public
npm run example:public:dm

# Test encryption/decryption
npm run test:encryption   # Run NIP-04 tests
npm run test:nip44        # Run NIP-44 tests
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

For more details on the NIP-04 implementation, see [docs/nip04/README.md](docs/nip04/README.md).

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

### Client Example

```typescript
import { NostrRemoteSignerClient } from 'snstr';

async function main() {
  // Create a client with connection options
  const client = new NostrRemoteSignerClient({
    relays: ['wss://relay.example.com'],
    permissions: ['sign_event:1', 'sign_event:4'], // Request specific event kind permissions
    name: 'My Nostr App',
    url: 'https://myapp.example.com'
  });

  // Connect to a remote signer using its public key
  await client.connect('bunker_pubkey_here');

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
import { NostrRemoteSignerBunker } from 'snstr';

async function main() {
  // Create a bunker instance
  const bunker = new NostrRemoteSignerBunker({
    relays: ['wss://relay.example.com'],
    userPubkey: 'user_pubkey_here',
    secret: 'optional_secret_for_auth' // Optional
  });

  // Set the user's private key (this never leaves the bunker)
  bunker.setUserPrivateKey('user_private_key_here');

  // Start the bunker
  await bunker.start();

  // Get the connection string to share with clients
  const connectionString = bunker.getConnectionString();
  console.log('Share this with clients:', connectionString);
  // Example output: bunker://signer_pubkey?relay=wss%3A%2F%2Frelay.example.com&secret=optional_secret

  // The bunker will now automatically handle signing requests from authorized clients
}

main().catch(console.error);
```

### Key Features of NIP-46 Implementation

- **Secure Key Management**: Private keys never leave the bunker
- **Permission System**: Fine-grained control over what events clients can sign
- **Connection Secrets**: Optional authentication for client connections
- **NIP-44 Encryption**: All communication between client and bunker is encrypted
- **Multiple Relay Support**: Connect through multiple relays for redundancy
- **Automatic Response Handling**: Asynchronous request/response handling
- **Connection String Generation**: Easy sharing of bunker connection details
- **Metadata Support**: Clients can provide app name, URL, and icon
- **Timeout Handling**: Automatic cleanup of stale requests
- **Error Handling**: Comprehensive error handling and validation

## License

MIT
