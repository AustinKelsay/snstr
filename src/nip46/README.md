# NIP-46: Nostr Remote Signing Protocol

This directory contains a complete implementation of [NIP-46](https://github.com/nostr-protocol/nips/blob/master/46.md) for SNSTR, which enables secure remote signing through a "bunker" that securely stores private keys.

## Overview

NIP-46 defines a protocol for remote signing of Nostr events, allowing applications to request event signatures from a separate application that manages private keys. This separation provides enhanced security by:

1. Keeping private keys isolated from applications
2. Controlling exactly what events get signed
3. Supporting fine-grained permissions
4. Allowing the same keys to be used across multiple devices

## Key Features

- **Secure Key Separation**: Private keys remain isolated in a secure "bunker"
- **Two Implementation Options**: Full-featured and simplified versions for different use cases
- **Flexible Permissions**: Fine-grained control over what events can be signed
- **Multiple Encryption Options**: Support for both NIP-04 (AES-CBC) and NIP-44 (ChaCha20+HMAC)
- **Authentication Challenges**: Optional challenge-response authentication for enhanced security
- **Dual-Key Architecture**: Separate user and signer keys for improved security and flexibility
- **Connection Metadata**: Support for app name, icon, and URL for better user experience
- **Comprehensive Logging**: Detailed logging for debugging and monitoring

## Available Implementations

SNSTR provides two separate implementations with different levels of complexity:

### Full-Featured Implementation
```typescript
import { 
  NostrRemoteSignerClient, 
  NostrRemoteSignerBunker 
} from 'snstr';
```

- Complete NIP-46 protocol support
- Authentication challenges
- Fine-grained permission system
- Both NIP-04 (AES-CBC) and NIP-44 (ChaCha20+HMAC) encryption
- Connection metadata for better UX
- Secret token support for secure connections
- Extensive logging and debugging options

### Simplified Implementation
```typescript
import { 
  SimpleNIP46Client, 
  SimpleNIP46Bunker 
} from 'snstr';
```

- Core NIP-46 functionality in less code
- Basic permission handling
- NIP-04 encryption only
- No authentication challenges
- Easier to understand and integrate
- Good for learning and simple applications

## Key Concepts

### Client-Bunker Architecture

The NIP-46 protocol defines two main components:

1. **Client**: An application that needs to sign events but doesn't have direct access to private keys
2. **Bunker**: A secure application that stores private keys and handles signing requests

Communication between the client and bunker is done through Nostr relays using encrypted event messages.

### Connection Flow

1. Client generates a `bunker://` connection string
2. User connects to the bunker using this string
3. Bunker may require authentication
4. After authentication, the client can make signing requests
5. Bunker evaluates the requests against permissions
6. Bunker returns signed events to the client

### Permissions

Permissions control what operations a client can perform. They are defined in the format:

- `sign_event`: Allow signing any event
- `sign_event:<kind>`: Allow signing events of a specific kind
- `get_public_key`: Allow retrieving the public key
- `nip04_encrypt`: Allow NIP-04 encryption
- `nip04_decrypt`: Allow NIP-04 decryption
- `nip44_encrypt`: Allow NIP-44 encryption
- `nip44_decrypt`: Allow NIP-44 decryption
- `ping`: Allow ping functionality

## Basic Usage

### Simple Client Example

```typescript
import { SimpleNIP46Client } from 'snstr';

async function main() {
  // Initialize client with relays
  const client = new SimpleNIP46Client(['wss://relay.example.com']);
  
  // Connect to a remote signer
  await client.connect('bunker://signerPubkey?relay=wss://relay.example.com');
  
  // Get the user's public key
  const pubkey = await client.getPublicKey();
  console.log('User pubkey:', pubkey);
  
  // Sign an event
  const event = await client.signEvent({
    kind: 1,
    content: 'Hello from a remote signer!',
    created_at: Math.floor(Date.now() / 1000),
    tags: []
  });
  
  console.log('Signed event:', event);
  
  // Disconnect when done
  await client.disconnect();
}
```

### Simple Bunker Example

```typescript
import { SimpleNIP46Bunker, generateKeypair } from 'snstr';

async function main() {
  // Generate or load user keypair
  const userKeys = await generateKeypair();
  
  // Create bunker with the user's public key and relays
  const bunker = new SimpleNIP46Bunker(
    ['wss://relay.example.com'],
    userKeys.publicKey,
    userKeys.publicKey,  // Same as user in this case
    {
      defaultPermissions: ['sign_event:1', 'get_public_key', 'ping']
    }
  );
  
  // Set the private key (never leaves the bunker)
  bunker.setUserPrivateKey(userKeys.privateKey);
  
  // Start the bunker
  await bunker.start();
  
  // Get connection string to share with clients
  const connectionString = bunker.getConnectionString();
  console.log('Connection string:', connectionString);
}
```

### Full-Featured Client Example

```typescript
import { NostrRemoteSignerClient } from 'snstr';

async function main() {
  // Create client with metadata
  const client = new NostrRemoteSignerClient(['wss://relay.example.com'], {
    name: 'My App',
    url: 'https://myapp.example.com',
    image: 'https://myapp.example.com/icon.png',
    preferredEncryption: 'nip44',  // Use NIP-44 if available
    timeout: 30000  // 30 second timeout
  });
  
  // Connect with a secret token (if required by bunker)
  await client.connect('bunker://signerPubkey?relay=wss://relay.example.com', 'secret_token');
  
  // Check connection status and permissions
  const permissions = await client.getPermissions();
  console.log('Granted permissions:', permissions);
  
  // Sign a specific kind of event if permitted
  if (permissions.has('sign_event:1')) {
    const event = await client.signEvent({
      kind: 1,
      content: 'Hello world!',
      created_at: Math.floor(Date.now() / 1000),
      tags: []
    });
    console.log('Signed event:', event);
  }
  
  // Encrypt a message
  const encrypted = await client.encryptMessage('npub...', 'Secret message');
  console.log('Encrypted:', encrypted);
}
```

### Full-Featured Bunker Example

```typescript
import { NostrRemoteSignerBunker } from 'snstr';

async function main() {
  // Initialize the bunker
  const bunker = new NostrRemoteSignerBunker({
    userPubkey: 'userpubkey_hex',
    signerPubkey: 'signerpubkey_hex',
    relays: ['wss://relay.example.com'],
    requireAuthChallenge: true,
    authUrl: 'https://myapp.com/auth',
    defaultPermissions: ['get_public_key', 'sign_event:0', 'sign_event:1'],
    metadata: {
      name: 'My Secure Bunker',
      image: 'https://example.com/bunker-icon.png'
    },
    preferredEncryption: 'nip44'
  });
  
  // Set private keys for signing
  bunker.setUserPrivateKey('userprivkey_hex');
  bunker.setSignerPrivateKey('signerprivkey_hex');
  
  // Add custom permission handler
  bunker.setPermissionHandler((clientPubkey, method, params) => {
    if (method === 'sign_event') {
      const event = JSON.parse(params[0]);
      
      // Reject events mentioning specific users
      const mentionedUsers = event.tags
        .filter(tag => tag[0] === 'p')
        .map(tag => tag[1]);
        
      if (mentionedUsers.includes('blocked_user_pubkey')) {
        return false;
      }
    }
    
    // Default to normal permission checking
    return null;
  });
  
  // Start the bunker
  await bunker.start();
  
  console.log('Bunker started. Connection URL:', bunker.getConnectionString());
}
```

## API Reference

### Shared Types

```typescript
enum NIP46Method {
  CONNECT = 'connect',
  GET_PUBLIC_KEY = 'get_public_key',
  SIGN_EVENT = 'sign_event',
  PING = 'ping',
  NIP04_ENCRYPT = 'nip04_encrypt',
  NIP04_DECRYPT = 'nip04_decrypt',
  NIP44_ENCRYPT = 'nip44_encrypt',
  NIP44_DECRYPT = 'nip44_decrypt'
}

interface NIP46ClientOptions {
  name?: string;
  url?: string;
  image?: string;
  timeout?: number;
  preferredEncryption?: 'nip04' | 'nip44';
  debug?: boolean;
}

interface NIP46BunkerOptions {
  userPubkey: string;
  signerPubkey?: string;
  relays?: string[];
  secret?: string;
  defaultPermissions?: string[];
  requireAuthChallenge?: boolean;
  authUrl?: string;
  authTimeout?: number;
  metadata?: NIP46Metadata;
  preferredEncryption?: 'nip04' | 'nip44';
  debug?: boolean;
}

interface NIP46Metadata {
  name?: string;
  url?: string;
  image?: string;
  relays?: string[];
  nostrconnect_url?: string;
}
```

### Request/Response Utilities

```typescript
function generateRequestId(): string
function createRequest(method: string, params: string[]): NIP46Request
function createSuccessResponse(id: string, result: string): NIP46Response
function createErrorResponse(id: string, error: string): NIP46Response
```

### Logging Utilities

```typescript
enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  TRACE = 5
}

interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  includeTimestamp?: boolean;
}

class Logger {
  constructor(options: LoggerOptions = {})
  error(message: string, ...args: any[]): void
  warn(message: string, ...args: any[]): void
  info(message: string, ...args: any[]): void
  debug(message: string, ...args: any[]): void
  trace(message: string, ...args: any[]): void
  setLevel(level: LogLevel): void
}
```

## Security Considerations

1. **Private Key Handling**: Private keys should never leave the bunker
2. **Permission System**: Use the most restrictive permissions necessary
3. **Authentication**: Enable authentication challenges for sensitive operations
4. **Encryption**: Prefer NIP-44 over NIP-04 when available
5. **Authorization**: Implement additional authorization checks in your bunker

## Advanced Topics

### Dual-Key Architecture

This implementation supports a dual-key architecture:

- **User Key**: Used for the user's identity
- **Signer Key**: Used for authenticating the bunker

This separation allows for:
- Multiple signers for the same user identity
- Rotating bunker keys without changing user identity
- Enhanced security through key isolation

### Custom Permission Handlers

The full-featured implementation allows custom permission handlers:

```typescript
bunker.setPermissionHandler((clientPubkey, method, params) => {
  // Your custom logic here
  // Return true to allow, false to deny, null for default behavior
});
```

This can be used to implement advanced rules like:
- Spending limits for zaps
- Whitelisted content or tags
- Rate limiting by client
- Time-based restrictions

### Multi-Relay Strategy

Connect to multiple relays for redundancy:

```typescript
const client = new NostrRemoteSignerClient([
  'wss://relay1.example.com',
  'wss://relay2.example.com',
  'wss://relay3.example.com'
]);
```

## Additional Resources

- [Official NIP-46 Specification](https://github.com/nostr-protocol/nips/blob/master/46.md)
- [Architecture Diagrams](../../examples/nip46/ARCHITECTURE.md)
- [Example Applications](../../examples/nip46)
- [Security Best Practices](../../examples/nip46/SECURITY.md) 