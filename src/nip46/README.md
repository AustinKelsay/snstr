# NIP-46: Nostr Remote Signing Protocol

This directory contains a **production-ready, security-hardened** implementation of [NIP-46](https://github.com/nostr-protocol/nips/blob/master/46.md) for SNSTR, enabling secure remote signing through a "bunker" that securely stores private keys.

## Overview

NIP-46 defines a protocol for remote signing of Nostr events, allowing applications to request event signatures from a separate application that manages private keys. This separation provides enhanced security by:

1. **Isolating private keys** from client applications
2. **Fine-grained permission control** over signing operations
3. **Authentication challenges** for enhanced security
4. **Cross-device key sharing** with the same security guarantees
5. **DoS protection** through built-in rate limiting
6. **Replay attack prevention** with secure request ID generation

## Key Features

### 🔒 **Enterprise-Grade Security**
- **Cryptographically Secure Request IDs**: Prevents replay attacks with 2-minute validity window
- **Rate Limiting**: Multi-tier DoS protection (burst, per-minute, per-hour limits)
- **Input Validation**: Comprehensive validation at every entry point
- **Timing Attack Resistance**: Constant-time operations for sensitive comparisons
- **Memory Management**: Secure cleanup of sensitive data and resources
- **Connection String Security**: URL validation with injection prevention

### 🏗️ **Dual Implementation Architecture**
- **Full-Featured Implementation**: Complete NIP-46 protocol with all advanced features
- **Simplified Implementation**: Lightweight version for basic use cases and learning
- **Flexible API Design**: Choose the complexity level that fits your needs

### 🚀 **Production-Ready Features**
- **Dual Encryption Support**: Both NIP-04 (AES-CBC) and NIP-44 (ChaCha20+HMAC)
- **Authentication Challenges**: Optional URL-based authentication with domain whitelist
- **Connection Metadata**: App identification for better user experience
- **Comprehensive Logging**: Environment-aware logging with configurable levels
- **Error Handling**: Structured error types with sanitized production output
- **Resource Management**: Automatic cleanup and connection management

## Available Implementations

### Full-Featured Implementation (Recommended for Production)
```typescript
import { 
  NostrRemoteSignerClient, 
  NostrRemoteSignerBunker 
} from 'snstr';
```

**Features:**
- Complete NIP-46 protocol support
- Authentication challenges with URL validation
- Advanced permission system with custom handlers
- Both NIP-04 and NIP-44 encryption
- Connection metadata for better UX
- Rate limiting and DoS protection
- Comprehensive security validation
- Production-ready error handling

### Simplified Implementation (Great for Learning)
```typescript
import { 
  SimpleNIP46Client, 
  SimpleNIP46Bunker 
} from 'snstr';
```

**Features:**
- Core NIP-46 functionality
- Basic permission handling
- NIP-44 encryption (with NIP-04 fallback)
- Simplified API surface
- Essential security features
- Perfect for tutorials and simple apps

## Quick Start

### Simple Bunker Setup

```typescript
import { SimpleNIP46Bunker, generateKeypair } from 'snstr';

async function createBunker() {
  // Generate keypair for the user
  const userKeys = await generateKeypair();
  const signerKeys = await generateKeypair(); // Optional: separate signer keys
  
  // Create bunker
  const bunker = new SimpleNIP46Bunker(
    ['wss://relay.example.com'], // relays
    userKeys.publicKey,          // user pubkey
    signerKeys.publicKey,        // signer pubkey (optional, defaults to user)
    {
      defaultPermissions: ['sign_event:1', 'get_public_key', 'ping', 'nip44_encrypt', 'nip44_decrypt'],
      secret: 'optional-connection-secret',
      debug: true
    }
  );
  
  // Set private keys (never leave the bunker)
  bunker.setUserPrivateKey(userKeys.privateKey);
  bunker.setSignerPrivateKey(signerKeys.privateKey);
  
  // Start the bunker
  await bunker.start();
  
  console.log('🔐 Bunker started!');
  console.log('Connection string:', bunker.getConnectionString());
  
  return bunker;
}
```

### Simple Client Usage

```typescript
import { SimpleNIP46Client } from 'snstr';

async function useClient(connectionString: string) {
  // Create client
  const client = new SimpleNIP46Client(['wss://relay.example.com'], {
    timeout: 30000,
    debug: true
  });
  
  try {
    // Connect to bunker
    const userPubkey = await client.connect(connectionString);
    console.log('✅ Connected! User pubkey:', userPubkey);
    
    // Test connection
    const isAlive = await client.ping();
    console.log('Ping successful:', isAlive);
    
    // Sign an event
    const signedEvent = await client.signEvent({
      kind: 1,
      content: 'Hello from remote signer!',
      created_at: Math.floor(Date.now() / 1000),
      tags: []
    });
    
    console.log('✅ Event signed:', signedEvent.id);
    
    // Encrypt a message
    const encrypted = await client.nip44Encrypt(
      'recipient_pubkey_hex',
      'Secret message'
    );
    console.log('✅ Message encrypted:', encrypted);
    
  } finally {
    await client.disconnect();
  }
}
```

**⚠️ Important Note**: The `connect()` method behavior differs between implementations:
- **SimpleNIP46Client**: Returns the user's public key directly
- **NostrRemoteSignerClient**: Returns "ack" or secret value per NIP-46 spec. Use `getUserPublicKey()` afterward to get the user's public key.

## Advanced Usage

### Production Bunker with Security Features

```typescript
import { NostrRemoteSignerBunker, generateKeypair } from 'snstr';

async function createProductionBunker() {
  const userKeys = await generateKeypair();
  const signerKeys = await generateKeypair();
  
  const bunker = new NostrRemoteSignerBunker({
    userPubkey: userKeys.publicKey,
    signerPubkey: signerKeys.publicKey,
    relays: [
      'wss://relay1.example.com',
      'wss://relay2.example.com',
      'wss://relay3.example.com'
    ],
    
    // Security settings
    requireAuthChallenge: true,
    authUrl: 'https://myapp.com/nip46-auth',
    authTimeout: 300000, // 5 minutes
    
    // Default permissions (restrictive by default)
    defaultPermissions: [
      'get_public_key',
      'ping',
      'sign_event:1',    // Only text notes
      'nip44_encrypt',
      'nip44_decrypt'
    ],
    
    // App metadata
    metadata: {
      name: 'My Secure Bunker',
      url: 'https://myapp.com',
      image: 'https://myapp.com/icon.png',
      relays: ['wss://relay1.example.com']
    },
    
    debug: process.env.NODE_ENV === 'development'
  });
  
  // Set private keys
  bunker.setPrivateKeys(userKeys.privateKey, signerKeys.privateKey);
  
  // Custom permission handler for advanced rules
  bunker.setPermissionHandler((clientPubkey, method, params) => {
    if (method === 'sign_event' && params.length > 0) {
      try {
        const eventData = JSON.parse(params[0]);
        
        // Block events with certain content
        if (eventData.content?.includes('BLOCKED_WORD')) {
          return false;
        }
        
        // Limit event kinds
        if (eventData.kind > 10000) {
          return false; // No replaceable events
        }
        
        // Allow specific clients more permissions
        if (clientPubkey === 'trusted_client_pubkey') {
          return true;
        }
      } catch (error) {
        return false; // Invalid event data
      }
    }
    
    // Return null for default permission checking
    return null;
  });
  
  await bunker.start();
  return bunker;
}
```

### Production Client with Error Handling

```typescript
import { NostrRemoteSignerClient } from 'snstr';

async function createProductionClient() {
  const client = new NostrRemoteSignerClient({
    relays: [
      'wss://relay1.example.com',
      'wss://relay2.example.com'
    ],
    
    // Client metadata
    name: 'My Nostr App',
    url: 'https://mynostrapp.com',
    image: 'https://mynostrapp.com/icon.png',
    
    // Timeouts and security
    timeout: 30000,
    authTimeout: 300000,
    authDomainWhitelist: [
      'myapp.com',
      'trusted-auth.com'
    ],
    
    // Request specific permissions
    permissions: [
      'get_public_key',
      'sign_event:1',
      'sign_event:6', // Reposts
      'nip44_encrypt',
      'nip44_decrypt'
    ],
    
    debug: false
  });
  
  try {
    // Connect with error handling
    const userPubkey = await client.connect(connectionString);
    console.log('Connected as:', userPubkey);
    
    // Always get user pubkey after connecting (NIP-46 requirement)
    const confirmedPubkey = await client.getUserPublicKey();
    console.log('Confirmed user pubkey:', confirmedPubkey);
    
    return { client, userPubkey: confirmedPubkey };
    
  } catch (error) {
    console.error('Connection failed:', error.message);
    await client.disconnect();
    throw error;
  }
}
```

## API Reference

### Core Types

```typescript
// Main client and bunker classes
class NostrRemoteSignerClient {
  constructor(options: NIP46ClientOptions = {})
  async connect(connectionString: string): Promise<string>
  async disconnect(): Promise<void>
  async getUserPublicKey(): Promise<string>
  async getPublicKey(): Promise<string> // Alias for getUserPublicKey
  async signEvent(eventData: NIP46UnsignedEventData): Promise<NostrEvent>
  async ping(): Promise<string>
  async nip44Encrypt(thirdPartyPubkey: string, plaintext: string): Promise<string>
  async nip44Decrypt(thirdPartyPubkey: string, ciphertext: string): Promise<string>
  async nip04Encrypt(thirdPartyPubkey: string, plaintext: string): Promise<string>
  async nip04Decrypt(thirdPartyPubkey: string, ciphertext: string): Promise<string>
  async getRelays(): Promise<string[]>
  
  // Static methods
  static generateConnectionString(clientPubkey: string, options?: NIP46ClientOptions): string
}

class NostrRemoteSignerBunker {
  constructor(options: NIP46BunkerOptions)
  async start(): Promise<void>
  async stop(): Promise<void>
  setUserPrivateKey(privateKey: string): void
  setSignerPrivateKey(privateKey: string): void
  setPrivateKeys(userPrivateKey: string, signerPrivateKey?: string): void
  setPermissionHandler(handler: PermissionHandler): void
  clearPermissionHandler(): void
  getConnectionString(): string
  resolveAuthChallenge(pubkey: string): boolean
  getSignerPubkey(): string
}

class SimpleNIP46Client {
  constructor(relays: string[], options?: SimpleNIP46ClientOptions)
  async connect(connectionString: string): Promise<string>
  async disconnect(): Promise<void>
  async getPublicKey(): Promise<string>
  async ping(): Promise<boolean>
  async signEvent(eventData: NIP46UnsignedEventData): Promise<NostrEvent>
  async nip44Encrypt(thirdPartyPubkey: string, plaintext: string): Promise<string>
  async nip44Decrypt(thirdPartyPubkey: string, ciphertext: string): Promise<string>
  async nip04Encrypt(thirdPartyPubkey: string, plaintext: string): Promise<string>
  async nip04Decrypt(thirdPartyPubkey: string, ciphertext: string): Promise<string>
  async getRelays(): Promise<string[]>
  setLogLevel(level: LogLevel): void
}

class SimpleNIP46Bunker {
  constructor(
    relays: string[],
    userPubkey: string,
    signerPubkey?: string,
    options?: SimpleNIP46BunkerOptions
  )
  async start(): Promise<void>
  async stop(): Promise<void>
  setUserPrivateKey(privateKey: string): void
  setSignerPrivateKey(privateKey: string): void
  setDefaultPermissions(permissions: string[]): void
  getConnectionString(): string
  addClientPermission(clientPubkey: string, permission: string): boolean
  removeClientPermission(clientPubkey: string, permission: string): boolean
  setLogLevel(level: LogLevel): void
}
```

### Configuration Interfaces

```typescript
interface NIP46ClientOptions {
  relays?: string[];
  secret?: string;
  permissions?: string[];
  name?: string;
  url?: string;
  image?: string;
  timeout?: number; // Default: 30000ms
  debug?: boolean;
  authTimeout?: number; // Default: 300000ms (5 min)
  authDomainWhitelist?: string[];
}

interface NIP46BunkerOptions {
  userPubkey: string;
  signerPubkey?: string; // Defaults to userPubkey
  relays?: string[];
  secret?: string;
  defaultPermissions?: string[];
  requireAuthChallenge?: boolean;
  authUrl?: string;
  authTimeout?: number;
  metadata?: NIP46Metadata;
  debug?: boolean;
}

interface SimpleNIP46ClientOptions {
  timeout?: number;
  logLevel?: LogLevel;
  debug?: boolean;
}

interface SimpleNIP46BunkerOptions {
  timeout?: number;
  logLevel?: LogLevel;
  defaultPermissions?: string[];
  secret?: string;
  debug?: boolean;
}
```

### Permission System

```typescript
// Standard permissions
const PERMISSIONS = {
  // Core operations
  'connect': 'Allow connection',
  'get_public_key': 'Get user public key',
  'ping': 'Test connectivity',
  
  // Event signing
  'sign_event': 'Sign any event',
  'sign_event:1': 'Sign text notes only',
  'sign_event:0': 'Sign profile metadata',
  'sign_event:3': 'Sign contact lists',
  'sign_event:4': 'Sign encrypted DMs',
  
  // Encryption/Decryption
  'nip04_encrypt': 'NIP-04 encryption',
  'nip04_decrypt': 'NIP-04 decryption',
  'nip44_encrypt': 'NIP-44 encryption',
  'nip44_decrypt': 'NIP-44 decryption',
  
  // Relay operations
  'get_relays': 'Get relay list'
};

// Permission handler type
type PermissionHandler = (
  clientPubkey: string,
  method: string,
  params: string[]
) => boolean | null; // null = use default checking
```

## Security Features

### Built-in Protection

1. **Replay Attack Prevention**
   ```typescript
   // Automatic request ID validation with 2-minute window
   // Cryptographically secure ID generation
   // Automatic cleanup of old request IDs
   ```

2. **Rate Limiting**
   ```typescript
   // Built-in DoS protection:
   // - Burst limit: 10 requests in 10 seconds
   // - Per-minute: 60 requests
   // - Per-hour: 1000 requests
   // - Configurable per bunker instance
   ```

3. **Input Validation**
   ```typescript
   // Validates all inputs:
   // - Event structure and size limits
   // - Public key format (64-char hex)
   // - Connection string format and safety
   // - Parameter counts and sizes
   // - Relay URL format and security
   ```

4. **Memory Security**
   ```typescript
   // Automatic cleanup of:
   // - Pending requests on disconnect
   // - Auth challenges after timeout
   // - Rate limiting history
   // - Subscription management
   ```

### Security Best Practices

```typescript
// 1. Use restrictive permissions
const restrictivePermissions = [
  'get_public_key',
  'ping',
  'sign_event:1', // Only text notes
  'nip44_encrypt', // Prefer NIP-44 over NIP-04
  'nip44_decrypt'
];

// 2. Enable authentication challenges for sensitive operations
const bunker = new NostrRemoteSignerBunker({
  requireAuthChallenge: true,
  authUrl: 'https://your-secure-domain.com/auth',
  authDomainWhitelist: ['your-secure-domain.com']
});

// 3. Implement custom permission logic
bunker.setPermissionHandler((clientPubkey, method, params) => {
  if (method === 'sign_event') {
    const event = JSON.parse(params[0]);
    
    // Block large events
    if (event.content.length > 10000) return false;
    
    // Block certain event kinds
    if (event.kind >= 30000) return false;
    
    // Time-based restrictions
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) return false; // Only during day
  }
  
  return null; // Use default permission checking
});

// 4. Use connection secrets for additional security
const bunker = new SimpleNIP46Bunker(relays, userPubkey, signerPubkey, {
  secret: 'long-random-secret-string'
});
```

## Error Handling

### Error Types

```typescript
// Specific error types for different failure modes
class NIP46Error extends Error {}
class NIP46ConnectionError extends NIP46Error {}
class NIP46TimeoutError extends NIP46Error {}
class NIP46AuthorizationError extends NIP46Error {}
class NIP46EncryptionError extends NIP46Error {}
class NIP46DecryptionError extends NIP46Error {}
class NIP46SigningError extends NIP46Error {}
class NIP46SecurityError extends NIP46Error {}
class NIP46ReplayAttackError extends NIP46SecurityError {}
```

### Error Handling Example

```typescript
try {
  const signedEvent = await client.signEvent(eventData);
} catch (error) {
  if (error instanceof NIP46TimeoutError) {
    console.error('Request timed out - bunker may be offline');
  } else if (error instanceof NIP46AuthorizationError) {
    console.error('Permission denied - check bunker permissions');
  } else if (error instanceof NIP46ConnectionError) {
    console.error('Connection failed - check connection string and relays');
  } else if (error instanceof NIP46SecurityError) {
    console.error('Security validation failed:', error.message);
  } else {
    console.error('Unexpected error:', error.message);
  }
}
```

## Connection Strings

### Bunker URL Format

```
bunker://<signer-pubkey>?relay=<relay1>&relay=<relay2>&secret=<optional-secret>
```

### NostrConnect URL Format

```
nostrconnect://<client-pubkey>?relay=<relay1>&secret=<secret>&perms=<permissions>&name=<app-name>&url=<app-url>&image=<app-icon>
```

### Connection String Utilities

```typescript
import { buildConnectionString, parseConnectionString } from 'snstr';

// Build connection string
const connectionString = buildConnectionString({
  pubkey: 'signer_pubkey_hex',
  relays: ['wss://relay.example.com'],
  secret: 'optional_secret'
});

// Parse connection string
const connectionInfo = parseConnectionString(connectionString);
console.log('Pubkey:', connectionInfo.pubkey);
console.log('Relays:', connectionInfo.relays);
console.log('Type:', connectionInfo.type); // 'bunker' or 'nostrconnect'
```

## Logging and Debugging

### Log Levels

```typescript
import { LogLevel, Logger } from 'snstr';

enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  TRACE = 5
}

// Enable debug logging
const client = new SimpleNIP46Client(relays, {
  debug: true,
  logLevel: LogLevel.DEBUG
});

// Custom logger
const logger = new Logger({
  level: LogLevel.INFO,
  prefix: 'MyApp-NIP46',
  includeTimestamp: true
});
```

## Testing

Run the comprehensive test suite:

```bash
# Run all NIP-46 tests
npm run test:nip46

# Run specific test categories
npm run test:nip46 -- --testNamePattern="security"
npm run test:nip46 -- --testNamePattern="core functionality"
npm run test:nip46 -- --testNamePattern="validation"
```

The test suite includes:
- **193 passing tests** across 15 test suites
- Security validation and attack prevention
- Core functionality and edge cases
- Error handling and timeouts
- Rate limiting and DoS protection
- Connection and authentication flows

## Migration Guide

### From Other NIP-46 Libraries

```typescript
// Other libraries
const signer = new OtherNIP46Signer(privateKey);
await signer.connect(relayUrl);

// SNSTR (security-focused approach)
const bunker = new SimpleNIP46Bunker(relays, userPubkey, signerPubkey);
bunker.setUserPrivateKey(privateKey); // Private key never exposed in constructor
await bunker.start();
```

### From Simple to Full Implementation

```typescript
// Simple implementation
const client = new SimpleNIP46Client(relays);

// Full implementation with same functionality
const client = new NostrRemoteSignerClient({
  relays: relays,
  // Add any additional features you need
});
```

## Performance Considerations

- **Memory Usage**: Automatic cleanup prevents memory leaks
- **Connection Pooling**: Efficient relay connection management
- **Rate Limiting**: Built-in protection against DoS attacks
- **Request Batching**: Efficient handling of multiple concurrent requests
- **Timeout Handling**: Prevents hanging requests

## Troubleshooting

### Common Issues

1. **Connection Timeout**
   ```typescript
   // Increase timeout for slow networks
   const client = new SimpleNIP46Client(relays, { timeout: 60000 });
   ```

2. **Permission Denied**
   ```typescript
   // Check bunker permissions
   bunker.addClientPermission(clientPubkey, 'sign_event:1');
   ```

3. **Relay Connection Issues**
   ```typescript
   // Use multiple relays for redundancy
   const relays = [
     'wss://relay1.example.com',
     'wss://relay2.example.com',
     'wss://relay3.example.com'
   ];
   ```

4. **Auth Challenge Issues**
   ```typescript
   // Check domain whitelist
   const client = new NostrRemoteSignerClient({
     authDomainWhitelist: ['trusted-domain.com']
   });
   ```

## Additional Resources

- [NIP-46 Official Specification](https://github.com/nostr-protocol/nips/blob/master/46.md)
- [Security Best Practices](../../../examples/nip46/README.md)
- [Example Applications](../../../examples/nip46/)
- [Architecture Documentation](../../../examples/nip46/ARCHITECTURE.md)

---

*This implementation provides enterprise-grade security and is ready for production use. The comprehensive test suite ensures reliability and security across all features.* 

### Utility Functions

```typescript
// Connection string utilities
function buildConnectionString(options: {
  pubkey: string;
  relays?: string[];
  secret?: string;
}): string

function parseConnectionString(connectionString: string): NIP46ConnectionInfo

// Request/response utilities  
function generateRequestId(): string
function createRequest(method: string, params: string[]): NIP46Request
function createSuccessResponse(id: string, result: string): NIP46Response
function createErrorResponse(id: string, error: string): NIP46Response

// Security validation utilities
class NIP46Validator {
  static validatePubkey(pubkey: string): boolean
  static validatePrivateKey(privateKey: string): boolean
  static validateEventContent(content: string): boolean
  static validateRequestPayload(request: NIP46Request): boolean
  static validateConnectionString(connectionString: string): boolean
  static validateRelayUrl(url: string): boolean
  static validatePermission(permission: string): boolean
}

// Security validation functions:
  static validatePrivateKey(privateKey: string, context?: string): void
  static validateKeypairForCrypto(keypair: NIP46KeyPair, context?: string): void
  static validateBeforeSigning(userKeypair: NIP46KeyPair, eventData: any): void
  static validateBeforeEncryption(userKeypair: NIP46KeyPair, thirdPartyPubkey: string, data: string): void
}

// Rate limiting
class NIP46RateLimiter {
  constructor(config?: RateLimitConfig)
  isAllowed(clientPubkey: string): RateLimitResult
  getRemainingRequests(clientPubkey: string): { minute: number; hour: number; burst: number }
  clearClient(clientPubkey: string): void
  destroy(): void
}
```

## Advanced Architecture

### Dual-Key Architecture

This implementation supports a sophisticated **dual-key architecture** that separates concerns for enhanced security:

```typescript
// User keys: Represent the user's identity
const userKeys = await generateKeypair();

// Signer keys: Authenticate the bunker (can be different)
const signerKeys = await generateKeypair(); 

const bunker = new NostrRemoteSignerBunker({
  userPubkey: userKeys.publicKey,    // Identity key
  signerPubkey: signerKeys.publicKey, // Bunker authentication key
  relays: ['wss://relay.example.com']
});

bunker.setUserPrivateKey(userKeys.privateKey);     // For signing events
bunker.setSignerPrivateKey(signerKeys.privateKey); // For bunker communication
```

**Benefits of Dual-Key Architecture:**
- **Key Rotation**: Change bunker keys without changing user identity
- **Multiple Bunkers**: Same user identity across different bunker instances
- **Enhanced Security**: Compromise of bunker key doesn't compromise user identity
- **Flexibility**: Different security levels for different key types

### Custom Permission Handlers

Implement sophisticated permission logic:

```typescript
bunker.setPermissionHandler((clientPubkey, method, params) => {
  if (method === 'sign_event') {
    const event = JSON.parse(params[0]);
    
    // Content filtering
    if (event.content.includes('SPAM')) return false;
    
    // Time-based restrictions
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) return false; // Only during day
    
    // Event kind restrictions
    if (event.kind > 30000) return false; // No parameterized replaceable events
    
    // Client-specific permissions
    if (clientPubkey === 'trusted_client_pubkey') {
      return true; // Always allow trusted clients
    }
    
    // Tag-based filtering
    const mentions = event.tags.filter(tag => tag[0] === 'p');
    if (mentions.length > 10) return false; // Limit mentions
  }
  
  // Return null for default permission checking
  return null;
});

// Clear custom handler if needed
bunker.clearPermissionHandler();
```

### Connection String Generation

Generate connection strings programmatically:

```typescript
// Generate nostrconnect:// URL for clients
const connectionString = NostrRemoteSignerClient.generateConnectionString(
  clientPubkey,
  {
    relays: ['wss://relay1.example.com', 'wss://relay2.example.com'],
    secret: 'secure-random-secret',
    permissions: ['sign_event:1', 'get_public_key', 'nip44_encrypt'],
    name: 'My Nostr App',
    url: 'https://myapp.com',
    image: 'https://myapp.com/icon.png'
  }
);

// Generate bunker:// URL for bunkers  
const bunkerString = buildConnectionString({
  pubkey: signerPubkey,
  relays: ['wss://relay.example.com'],
  secret: 'optional-secret'
});
``` 