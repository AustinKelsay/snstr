# NIP-66: Relay Discovery and Liveness Monitoring

This module implements [NIP-66](https://github.com/nostr-protocol/nips/blob/master/66.md),
which defines two event kinds used for announcing relay liveness and monitor
capabilities.

## Overview

NIP-66 introduces:

- **Relay Discovery (kind `30166`)** – an addressable event published by a
  monitor when a relay is online.
- **Relay Monitor Announcement (kind `10166`)** – a replaceable event describing
  a monitor and the frequency it publishes discovery events.

The implementation provides helpers for creating and parsing these events.

## Key Features

- 📡 Create relay discovery events with relevant tags
- 📈 Announce monitoring frequency and timeouts
- 🔍 Parse events into easy to use structures

## Basic Usage

```typescript
import {
  createRelayDiscoveryEvent,
  createRelayMonitorAnnouncement,
  RELAY_DISCOVERY_KIND,
  RELAY_MONITOR_KIND,
  parseRelayDiscoveryEvent,
  parseRelayMonitorAnnouncement,
} from 'snstr';
import { signEvent, generateKeypair } from 'snstr';

async function createAndSignDiscoveryEvent() {
  try {
    const keys = await generateKeypair();

    const discovery = createRelayDiscoveryEvent(
      {
        relay: 'wss://relay.example.com',
        network: 'clearnet',
        supportedNips: [1, 11],
        rttOpen: 150,
      },
      keys.publicKey,
    );

    const signed = await signEvent(discovery, keys.privateKey);
    console.log(signed.kind === RELAY_DISCOVERY_KIND); // true

    const parsed = parseRelayDiscoveryEvent(signed);
    console.log(parsed?.relay); // 'wss://relay.example.com' (safely accessed)
    
    if (parsed) {
      console.log('Relay discovery event parsed successfully');
      console.log('Supported NIPs:', parsed.supportedNips);
      console.log('RTT Open:', parsed.rttOpen);
    } else {
      console.error('Failed to parse relay discovery event');
    }
  } catch (error) {
    console.error('Error creating or signing discovery event:', error);
  }
}

// Call the async function
createAndSignDiscoveryEvent();
```

## Monitor Announcement Example

```typescript
async function createMonitorAnnouncement() {
  try {
    const keys = await generateKeypair();

    const announcement = createRelayMonitorAnnouncement(
      {
        frequency: 3600, // Monitor every hour
        timeouts: [
          { value: 5000, test: 'connect' },
          { value: 3000, test: 'read' },
        ],
        checks: ['ws', 'nip11', 'geo'],
        geohash: '9q8yy',
        content: 'Relay monitor for North America region',
      },
      keys.publicKey,
    );

    const signed = await signEvent(announcement, keys.privateKey);
    console.log(signed.kind === RELAY_MONITOR_KIND); // true

    const parsed = parseRelayMonitorAnnouncement(signed);
    
    if (parsed) {
      console.log('Monitor announcement parsed successfully');
      console.log('Frequency:', parsed.frequency, 'seconds');
      console.log('Checks:', parsed.checks);
      console.log('Timeouts:', parsed.timeouts);
    } else {
      console.error('Failed to parse monitor announcement');
    }
  } catch (error) {
    console.error('Error creating monitor announcement:', error);
  }
}

createMonitorAnnouncement();
```

## Implementation Details

The helper functions follow the specification closely. Optional tags such as
`n`, `T`, `N`, `R`, `t`, `k`, `g` and `rtt-*` are included only when values are
provided. Content may include the relay's NIP‑11 document or any custom string.
Parsing functions return structured objects for easier consumption by clients.

## Security Considerations

Clients should validate discovery events originate from trusted monitors and
handle potentially bogus data gracefully. Always fall back to direct relay
connections if no valid NIP‑66 information is found.
