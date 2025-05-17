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

## Important: Browser Security Restrictions

When using NIP-07 extensions, be aware of these critical security constraints:

- Browser extensions **cannot access pages loaded via the `file://` protocol**
- For testing and development, always serve your pages via HTTP using a local server
- Different extensions have different security models and prompting behaviors
- Some extensions may require explicit user permission for each signing operation
- See the examples directory for proper testing setup with a local HTTP server

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
import { getPublicKey } from 'snstr';

// Get the user's public key from the extension
try {
  const pubkey = await getPublicKey();
  console.log('Your public key:', pubkey);
} catch (error) {
  console.error('Failed to get public key:', error);
}
```

### Sign Events

```typescript
import { signEvent } from 'snstr';

// Create an event to be signed
const eventToSign = {
  kind: 1,
  created_at: Math.floor(Date.now() / 1000),
  tags: [],
  content: 'Hello, Nostr!'
};

// Sign the event with the browser extension
try {
  const signedEvent = await signEvent(eventToSign);
  console.log('Signed event:', signedEvent);
} catch (error) {
  console.error('Failed to sign event:', error);
}
```

### Encryption (NIP-04)

```typescript
import { encryptNip04, decryptNip04 } from 'snstr';

// Encrypt a message
try {
  const encrypted = await encryptNip04(
    'recipient_pubkey_here',
    'Hello, this is a secret message!'
  );
  console.log('Encrypted message:', encrypted);
} catch (error) {
  console.error('NIP-04 encryption not supported:', error);
}

// Decrypt a message
try {
  const decrypted = await decryptNip04(
    'sender_pubkey_here',
    'encrypted_content_here?iv=initialization_vector'
  );
  console.log('Decrypted message:', decrypted);
} catch (error) {
  console.error('NIP-04 decryption not supported:', error);
}
```

### Encryption (NIP-44)

```typescript
import { encryptNip44, decryptNip44 } from 'snstr';

// Encrypt a message using NIP-44
try {
  const encrypted = await encryptNip44(
    'recipient_pubkey_here',
    'Hello, this is a secret message!'
  );
  console.log('NIP-44 encrypted message:', encrypted);
} catch (error) {
  console.error('NIP-44 encryption not supported:', error);
}

// Decrypt a message using NIP-44
try {
  const decrypted = await decryptNip44(
    'sender_pubkey_here',
    'encrypted_content_here'
  );
  console.log('NIP-44 decrypted message:', decrypted);
} catch (error) {
  console.error('NIP-44 decryption not supported:', error);
}
```

### Feature Availability Check

```typescript
import { hasNip07Support } from 'snstr';

// Check if NIP-07 extension exists
if (hasNip07Support()) {
  // Check if extension implements specific features
  const nostr = (window as any).nostr;
  
  // Check for NIP-04 support
  if (nostr.nip04?.encrypt && nostr.nip04?.decrypt) {
    console.log('NIP-04 encryption is supported');
  } else {
    console.log('NIP-04 encryption is NOT supported');
  }
  
  // Check for NIP-44 support
  if (nostr.nip44?.encrypt && nostr.nip44?.decrypt) {
    console.log('NIP-44 encryption is supported');
  } else {
    console.log('NIP-44 encryption is NOT supported');
  }
}
```

### Using the Adapter

```typescript
import { Nip07Nostr } from 'snstr';

// Create a Nostr client using the browser extension
const nostr = new Nip07Nostr(['wss://relay.example.com']);

// Connect to relays
await nostr.connectToRelays();

// Publish a note - signs using the extension
const event = await nostr.publishTextNote('Hello, Nostr via extension!');
console.log('Published event:', event);

// Subscribe to events
nostr.subscribe(
  [{ kinds: [1], limit: 10 }],
  (event) => console.log('Received event:', event)
);

// Send an encrypted direct message
const dmEvent = await nostr.publishDirectMessage(
  'Hello, this is a private message!',
  'recipient_pubkey_here'
);

// Decrypt a received direct message (must use async version)
const decryptedContent = await nostr.decryptDirectMessageAsync(receivedEvent);
```

## Testing NIP-07 Integration

To properly test your NIP-07 integration:

1. Set up a local HTTP server to serve your HTML/JavaScript files
2. Install a compatible browser extension (nos2x, Alby, or noStrudel)
3. Load your page via HTTP (not via file://)
4. Check browser console for any errors
5. See the `/examples/nip07` directory for complete setup with a working example

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

## Compatible Extensions

The implementation works with these popular NIP-07 compatible extensions:

- [nos2x](https://chrome.google.com/webstore/detail/nos2x/kpgefcfmnafjgpblomihpgmejjdanjjp) (Chrome)
- [Alby](https://getalby.com/) (Chrome/Firefox)
- [noStrudel](https://addons.mozilla.org/en-US/firefox/addon/nostrudel/) (Firefox)

## API Reference

### Core Functions

| Function | Parameters | Return Type | Description |
|----------|------------|-------------|-------------|
| `hasNip07Support()` | none | `boolean` | Checks if a NIP-07 extension is available in the browser |
| `getPublicKey()` | none | `Promise<string>` | Gets the user's public key from the extension |
| `signEvent(event)` | `event: Omit<NostrEvent, "id" \| "pubkey" \| "sig">` | `Promise<NostrEvent>` | Signs an event using the extension |

### Encryption Functions (NIP-04)

| Function | Parameters | Return Type | Description |
|----------|------------|-------------|-------------|
| `encryptNip04(pubkey, plaintext)` | `pubkey: string, plaintext: string` | `Promise<string>` | Encrypts a message using NIP-04 |
| `decryptNip04(pubkey, ciphertext)` | `pubkey: string, ciphertext: string` | `Promise<string>` | Decrypts a message using NIP-04 |

### Encryption Functions (NIP-44)

| Function | Parameters | Return Type | Description |
|----------|------------|-------------|-------------|
| `encryptNip44(pubkey, plaintext)` | `pubkey: string, plaintext: string` | `Promise<string>` | Encrypts a message using NIP-44 |
| `decryptNip44(pubkey, ciphertext)` | `pubkey: string, ciphertext: string` | `Promise<string>` | Decrypts a message using NIP-44 |

### Nip07Nostr Class

| Method | Parameters | Return Type | Description |
|--------|------------|-------------|-------------|
| `constructor(relayUrls)` | `relayUrls: string[]` | `Nip07Nostr` | Creates a new NIP-07 enabled Nostr client |
| `initializeWithNip07()` | none | `Promise<string>` | Initializes the client with the extension's public key |
| `publishTextNote(content, tags)` | `content: string, tags?: string[][]` | `Promise<NostrEvent \| null>` | Publishes a text note using the extension for signing |
| `publishDirectMessage(content, recipientPubkey, tags)` | `content: string, recipientPubkey: string, tags?: string[][]` | `Promise<NostrEvent \| null>` | Publishes an encrypted direct message |
| `decryptDirectMessageAsync(event)` | `event: NostrEvent` | `Promise<string>` | Asynchronously decrypts a direct message | 