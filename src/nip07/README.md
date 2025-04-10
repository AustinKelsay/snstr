# NIP-07: Browser Extension Provider

This module implements [NIP-07](https://github.com/nostr-protocol/nips/blob/master/07.md), which defines a standard interface for browser extensions to provide Nostr capabilities.

## Overview

NIP-07 allows web applications to interact with Nostr through browser extensions that implement a standard `window.nostr` API. This enables features like:

- Getting the user's public key
- Signing events without exposing the private key
- Encrypting and decrypting messages
- Creating a connection-less experience for users

## Key Features

- 🔐 **Public Key Access**: Get the user's public key without exposing their private key
- ✍️ **Secure Signing**: Sign events through the browser extension
- 🔒 **Encryption**: Support for both NIP-04 and NIP-44 encryption methods
- 🔄 **Adapter Pattern**: Nostr client adapter for easy extension integration
- 📝 **Validation**: Robust error handling for extension availability and support

## Basic Usage

### Check Extension Support

```typescript
import { hasNip07Support } from 'snstr';

// Check if a NIP-07 extension is available
if (hasNip07Support()) {
  console.log('NIP-07 extension is available!');
} else {
  console.log('No NIP-07 extension found. Please install one to continue.');
}
```

### Get Public Key

```typescript
import { getNip07PublicKey } from 'snstr';

// Get the user's public key from the extension
try {
  const pubkey = await getNip07PublicKey();
  console.log('Your public key:', pubkey);
} catch (error) {
  console.error('Failed to get public key:', error);
}
```

### Sign Events

```typescript
import { signEventWithNip07 } from 'snstr';

// Create an event to be signed
const eventToSign = {
  kind: 1,
  created_at: Math.floor(Date.now() / 1000),
  tags: [],
  content: 'Hello, Nostr!'
};

// Sign the event with the browser extension
try {
  const signedEvent = await signEventWithNip07(eventToSign);
  console.log('Signed event:', signedEvent);
} catch (error) {
  console.error('Failed to sign event:', error);
}
```

### Encryption (NIP-04)

```typescript
import { encryptNip04WithExtension, decryptNip04WithExtension } from 'snstr';

// Encrypt a message
const encrypted = await encryptNip04WithExtension(
  'recipient_pubkey_here',
  'Hello, this is a secret message!'
);
console.log('Encrypted message:', encrypted);

// Decrypt a message
const decrypted = await decryptNip04WithExtension(
  'sender_pubkey_here',
  'encrypted_content_here?iv=initialization_vector'
);
console.log('Decrypted message:', decrypted);
```

### Using the Adapter

```typescript
import { Nip07Nostr } from 'snstr';

// Create a Nostr client using the browser extension
const nostr = new Nip07Nostr(['wss://relay.example.com']);

// Connect to relays
await nostr.connectToRelays();

// Publish a note - signs using the extension
const event = await nostr.publishNote('Hello, Nostr via extension!');
console.log('Published event:', event);

// Subscribe to events
nostr.subscribe(
  [{ kinds: [1], limit: 10 }],
  (event) => console.log('Received event:', event)
);
```

## Implementation Details

- Provides a wrapped interface to the standard `window.nostr` object
- Supports both NIP-04 and NIP-44 encryption methods if available
- Includes a full Nostr client adapter that uses the extension for all cryptographic operations
- Uses thorough error handling to give meaningful feedback when extension features aren't available

## Security Considerations

- The private key never leaves the browser extension, enhancing security
- All cryptographic operations are performed inside the extension
- Validate that the returned public key matches expectations in multi-user environments
- Extensions might implement different signing UIs or confirmation dialogs 