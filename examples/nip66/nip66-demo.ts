import {
  createRelayDiscoveryEvent,
  createRelayMonitorAnnouncement,
  parseRelayDiscoveryEvent,
  RELAY_DISCOVERY_KIND,
  RELAY_MONITOR_KIND,
} from '../../src/nip66';
import { generateKeypair } from '../../src/utils/crypto';
import { createSignedEvent } from '../../src/nip01/event';

async function main() {
  const keys = await generateKeypair();

  const discovery = createRelayDiscoveryEvent(
    {
      relay: 'wss://relay.example.com',
      network: 'clearnet',
      supportedNips: [1, 11],
      rttOpen: 123,
    },
    keys.publicKey,
  );

  const signedDiscovery = await createSignedEvent(discovery, keys.privateKey);
  console.log('Discovery kind:', signedDiscovery.kind === RELAY_DISCOVERY_KIND);

  const parsed = parseRelayDiscoveryEvent(signedDiscovery);
  console.log('Relay URL:', parsed?.relay);

  const announce = createRelayMonitorAnnouncement(
    {
      frequency: 3600,
      checks: ['ws', 'nip11'],
    },
    keys.publicKey,
  );

  const signedAnnounce = await createSignedEvent(announce, keys.privateKey);
  console.log('Announcement kind:', signedAnnounce.kind === RELAY_MONITOR_KIND);
}

main().catch((e) => console.error(e));
