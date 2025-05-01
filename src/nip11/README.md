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

## Implementation Details

The implementation follows these steps:

1. Converts WebSocket URL to HTTP(S) URL
2. Makes a fetch request with the `Accept: application/nostr+json` header
3. Parses the JSON response into typed objects
4. Provides helper functions to extract common information

The implementation handles errors gracefully and returns `null` when information cannot be retrieved, which allows for fallback strategies in client applications.

## Security Considerations

- The implementation does not validate the integrity or authenticity of the relay information
- Clients should not blindly trust information provided by relays
- For relay payment URLs, clients should verify they are accessing trusted payment gateways

## Limitations

- The implementation assumes the relay is accessible via both WebSocket and HTTP(S) on the same domain and port
- Some relays may not support NIP-11 at all, which is handled by returning `null` 