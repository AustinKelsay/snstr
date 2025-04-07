# NIP-47: Nostr Wallet Connect

This module implements the [NIP-47 (Nostr Wallet Connect)](https://github.com/nostr-protocol/nips/blob/master/47.md) protocol, which enables Nostr clients to access Lightning Network wallets through a standardized protocol.

## Overview

Nostr Wallet Connect (NWC) provides a secure way for applications to interact with remote lightning wallets through end-to-end encrypted direct messages over Nostr relays. This implementation includes:

1. **Client Implementation** - For applications that need to interact with a wallet
2. **Service Implementation** - For wallet services that need to respond to client requests
3. **Utility Functions** - For connection string generation and parsing

## Key Components

- `NostrWalletConnectClient`: The client-side implementation, used by applications to connect to a remote wallet service.
- `NostrWalletService`: The server-side implementation, used by wallet providers to implement the NWC protocol.
- `WalletImplementation`: Interface for wallet providers to implement the necessary wallet functionality.

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

## Supported Methods

The implementation supports all methods defined in the NIP-47 specification:

- `get_info`: Get information about the wallet service
- `get_balance`: Get the wallet balance
- `pay_invoice`: Pay a Lightning invoice
- `make_invoice`: Create a Lightning invoice
- `lookup_invoice`: Look up an invoice
- `list_transactions`: List invoice and payment history
- `sign_message`: Sign a message

## Notifications

The implementation supports the following notification types:

- `payment_received`: Notification when a payment is received
- `payment_sent`: Notification when a payment is sent

## Security Considerations

- The connection secret is used as the client's private key and should be generated securely
- All communication between client and service is E2E encrypted using NIP-04
- The user's identity key is not used, avoiding linking payment activity to the user's identity

## Error Handling

Requests can return the following error codes:

- `UNAUTHORIZED`: The client is not authorized to perform the requested action
- `INVALID_REQUEST`: The request was malformed or missing required parameters
- `INSUFFICIENT_BALANCE`: Insufficient balance to complete the payment
- `PAYMENT_FAILED`: The payment failed for some other reason
- `INVOICE_EXPIRED`: The invoice has expired
- `NOT_FOUND`: The requested resource was not found
- `INTERNAL_ERROR`: An internal error occurred in the wallet service 