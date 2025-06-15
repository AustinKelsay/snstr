# NIP-66: Relay Discovery and Liveness Monitoring Examples

This directory contains examples for [NIP-66: Relay Discovery and Liveness Monitoring](https://github.com/nostr-protocol/nips/blob/master/66.md).

## Overview

NIP-66 defines two event kinds for relay discovery and monitoring:
- **Kind 10166**: Relay discovery events that announce relay metadata
- **Kind 10166**: Relay monitor announcements that track relay availability

## Running the Examples

```bash
npm run example:nip66
```

## Example Features

### Relay Discovery (`nip66-demo.ts`)
- Creating relay discovery events with metadata
- Parsing relay discovery event tags
- Extracting relay URLs and capabilities
- Working with relay metadata like supported NIPs

### Key Concepts Demonstrated

1. **Relay Discovery Events**: Creating events that announce relay existence and capabilities
2. **Monitor Announcements**: Events that track relay uptime and availability
3. **Metadata Parsing**: Extracting structured data from discovery events
4. **Relay Monitoring**: Tools for tracking relay health and performance

## API Functions Used

- `createRelayDiscoveryEvent()` - Create a relay discovery announcement
- `parseRelayDiscoveryEvent()` - Parse discovery event data
- `createRelayMonitorAnnouncement()` - Create monitor status updates
- `parseRelayMonitorAnnouncement()` - Parse monitor data

## Use Cases

- **Relay Discovery**: Helping clients find available relays
- **Network Monitoring**: Tracking relay health across the network
- **Load Balancing**: Distributing traffic based on relay capabilities
- **Quality Metrics**: Measuring relay performance and reliability

## Security Considerations

- Validate relay URLs before connecting
- Be cautious with monitor data that could be manipulated
- Verify relay capabilities through direct testing
- Rate limit discovery requests to prevent spam

## Related

- [NIP-01 Examples](../nip01/) - Basic event handling
- [NIP-11 Examples](../nip11/) - Relay information documents
- [NIP-66 Implementation](../../src/nip66/) - Source code
- [NIP-66 Tests](../../tests/nip66/) - Test suite 