# NIP-47: Nostr Wallet Connect Examples

This directory contains examples demonstrating the usage of SNSTR's implementation of [NIP-47](https://github.com/nostr-protocol/nips/blob/master/47.md), which defines a protocol for clients to access a remote lightning wallet through a standardized protocol.

## Examples

### Basic Client-Service Example

The [basic-client-service.ts](./basic-client-service.ts) demonstrates:
- Setting up a NIP-47 wallet service 
- Connecting a client to the service
- Basic wallet operations (get info, balance, etc.)
- Simple end-to-end workflow

Run it with:

```bash
npm run example:nip47:basic
```

### Error Handling and Retry Example

The [error-handling-example.ts](./error-handling-example.ts) demonstrates:
- Different error types and categories
- Handling specific errors (unauthorized, insufficient balance, etc.)
- Enhanced NOT_FOUND error handling for lookupInvoice
- Using the retry mechanism for transient errors
- Error recovery suggestions

Run it with:

```bash
npm run example:nip47:errors
```

### Request Expiration Example

The [request-expiration-example.ts](./request-expiration-example.ts) demonstrates:
- Setting expiration timestamps on requests
- Handling expired requests
- Best practices for expiration times

Run it with:

```bash
npm run example:nip47:expiration
```

### Notifications Example

The [notifications-example.ts](./notifications-example.ts) demonstrates:
- Setting up notification subscriptions
- Handling payment received/sent notifications
- Custom notification handling

Run it with:

```bash
npm run example:nip47:notifications
```

### Custom Wallet Implementation

The [custom-wallet-implementation.ts](./custom-wallet-implementation.ts) demonstrates:
- Creating a custom wallet implementation
- Connecting to an external Lightning node/wallet
- Advanced configuration options

Run it with:

```bash
npm run example:nip47:custom
```

## What is NIP-47?

NIP-47 (Nostr Wallet Connect) defines a standardized way for Nostr clients to interact with Lightning Network wallets using end-to-end encrypted direct messages over Nostr relays. It uses four event kinds:

1. **Info Event (kind 13194)**: Published by wallet services to advertise their capabilities
2. **Request Event (kind 23194)**: Sent by clients to request wallet operations
3. **Response Event (kind 23195)**: Sent by wallet services in response to requests
4. **Notification Event (kind 23196)**: Sent by wallet services to notify clients of wallet events

## Protocol Flow

1. User connects to a wallet service using a connection URI (nostr+walletconnect://{pubkey}?relay={relay}&secret={secret})
2. Client subscribes to events from the wallet service
3. Client sends encrypted requests to the wallet service
4. Wallet service processes requests and sends encrypted responses
5. Wallet service may send notifications for relevant events (payments received, etc.)

## Security Features

- All communication is end-to-end encrypted using NIP-04
- The user's identity key is not used, avoiding linking payment activity to the user
- Request expiration prevents replay attacks
- Authorized client lists can restrict which clients can use the service

## Implementation Extensions

This implementation includes several extensions beyond the basic NIP-47 spec:

- Additional methods like `pay_keysend`, `multi_pay_invoice`, etc.
- Enhanced error handling with categories and recovery hints
- Improved parameter validation and specific error handling for standard methods
- Dedicated NOT_FOUND error handling for lookupInvoice with context and recovery hints
- Automatic retry mechanism for transient errors
- Periodic INFO event republishing for better service discovery
- Clear categorization of errors into RESOURCE, VALIDATION, AUTHORIZATION, etc. types 