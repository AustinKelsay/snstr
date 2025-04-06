# NIP-57: Lightning Zaps

This module implements [NIP-57](https://github.com/nostr-protocol/nips/blob/master/57.md), which defines a protocol for recording Lightning Network payments (zaps) on Nostr.

## Overview

NIP-57 defines two event types:
1. **Zap Request (kind 9734)**: Created by a sender to request a Lightning invoice from a recipient's LNURL server
2. **Zap Receipt (kind 9735)**: Created by a recipient's LNURL server after a successful payment

## Key Features

- 🔄 **Full Protocol Flow**: Complete implementation of the NIP-57 protocol flow
- ⚡ **Zap Requests/Receipts**: Create and validate zap events
- 🧾 **LNURL Integration**: Utilities for working with LNURL pay endpoints
- 💰 **Zap Splits**: Support for splitting zaps between multiple recipients
- ✅ **Validation**: Comprehensive verification of zap receipts
- 🔍 **Easy Querying**: Simple fetch/query methods for zap-related data
- 📊 **Stats**: Calculate total zap amounts and other statistics

## Ephemeral Relay

The library provides an in-memory relay implementation for testing and development:

```typescript
import { NostrRelay } from 'snstr/utils/ephemeral-relay';

// Create an ephemeral relay on port 3000
// Optional: purge events every 60 seconds
const relay = new NostrRelay(3000, 60);
```

## Relay Tag Format

The NIP-57 spec requires a specific format for the `relays` tag in zap requests. According to the specification:

> `relays` is a list of relays the recipient's wallet should publish its `zap receipt` to. Note that relays should not be nested in an additional list, but should be included as shown in the example below.

This implementation follows the specification by storing all relay URLs in a single tag with `relays` as the first element:

```javascript
// Correct format (as implemented in this library)
[
  ["relays", "wss://relay1.example.com", "wss://relay2.example.com", "wss://relay3.example.com"]
]

// Incorrect format (do not do this)
[
  ["relays", ["wss://relay1.example.com", "wss://relay2.example.com", "wss://relay3.example.com"]]
]
```

When using the `createZapRequest` function, this format is correctly applied:

```typescript
const zapRequestTemplate = createZapRequest({
  recipientPubkey: 'recipient_pubkey_here',
  relays: [
    'wss://relay1.example.com',
    'wss://relay2.example.com'
  ],
  // other options...
}, 'sender_pubkey_here');

// In the resulting event, the relays tag will be:
// ["relays", "wss://relay1.example.com", "wss://relay2.example.com"]
```

This formatting is important for ensuring compatibility with other implementations of NIP-57.

## Basic Usage

### Using the NostrZapClient

The `NostrZapClient` provides a simple, high-level interface for working with zaps:

```typescript
import { Nostr, NostrZapClient } from 'snstr';

// Initialize Nostr client
const nostr = new Nostr(['wss://relay.example.com']);
await nostr.setPrivateKey('your_private_key');
await nostr.connectToRelays();

// Create zap client
const zapClient = new NostrZapClient({
  client: nostr,
  defaultRelays: ['wss://relay.example.com']
});

// Send a zap
const result = await zapClient.sendZap({
  recipientPubkey: 'recipient_pubkey',
  lnurl: 'recipient_lnurl',
  amount: 1000000, // 1000 sats in millisats
  comment: 'Great post!',
  eventId: 'event_id_to_zap' // optional
}, 'your_private_key');

if (result.success) {
  console.log(`Got invoice: ${result.invoice}`);
  // Pay invoice with a Lightning wallet
} else {
  console.error(`Error: ${result.error}`);
}

// Get zaps received by a user
const userZaps = await zapClient.fetchUserReceivedZaps('user_pubkey');

// Get total amount of zaps received
const stats = await zapClient.getTotalZapsReceived('user_pubkey');
console.log(`User received ${stats.total / 1000} sats across ${stats.count} zaps`);

// Get zaps for a specific event
const eventZaps = await zapClient.fetchEventZaps('event_id');
```

### Creating a Zap Request

```typescript
import { createZapRequest, signEvent } from 'snstr';

// Create a zap request
const zapRequestTemplate = createZapRequest({
  recipientPubkey: 'recipient_pubkey_here',
  eventId: 'event_being_zapped_here', // optional
  amount: 1000000, // 1000 sats in millisats
  relays: ['wss://relay.example.com'],
  content: 'Great post!' // Optional comment
}, 'sender_pubkey_here');

// Sign the request
const signedZapRequest = await signEvent(zapRequestTemplate, 'sender_private_key');
```

### Validating a Zap Receipt

```typescript
import { validateZapReceipt } from 'snstr';

// Check if a zap receipt is valid
const validationResult = validateZapReceipt(
  zapReceiptEvent, 
  'lnurl_server_pubkey'
);

if (validationResult.valid) {
  console.log(`Valid zap of ${validationResult.amount} millisats`);
  console.log(`From: ${validationResult.sender}`);
  console.log(`To: ${validationResult.recipient}`);
  if (validationResult.content) {
    console.log(`Comment: ${validationResult.content}`);
  }
} else {
  console.error(`Invalid zap: ${validationResult.message}`);
}
```

### Working with Zap Splits

```typescript
import { parseZapSplit, calculateZapSplitAmounts } from 'snstr';

// Parse zap split information from an event
const zapSplitInfo = parseZapSplit(someEvent);

// Calculate actual amounts based on weights
const zapAmounts = calculateZapSplitAmounts(1000000, zapSplitInfo);

// Output split information
zapAmounts.forEach(({ pubkey, relay, amount }) => {
  console.log(`Send ${amount} millisats to ${pubkey} via ${relay}`);
});
```

## Protocol Flow

1. Client gets LNURL pay info from recipient's profile or post
2. Client creates a zap request (kind 9734)
3. Client sends zap request to recipient's LNURL server
4. LNURL server returns a Lightning invoice
5. Client pays the invoice
6. LNURL server creates and publishes a zap receipt (kind 9735)
7. Client can validate the zap receipt and display it

## LNURL Integration

The NIP-57 implementation works with LNURL-pay endpoints that support Nostr zaps. It includes utilities for parsing LNURL responses and validating that an endpoint supports zaps.

## Implementation Details

This implementation adheres strictly to the NIP-57 specification, including:

- Proper validation of zap request/receipt events
- Support for anonymous zaps using the `P` tag
- Support for zapping parameterized replaceable events with the `a` tag
- Support for zap splitting according to weight specifications
- Detailed error reporting for validation failures
- Proper LNURL bech32 encoding/decoding

## Security Considerations

- Zap receipts are not cryptographic proofs of payment
- The recipient's LNURL server must be trusted to generate valid receipts
- Clients should validate that zap receipts come from the expected LNURL server 

## Examples

Check out the examples in the repository:

- `basic-example.ts`: Simple demonstration of zap requests and receipts
- `zap-client-example.ts`: Using the NostrZapClient for common zap operations
- `lnurl-server-simulation.ts`: Full simulation of LNURL server handling zap requests 