# NIP-11: Relay Information Document

Implementation of [NIP-11: Relay Information Document](https://github.com/nostr-protocol/nips/blob/master/11.md)

## Overview

NIP-11 defines a standard way for relays to publish information about their capabilities, limitations, and other metadata. This information is provided as a JSON document when accessing a relay via HTTP with a specific Accept header.

## Key Features

- Fetch relay information document with proper headers
- Type definitions for relay metadata structure
- Helper functions for checking NIP support
- Payment information retrieval

## Basic Usage

### Fetching Relay Information

```typescript
import { fetchRelayInformation } from 'snstr/nip11';

async function getRelayInfo() {
  const relayInfo = await fetchRelayInformation('wss://relay.example.com');
  
  if (relayInfo) {
    console.log('Relay name:', relayInfo.name);
    console.log('Supported NIPs:', relayInfo.supported_nips);
    console.log('Limitations:', relayInfo.limitation);
  } else {
    console.log('Relay does not support NIP-11');
  }
}
```

### Example Relay Information Response

Here's an example of what the relay information JSON structure might look like:

```json
{
  "name": "Example Relay",
  "description": "A relay for development purposes",
  "pubkey": "32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245",
  "contact": "admin@example.com",
  "supported_nips": [1, 2, 4, 11, 15, 20],
  "software": "example-relay",
  "version": "1.0.0",
  "limitation": {
    "max_message_length": 16384,
    "max_subscriptions": 20,
    "max_filters": 10, 
    "max_limit": 1000,
    "payments_required": false,
    "restricted_writes": false
  },
  "fees": {
    "admission": [
      {
        "amount": 1000,
        "unit": "msats",
        "description": "One-time fee to publish events"
      }
    ],
    "subscription": [
      {
        "amount": 100,
        "unit": "msats",
        "period": 86400,
        "description": "Daily fee for event subscription"
      }
    ]
  },
  "payments_url": "https://relay.example.com/payments"
}
```

### Checking for NIP Support

```typescript
import { relaySupportsNIPs } from 'snstr/nip11';

async function checkRelayCompatibility() {
  // Check if relay supports NIP-01, NIP-02, and NIP-04
  const isCompatible = await relaySupportsNIPs('wss://relay.example.com', [1, 2, 4]);
  
  if (isCompatible) {
    console.log('Relay supports all required NIPs');
  } else {
    console.log('Relay is missing support for some required NIPs');
  }
}
```

### Getting Payment Information

```typescript
import { getRelayPaymentInfo, relayRequiresPayment } from 'snstr/nip11';

async function checkPaymentRequirements() {
  const requiresPayment = await relayRequiresPayment('wss://relay.example.com');
  
  if (requiresPayment) {
    const paymentUrl = await getRelayPaymentInfo('wss://relay.example.com');
    console.log('Payment required. More info at:', paymentUrl);
  } else {
    console.log('No payment required');
  }
}
```

### Working with Fee Schedules

```typescript
import { fetchRelayInformation, RelayFees } from 'snstr/nip11';

async function checkRelayFees() {
  const relayInfo = await fetchRelayInformation('wss://relay.example.com');
  
  if (relayInfo?.fees) {
    const { admission, subscription, publication } = relayInfo.fees;
    
    // Check one-time admission fees
    if (admission && admission.length > 0) {
      console.log('Admission fee:', admission[0].amount, admission[0].unit);
    }
    
    // Check subscription fees
    if (subscription && subscription.length > 0) {
      console.log('Subscription fee:', 
        subscription[0].amount, subscription[0].unit, 
        'per', subscription[0].period, 'seconds');
    }
  }
}
```

## Implementation Details

The implementation follows these steps:

1. Converts WebSocket URL to HTTP(S) URL
2. Makes a fetch request with the `Accept: application/nostr+json` header
3. Parses the JSON response into typed objects
4. Provides helper functions to extract common information

The implementation handles errors gracefully and returns `null` when information cannot be retrieved, which allows for fallback strategies in client applications.

## Error Handling

The implementation includes the following error handling behaviors:

- Returns `null` when a relay doesn't support NIP-11 (no document available)
- Times out requests after a configurable period (defaults to 5000ms)
- Validates WebSocket URLs before making requests
- Caches negative results to prevent repeated failed requests
- Logs errors to the console for debugging purposes
- Wraps network errors gracefully to prevent application crashes

Error behaviors can be controlled through optional parameters:
```typescript
// Custom timeout and cache behavior
const relayInfo = await fetchRelayInformation('wss://relay.example.com', {
  useCache: false,   // Skip cache and force fresh data
  timeoutMs: 10000   // Extended timeout (10 seconds)
});
```

## Security Considerations

- The implementation does not validate the integrity or authenticity of the relay information
- Clients should not blindly trust information provided by relays
- For relay payment URLs, clients should verify they are accessing trusted payment gateways

## Limitations

- The implementation assumes the relay is accessible via both WebSocket and HTTP(S) on the same domain and port
- Some relays may not support NIP-11 at all, which is handled by returning `null` 