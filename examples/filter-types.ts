/**
 * Filter Types Example
 * 
 * This example demonstrates the enhanced filter types that support all standard tag filters from NIP-01.
 * Key concepts:
 * - Using type-safe tag filters for common tags like #t, #d, #a, etc.
 * - Combining multiple tag filters in a single query
 * - Working with addressable events using d-tag filtering
 * 
 * How to run:
 * npm run example:filter-types
 */

import { Nostr, NostrFilter, Filter } from '../src';
import { NostrRelay } from '../src/utils/ephemeral-relay';
import { generateKeypair } from '../src/utils/crypto';
import { createSignedEvent } from '../src/utils/event';

async function main() {
  console.log('Starting Filter Types Example');
  
  // Start an ephemeral relay for testing
  const ephemeralRelay = new NostrRelay(3700);
  await ephemeralRelay.start();
  console.log(`Started ephemeral relay at ${ephemeralRelay.url}`);
  
  // Create a client
  const client = new Nostr([ephemeralRelay.url]);
  await client.connectToRelays();
  console.log('Connected to relay');
  
  // Generate keypair for creating events
  const keys = await generateKeypair();
  client.setPrivateKey(keys.privateKey);
  console.log(`Using public key: ${keys.publicKey}`);
  
  // Create and publish events with various tags
  console.log('\nCreating and publishing events with various tags...');
  
  // Event with topic (#t) tags
  const topicEvent = await createSignedEvent({
    pubkey: keys.publicKey,
    kind: 1,
    content: "Event with topics",
    tags: [
      ["t", "bitcoin"],
      ["t", "nostr"],
      ["t", "programming"]
    ],
    created_at: Math.floor(Date.now() / 1000)
  }, keys.privateKey);
  await client.publishEvent(topicEvent);
  console.log('Published event with topic tags');
  
  // Event with geohash (#g) tag
  const geohashEvent = await createSignedEvent({
    pubkey: keys.publicKey,
    kind: 1,
    content: "Event with geohash",
    tags: [
      ["g", "u4pruydqqvj"], // Example geohash
      ["t", "location"]
    ],
    created_at: Math.floor(Date.now() / 1000)
  }, keys.privateKey);
  await client.publishEvent(geohashEvent);
  console.log('Published event with geohash tag');
  
  // Event with reference (#r) tag
  const referenceEvent = await createSignedEvent({
    pubkey: keys.publicKey,
    kind: 1,
    content: "Event with reference",
    tags: [
      ["r", "https://github.com/nostr-protocol/nips/blob/master/01.md"],
      ["t", "documentation"]
    ],
    created_at: Math.floor(Date.now() / 1000)
  }, keys.privateKey);
  await client.publishEvent(referenceEvent);
  console.log('Published event with reference tag');
  
  // Event with address (#a) tag
  const addressEvent = await createSignedEvent({
    pubkey: keys.publicKey,
    kind: 1, 
    content: "Event with address tag",
    tags: [
      ["a", "30023:pubkey:d-identifier"],
      ["t", "address"]
    ],
    created_at: Math.floor(Date.now() / 1000)
  }, keys.privateKey);
  await client.publishEvent(addressEvent);
  console.log('Published event with address tag');
  
  // Addressable event with d-tag
  const addressableEvent = await createSignedEvent({
    pubkey: keys.publicKey,
    kind: 30023, // Long-form content
    content: "This is a long-form article about Nostr",
    tags: [
      ["d", "my-first-article"],
      ["title", "Understanding Nostr"],
      ["published_at", `${Math.floor(Date.now() / 1000)}`],
      ["t", "nostr"],
      ["t", "tutorial"]
    ],
    created_at: Math.floor(Date.now() / 1000)
  }, keys.privateKey);
  await client.publishEvent(addressableEvent);
  console.log('Published addressable event with d-tag');
  
  // Wait a bit for events to be processed
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Now demonstrate filter usage
  console.log('\nDemonstrating various filter types:');
  
  // Example 1: Use topic filter
  console.log('\nExample 1: Filter events by topic tag (#t)');
  const topicFilter: NostrFilter = {
    "#t": ["nostr"],
    kinds: [1, 30023]
  };
  await runFilterExample(client, topicFilter, 'Events with #t=nostr');
  
  // Example 2: Use geohash filter
  console.log('\nExample 2: Filter events by geohash tag (#g)');
  const geohashFilter: NostrFilter = {
    "#g": ["u4pruydqqvj"]
  };
  await runFilterExample(client, geohashFilter, 'Events with geohash');
  
  // Example 3: Use reference filter
  console.log('\nExample 3: Filter events by reference tag (#r)');
  const referenceFilter: NostrFilter = {
    "#r": ["https://github.com/nostr-protocol/nips/blob/master/01.md"]
  };
  await runFilterExample(client, referenceFilter, 'Events with reference to NIP-01');
  
  // Example 4: Query addressable events by d-tag
  console.log('\nExample 4: Filter addressable events by d-tag (#d)');
  const dTagFilter: NostrFilter = {
    kinds: [30023],
    "#d": ["my-first-article"]
  };
  await runFilterExample(client, dTagFilter, 'Addressable events with d-tag=my-first-article');
  
  // Example 5: Combine multiple tag filters
  console.log('\nExample 5: Filter using multiple tag types');
  const combinedFilter: Filter = {
    "#t": ["nostr"],
    kinds: [30023],
    authors: [keys.publicKey]
  };
  await runFilterExample(client, combinedFilter, 'Events with #t=nostr, kind=30023, by our author');
  
  // Example 6: Use a custom tag filter with the indexer
  console.log('\nExample 6: Filter using custom tag (#title)');
  const customFilter: Filter = {
    kinds: [30023],
    "#title": ["Understanding Nostr"]
  };
  await runFilterExample(client, customFilter, 'Events with title=Understanding Nostr');
  
  // Cleanup
  client.disconnectFromRelays();
  await ephemeralRelay.close();
  console.log('\nExample completed. Cleaned up resources.');
}

// Helper function to run and display results of a filter
async function runFilterExample(client: Nostr, filter: NostrFilter, description: string): Promise<void> {
  return new Promise((resolve) => {
    const events: any[] = [];
    
    // Subscribe to the filter
    const subIds = client.subscribe(
      [filter],
      (event) => {
        events.push(event);
      },
      () => {
        // EOSE handler
        console.log(`Found ${events.length} ${description}:`);
        
        if (events.length > 0) {
          // Display content and some key tags for each event
          events.forEach(event => {
            console.log(`- Kind ${event.kind}, Content: "${event.content.substring(0, 40)}${event.content.length > 40 ? '...' : ''}"`);
            console.log(`  Tags: ${JSON.stringify(event.tags.slice(0, 2))}${event.tags.length > 2 ? ' ...' : ''}`);
          });
        } else {
          console.log('  No matching events found');
        }
        
        // Unsubscribe and resolve
        client.unsubscribe(subIds);
        resolve();
      }
    );
  });
}

main().catch(console.error); 