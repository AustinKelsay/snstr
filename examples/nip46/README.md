# NIP-46 Remote Signing

## Overview

NIP-46 is a protocol that enables remote signing of Nostr events, allowing separation of private keys (in a "bunker") from client applications while maintaining security through encrypted communication.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for diagrams and a visual explanation of how NIP-46 works.

## Key Concepts

- **Bunker**: A secure server that holds private keys and signs events on request
- **Client**: An application that requests signatures from the bunker
- **User Keypair**: The identity keypair used to sign Nostr events
- **Signer Keypair**: The keypair used for encrypted communication between client and bunker
- **Connection String**: Format `bunker://{signer_pubkey}?relay={relay_url}`

## Examples

### Unified Example (`unified-example.ts`) - RECOMMENDED

A single comprehensive example that shows the core functionality:

```bash
npm run example:nip46
```

Key features demonstrated:
- Setting up a bunker with proper permissions
- Connecting a client to the bunker
- Remotely signing events
- Verifying signatures

### Other Examples

For specific use cases or educational purposes:

1. **Minimal** (`minimal.ts`): The most basic functionality
2. **Advanced** (`advanced/`): More complex features including auth challenges
3. **From Scratch** (`from-scratch/`): Implementation without using library classes

## Implementation Details

This library provides two implementations:

1. **Simple Implementation** (`SimpleNIP46Client` / `SimpleNIP46Bunker`)
   - Lightweight with core functionality
   - Uses NIP-04 encryption only
   - Basic permissions support

2. **Full-featured Implementation** (`NostrRemoteSignerClient` / `NostrRemoteSignerBunker`)
   - Advanced features including auth challenges
   - Supports both NIP-04 and NIP-44 encryption
   - Extensive permissions system and metadata

## Best Practices

- Always use `await` with `verifySignature` as it returns a Promise
- Be explicit about allowed permissions when setting up a bunker
- Use separate keypairs for user identity and signer communication in production
- Store private keys securely in real applications

## Specification

For full details, see [NIP-46 Specification](https://github.com/nostr-protocol/nips/blob/master/46.md).

## Security Logging Configuration

NIP-46 includes comprehensive security event logging to help monitor and debug security issues. By default, security logging is disabled in test environments but can be configured for production use.

```typescript
import { SecureErrorHandler, Logger, LogLevel } from "../../src/nip46";

// Enable security logging with default configuration
SecureErrorHandler.setSecurityLoggingEnabled(true);

// Or initialize with a custom logger
const securityLogger = new Logger({
  prefix: "SECURITY-MONITOR",
  level: LogLevel.WARN,
  includeTimestamp: true,
  silent: false
});

SecureErrorHandler.initializeSecurityLogging(securityLogger, true);

// Security events will now be logged automatically when validation errors occur
// For example, when connection strings fail to parse or when invalid requests are received

// Check if security logging is enabled
if (SecureErrorHandler.isSecurityLoggingEnabled()) {
  console.log("Security monitoring is active");
}

// Manually log security events (with automatic sensitive data redaction)
SecureErrorHandler.logSecurityEvent(
  "Custom security event",
  {
    clientPubkey: "abc123...",
    privateKey: "sensitive-key", // This will be redacted
    timestamp: Date.now()
  },
  ["privateKey"] // Fields to redact
);
```

### Security Logging Features

- **Automatic sensitive data redaction**: Private keys and other sensitive fields are automatically masked
- **Configurable logging levels**: Use different log levels for different environments
- **Production-ready**: Designed to provide security visibility without exposing sensitive information
- **Integration with existing Logger**: Uses the same logging infrastructure as other NIP-46 components
- **Performance optimized**: Minimal overhead when logging is disabled

### Environment Configuration

```typescript
// Typical production setup
if (process.env.NODE_ENV === 'production') {
  const productionLogger = new Logger({
    prefix: "NIP46-SECURITY",
    level: LogLevel.WARN,
    includeTimestamp: true,
    silent: false
  });
  
  SecureErrorHandler.initializeSecurityLogging(productionLogger, true);
} else {
  // Development or testing - security logging disabled by default
  SecureErrorHandler.setSecurityLoggingEnabled(false);
}
``` 