# NIP-47: Nostr Wallet Connect

This module implements the [NIP-47 (Nostr Wallet Connect)](https://github.com/nostr-protocol/nips/blob/master/47.md) protocol, which enables Nostr clients to access Lightning Network wallets through a standardized protocol.

## Overview

Nostr Wallet Connect (NWC) provides a secure way for applications to interact with remote lightning wallets through end-to-end encrypted direct messages over Nostr relays. This implementation includes:

1. **Client Implementation** - For applications that need to interact with a wallet
2. **Service Implementation** - For wallet services that need to respond to client requests
3. **Utility Functions** - For connection string generation and parsing

## Key Features

- `NostrWalletConnectClient`: The client-side implementation, used by applications to connect to a remote wallet service.
- `NostrWalletService`: The server-side implementation, used by wallet providers to implement the NWC protocol.
- `WalletImplementation`: Interface for wallet providers to implement the necessary wallet functionality.

## Standard NIP-47 Features

This implementation fully supports all features defined in the official [NIP-47 specification](https://github.com/nostr-protocol/nips/blob/master/47.md):

### Standard Methods

The following methods are part of the core NIP-47 specification:

- `get_info`: Get information about the wallet service
- `get_balance`: Get the wallet balance
- `pay_invoice`: Pay a Lightning invoice
- `make_invoice`: Create a Lightning invoice
- `lookup_invoice`: Look up an invoice
- `list_transactions`: List invoice and payment history
- `sign_message`: Sign a message

### Standard Notification Types

These notification types are defined in the NIP-47 specification:

- `payment_received`: Notification when a payment is received
- `payment_sent`: Notification when a payment is sent

### Standard Error Codes

The following error codes are part of the core NIP-47 specification:

- `UNAUTHORIZED`: The client is not authorized to perform the requested action
- `INVALID_REQUEST`: The request was malformed or missing required parameters
- `INSUFFICIENT_BALANCE`: Insufficient balance to complete the payment
- `PAYMENT_FAILED`: The payment failed for some other reason
- `INVOICE_EXPIRED`: The invoice has expired
- `NOT_FOUND`: The requested resource was not found in the wallet's database
  - Used by `lookupInvoice` when an invoice or payment hash cannot be found
  - The error message will indicate which specific parameter (payment_hash or invoice) was not found
- `INTERNAL_ERROR`: An internal error occurred in the wallet service
- `REQUEST_EXPIRED`: The request expired before it could be processed

### Standard Request Expiration

The implementation supports the request expiration feature as described in the NIP-47 specification. This allows clients to set an expiration timestamp on requests, after which the wallet service will automatically reject the request if it hasn't been processed yet.

## Extended Features (Implementation-Specific)

These features are extensions to the base NIP-47 specification and provide additional functionality not defined in the official spec:

### Extended Methods

The following methods are extensions not currently part of the standard NIP-47 specification:

- `pay_keysend`: Send a keysend payment (not standardized in NIP-47)
- `multi_pay_invoice`: Pay multiple invoices in a single request (not standardized in NIP-47)
- `multi_pay_keysend`: Send multiple keysend payments in a single request (not standardized in NIP-47)

### Client Authorization

To enhance security, the wallet service can be configured to only accept requests from specific authorized clients:

```typescript
// Create and initialize the service with authorized clients
const service = new NostrWalletService(
  {
    relays: ['wss://relay.example.com'],
    pubkey: serviceKeypair.publicKey,
    privkey: serviceKeypair.privateKey,
    methods: [...],
    // List of authorized client pubkeys
    authorizedClients: ['client_pubkey_1', 'client_pubkey_2']
  },
  new MyWalletImplementation()
);
```

When the `authorizedClients` option is provided, any requests from clients whose pubkey is not in the list will be rejected with an `UNAUTHORIZED_CLIENT` error. This provides an additional layer of security by ensuring that only trusted clients can interact with the wallet service.

If `authorizedClients` is not provided or is an empty array, all clients will be authorized to use the service (not recommended for production environments).

### Extended Error Codes

In addition to the standard NIP-47 error codes, this implementation provides additional error codes for more specific error handling:

**Extended error codes (implementation-specific):**
- `REQUEST_EXPIRED`: The request has expired before it could be processed
- `TIMEOUT`: The request timed out waiting for a response
- `UNAUTHORIZED_CLIENT`: The client's public key is not in the list of authorized clients

## Connection Details

NWC uses specialized URIs in the format: `nostr+walletconnect://{pubkey}?relay={relay}&secret={secret}`. This implementation includes utilities for generating and parsing these URIs.

## Client Usage

```typescript
import { 
  NostrWalletConnectClient, 
  parseNWCURL,
  NIP47Method,
  NIP47NotificationType
} from 'snstr';

// Parse NWC URL (for example, scanned from a QR code)
const connectionOptions = parseNWCURL('nostr+walletconnect://...');

// Create and initialize client
const client = new NostrWalletConnectClient(connectionOptions);
await client.init();

// Subscribe to notifications
client.onNotification(NIP47NotificationType.PAYMENT_RECEIVED, (notification) => {
  console.log('Payment received:', notification);
});

// Check wallet balance
const balance = await client.getBalance();
console.log(`Wallet balance: ${balance} msats`);

// Create an invoice
const invoice = await client.makeInvoice(1000, 'Test payment');
console.log(`Created invoice: ${invoice.invoice}`);

// Pay an invoice
const payment = await client.payInvoice('lnbc...');
console.log(`Payment sent with preimage: ${payment.preimage}`);

// List transactions
const txList = await client.listTransactions({ limit: 10 });
console.log(`Recent transactions:`, txList.transactions);

// Using request expiration
// Set expiration timestamp in seconds (30 seconds from now)
const expirationTime = Math.floor(Date.now() / 1000) + 30;
try {
  const balance = await client.getBalance({ expiration: expirationTime });
  console.log(`Wallet balance: ${balance} msats`);
} catch (error) {
  if (error.code === 'REQUEST_EXPIRED') {
    console.error('Request expired before it could be processed');
  } else {
    console.error(`Error: ${error.message} (${error.code})`);
  }
}
```

## Service Implementation

```typescript
import { 
  NostrWalletService,
  WalletImplementation,
  NIP47Method,
  NIP47NotificationType
} from 'snstr';
import { generateKeypair } from 'snstr';

// Create a service keypair
const serviceKeypair = await generateKeypair();

// Implement wallet functionality
class MyWalletImplementation implements WalletImplementation {
  // Implement required methods
  async getInfo() { /* ... */ }
  async getBalance() { /* ... */ }
  async payInvoice(invoice, amount, maxfee) { /* ... */ }
  // ... other methods
}

// Create and initialize the service
const service = new NostrWalletService(
  {
    relays: ['wss://relay.example.com'],
    pubkey: serviceKeypair.publicKey,
    privkey: serviceKeypair.privateKey,
    methods: [
      NIP47Method.GET_INFO,
      NIP47Method.GET_BALANCE,
      NIP47Method.PAY_INVOICE,
      // ... other supported methods
    ],
    notificationTypes: [
      NIP47NotificationType.PAYMENT_RECEIVED,
      NIP47NotificationType.PAYMENT_SENT
    ]
  },
  new MyWalletImplementation()
);

await service.init();

// Send a notification to a client (e.g., when a payment is received)
await service.sendNotification(
  clientPubkey,
  NIP47NotificationType.PAYMENT_RECEIVED,
  {
    type: 'incoming',
    invoice: 'lnbc...',
    payment_hash: '...',
    amount: 10000,
    created_at: Math.floor(Date.now() / 1000),
    settled_at: Math.floor(Date.now() / 1000)
  }
);
```

## Error Handling

The implementation includes comprehensive error handling with standardized error codes and enhanced error management features. When an error occurs, a `NIP47ClientError` is thrown with structured information:

- **Error Code**: Specific code identifying the error type
- **Error Category**: Broader classification for error grouping
- **Recovery Hint**: Suggestion for how to resolve the error
- **Additional Data**: Context-specific error details

### Extended Error Codes

This implementation provides additional error codes for more specific error handling:

**Network-related errors:**
- `TIMEOUT`: The request timed out waiting for a response
- `CONNECTION_ERROR`: Failed to connect to relay
- `RELAY_ERROR`: Error communicating with relay
- `PUBLISH_FAILED`: Failed to publish event to relay
- `ENCRYPTION_ERROR`: Error during encryption
- `DECRYPTION_ERROR`: Error during decryption

**Authorization errors:**
- `UNAUTHORIZED_CLIENT`: The client's public key is not authorized

**Validation errors:**
- `INVALID_INVOICE_FORMAT`: The invoice format is invalid
- `INVALID_AMOUNT`: The amount is invalid
- `INVALID_PARAMETER`: One or more parameters are invalid

**Payment errors:**
- `PAYMENT_ROUTE_NOT_FOUND`: No route found for payment
- `PAYMENT_REJECTED`: Payment was rejected

**Wallet errors:**
- `WALLET_LOCKED`: Wallet is locked
- `WALLET_UNAVAILABLE`: Wallet is currently unavailable

### Error Categories

Errors are organized into the following categories for easier handling:

- `AUTHORIZATION`: Permission/authentication errors
- `VALIDATION`: Input validation errors
- `RESOURCE`: Resource availability errors
- `NETWORK`: Network/communication errors
- `WALLET`: Wallet-specific errors
- `TIMEOUT`: Timeout-related errors
- `INTERNAL`: Internal/system errors

### Early Rejection Handling

For early-reject scenarios (like expired requests or unauthorized clients), where the actual method being requested is unknown because the message hasn't been decrypted yet, the implementation uses a special `UNKNOWN` method type for the `result_type` field. This ensures spec compliance by:

1. Never guessing or using an unrelated method for the `result_type`
2. Providing a consistent way for clients to handle these special error cases
3. Protecting against potential replay attacks by making it clear this is an authentication/authorization rejection

This approach is superior to using a placeholder method like `GET_INFO`, which could confuse clients or hide replay attacks.

### Error Handling Example

```typescript
try {
  await client.payInvoice('lnbc...');
} catch (error) {
  if (error instanceof NIP47ClientError) {
    // Use error category for general error handling
    switch (error.category) {
      case 'NETWORK':
        console.error(`Network error occurred: ${error.getUserMessage()}`);
        break;
      case 'WALLET':
        console.error(`Wallet error: ${error.getUserMessage()}`);
        break;
      default:
        console.error(`Error: ${error.getUserMessage()}`);
    }
    
    // Check for specific error codes when needed
    if (error.code === NIP47ErrorCode.INSUFFICIENT_BALANCE) {
      // Handle insufficient balance specifically
    }
    
    // Check if the error is retriable
    if (error.isRetriable()) {
      console.log('This operation can be retried');
    }
  } else {
    console.error(`Unexpected error: ${error.message}`);
  }
}
```

### NOT_FOUND Error Example

Here's an example of handling the `NOT_FOUND` error code specifically for the `lookupInvoice` method:

```typescript
try {
  // Try to look up an invoice by payment hash
  const invoiceInfo = await client.lookupInvoice({
    payment_hash: 'ab123...'
  });
  console.log('Found invoice:', invoiceInfo);
} catch (error) {
  if (error instanceof NIP47ClientError) {
    if (error.code === NIP47ErrorCode.NOT_FOUND) {
      console.error('Invoice lookup failed: The specified payment hash was not found in the wallet database');
      // Handle the case of a missing invoice appropriately
      // For example, you might want to:
      // 1. Create a new invoice
      // 2. Show a user-friendly message
      // 3. Check if a different payment hash would work
    } else if (error.code === NIP47ErrorCode.INVALID_REQUEST) {
      console.error('Invalid request parameters');
    } else {
      console.error(`Lookup failed: ${error.getUserMessage()}`);
    }
  } else {
    console.error(`Unexpected error: ${error.message}`);
  }
}
```

### Automatic Retry

The client includes a built-in retry mechanism for errors that are considered retriable (network errors, timeouts, temporarily unavailable services):

```typescript
// Use the withRetry method for any operation
try {
  const balance = await client.withRetry(() => client.getBalance());
  console.log(`Balance: ${balance}`);
} catch (error) {
  // Will only be thrown after all retry attempts have been exhausted
  console.error(`Error after retries: ${error.getUserMessage()}`);
}

// Or use convenience methods with built-in retry
const balance = await client.getBalanceWithRetry({
  retry: {
    maxRetries: 5,      // Maximum number of retry attempts
    initialDelay: 500,  // Initial delay in ms
    maxDelay: 30000,    // Maximum delay in ms
    factor: 2           // Exponential backoff factor
  }
});
```

## Security Considerations

- The connection secret is used as the client's private key and should be generated securely
- All communication between client and service is E2E encrypted using NIP-04
- The user's identity key is not used, avoiding linking payment activity to the user's identity
- Request expiration helps prevent replay attacks by limiting the time window in which a request is valid 

## Feature Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| **Standard Methods** | | |
| get_info | ✅ Implemented | Returns service information and capabilities |
| get_balance | ✅ Implemented | Returns wallet balance in msats |
| pay_invoice | ✅ Implemented | Pays a Lightning invoice |
| make_invoice | ✅ Implemented | Creates a Lightning invoice |
| lookup_invoice | ✅ Implemented | Looks up invoice by payment hash or invoice string |
| list_transactions | ✅ Implemented | Lists transaction history with filtering options |
| sign_message | ✅ Implemented | Signs a message with the wallet's private key |
| **Event Kinds** | | |
| INFO (13194) | ✅ Implemented | Advertises wallet capabilities |
| REQUEST (23194) | ✅ Implemented | Request from client to service |
| RESPONSE (23195) | ✅ Implemented | Response from service to client |
| NOTIFICATION (23196) | ✅ Implemented | Asynchronous notifications from service |
| **Notification Types** | | |
| payment_received | ✅ Implemented | Notification when payment is received |
| payment_sent | ✅ Implemented | Notification when payment is sent |
| **Standard Error Codes** | | |
| UNAUTHORIZED | ✅ Implemented | Authentication or permission error |
| INVALID_REQUEST | ✅ Implemented | Malformed or invalid request |
| INSUFFICIENT_BALANCE | ✅ Implemented | Not enough funds to complete payment |
| PAYMENT_FAILED | ✅ Implemented | Payment failed for another reason |
| INVOICE_EXPIRED | ✅ Implemented | Invoice has expired |
| NOT_FOUND | ✅ Implemented | Resource not found in wallet database |
| INTERNAL_ERROR | ✅ Implemented | Internal server error |
| REQUEST_EXPIRED | ✅ Implemented | Request expired before processing |
| **Extended Features** | | |
| pay_keysend | ❌ Not Implemented | Extension: Non-standard keysend payments |
| multi_pay_invoice | ❌ Not Implemented | Extension: Batch invoice payments |
| multi_pay_keysend | ❌ Not Implemented | Extension: Batch keysend payments |
| Automatic retries | ✅ Implemented | Built-in retry mechanism for transient errors |
| Client authorization | ✅ Implemented | Optional whitelist of authorized client pubkeys |
| Error categorization | ✅ Implemented | Enhanced error handling with categories |
| Recovery hints | ✅ Implemented | User-friendly recovery suggestions for errors |

**Note:** While the codebase contains type definitions for extended methods like `pay_keysend`, `multi_pay_invoice`, and `multi_pay_keysend`, these are not yet fully implemented in the current version.

## Version Compatibility

This implementation is designed to be compatible with:

- **Node.js**: v14.x and newer
- **Browser**: Modern browsers with support for ES2020+ features
- **Dependencies**:
  - Uses standard Nostr relay connections
  - Compatible with NIP-01 (Basic protocol) implementations
  - Compatible with NIP-04 (Encrypted Direct Messages) implementations

For compatibility with other NIP-47 implementations:
- Strictly follows the NIP-47 message format
- Extension methods are clearly marked and optional
- Response validation ensures spec compliance
- Error codes match the specification

## Troubleshooting

### Common Issues and Solutions

#### Connection Problems
- **Issue**: Client cannot connect to service
- **Solution**: Ensure relays are online and accessible to both client and service. Try multiple relays for redundancy.

#### Authentication Errors
- **Issue**: `UNAUTHORIZED` or `UNAUTHORIZED_CLIENT` errors
- **Solution**: Verify the connection secret is correct and that the client pubkey is in the service's authorized list (if enabled).

#### Request Timeouts
- **Issue**: Requests time out without response
- **Solution**: 
  - Check network connectivity
  - Ensure service is online and subscribed to the relays
  - Try increasing request timeout value
  - Use the built-in retry mechanism: `client.getBalanceWithRetry()`

#### Invoice Payment Issues
- **Issue**: `PAYMENT_FAILED` when paying invoices
- **Solution**: 
  - Check if invoice has expired (`INVOICE_EXPIRED`)
  - Verify sufficient balance (`INSUFFICIENT_BALANCE`)
  - Check if route exists to destination (`PAYMENT_ROUTE_NOT_FOUND`)
  - Try with a lower amount or different invoice

#### Invoice Lookup Failures
- **Issue**: `NOT_FOUND` when looking up invoices
- **Solution**: Verify the payment hash or invoice string is correct. Note that invoices may be purged from the database after a certain time.

#### Error Handling Best Practices
- Use error categories for general error handling
- Check specific error codes for precise handling of known issues
- Use the `isRetriable()` method to determine if errors can be retried
- Leverage the built-in retry mechanism for transient errors

#### Debug Logging
To enable debug logging for troubleshooting:

```typescript
// In client initialization:
const client = new NostrWalletConnectClient({
  // connection options
});

// Set debug level on the underlying Nostr client
client.getNostrClient().setLogLevel('debug');
```

## NIP-47 Compliance Statement

This implementation **fully supports** all features defined in the official [NIP-47 specification](https://github.com/nostr-protocol/nips/blob/master/47.md). In addition, it provides several extensions and enhancements that are not part of the standard specification.

- **Core Specification Features**: All event kinds, standard methods, notification types, error codes, and message formats defined in NIP-47 are implemented according to the specification.
- **Response Structure Validation**: Strict validation enforces adherence to the NIP-47 message format specification, ensuring proper `result_type`, `error`, and `result` fields in all responses.
- **Extension Features**: Several additional methods, error codes, and features (clearly marked below) have been added to enhance functionality while maintaining backward compatibility.

When developing with this library, be aware of which features are part of the standard specification and which are extensions to ensure interoperability with other NIP-47 implementations. 