/**
 * NIP-57 Lightning Zaps - ZapClient Example
 * 
 * This example demonstrates how to use the NostrZapClient for:
 * 1. Fetching zaps received by a user
 * 2. Calculating total zap amounts
 * 3. Working with zap splits
 * 
 * Note: This example uses a simulated environment and doesn't connect to real relays.
 */

import { 
  Nostr, 
  NostrEvent,
  generateKeypair,
  NostrZapClient,
  ZapFilterOptions,
  createZapRequest,
  createZapReceipt,
  parseZapSplit, 
  calculateZapSplitAmounts 
} from '../../src';

import { createSignedEvent, UnsignedEvent } from '../../src/utils/event';
import { NostrRelay } from '../../src/utils/ephemeral-relay';

async function main() {
  console.log('NIP-57 ZapClient Example');
  console.log('------------------------\n');

  // Set up an ephemeral relay for testing
  const relay = new NostrRelay(3000);
  await relay.start();
  console.log(`🔌 Ephemeral relay started at ${relay.url}\n`);

  // Generate keypairs for our example
  console.log('Generating keypairs...');
  const alice = await generateKeypair();
  const bob = await generateKeypair();
  const charlie = await generateKeypair();
  const lnurlServerKeypair = await generateKeypair();

  console.log(`🔑 Alice pubkey: ${alice.publicKey.slice(0, 8)}...`);
  console.log(`🔑 Bob pubkey: ${bob.publicKey.slice(0, 8)}...`);
  console.log(`🔑 Charlie pubkey: ${charlie.publicKey.slice(0, 8)}...`);
  console.log(`🔑 LNURL server pubkey: ${lnurlServerKeypair.publicKey.slice(0, 8)}...\n`);

  // Initialize a Nostr client for Alice
  const client = new Nostr([relay.url]);
  await client.setPrivateKey(alice.privateKey);
  await client.connectToRelays();
  console.log('✅ Connected to relay\n');

  // Create the ZapClient
  const zapClient = new NostrZapClient({
    client,
    defaultRelays: [relay.url]
  });

  // Create some notes for Bob and Charlie
  console.log('Creating test notes...');
  
  // Bob's regular note
  const bobNote = await createSignedEvent({
    kind: 1,
    content: "Bob's regular note",
    tags: [],
    pubkey: bob.publicKey,
    created_at: Math.floor(Date.now() / 1000 - 3600) // One hour ago
  }, bob.privateKey);
  
  // Charlie's note with zap split
  const charlieNote = await createSignedEvent({
    kind: 1,
    content: "Charlie's note with zap split",
    tags: [
      ['zap', bob.publicKey, relay.url, '1'],  // 25% to Bob
      ['zap', alice.publicKey, relay.url, '3'] // 75% to Alice
    ],
    pubkey: charlie.publicKey,
    created_at: Math.floor(Date.now() / 1000 - 1800) // 30 minutes ago
  }, charlie.privateKey);
  
  // Store the notes in the relay
  relay.store(bobNote);
  relay.store(charlieNote);
  console.log(`📝 Created Bob's note with ID: ${bobNote.id.slice(0, 8)}...`);
  console.log(`📝 Created Charlie's note with ID: ${charlieNote.id.slice(0, 8)}...\n`);

  // Generate simulated zap receipts
  console.log('Generating simulated zap receipts...');
  
  // Create zap receipts for Bob's note
  const zapRequests = [];
  
  // Alice zaps Bob's note
  const aliceZapRequest = await createSignedEvent({
    ...createZapRequest({
      recipientPubkey: bob.publicKey,
      eventId: bobNote.id,
      amount: 100000, // 100 sats
      relays: [relay.url],
      content: "Great post, Bob!"
    }, alice.publicKey),
    pubkey: alice.publicKey,
    created_at: Math.floor(Date.now() / 1000 - 3000) // 50 minutes ago
  }, alice.privateKey);
  
  const aliceZapReceipt = await createSignedEvent({
    ...createZapReceipt({
      recipientPubkey: bob.publicKey,
      eventId: bobNote.id,
      bolt11: 'lnbc100n1...',
      zapRequest: aliceZapRequest
    }, lnurlServerKeypair.publicKey),
    pubkey: lnurlServerKeypair.publicKey,
    created_at: Math.floor(Date.now() / 1000 - 2950) // 49 minutes ago
  }, lnurlServerKeypair.privateKey);
  
  // Charlie zaps Bob's note
  const charlieZapRequest = await createSignedEvent({
    ...createZapRequest({
      recipientPubkey: bob.publicKey,
      eventId: bobNote.id,
      amount: 200000, // 200 sats
      relays: [relay.url],
      content: "I agree with Alice!"
    }, charlie.publicKey),
    pubkey: charlie.publicKey,
    created_at: Math.floor(Date.now() / 1000 - 2400) // 40 minutes ago
  }, charlie.privateKey);
  
  const charlieZapReceipt = await createSignedEvent({
    ...createZapReceipt({
      recipientPubkey: bob.publicKey,
      eventId: bobNote.id,
      bolt11: 'lnbc200n1...',
      zapRequest: charlieZapRequest
    }, lnurlServerKeypair.publicKey),
    pubkey: lnurlServerKeypair.publicKey,
    created_at: Math.floor(Date.now() / 1000 - 2350) // 39 minutes ago
  }, lnurlServerKeypair.privateKey);

  // Alice zaps Charlie's note (which has zap split)
  const aliceZapRequest2 = await createSignedEvent({
    ...createZapRequest({
      recipientPubkey: charlie.publicKey,
      eventId: charlieNote.id,
      amount: 400000, // 400 sats
      relays: [relay.url],
      content: "Thanks for the split!"
    }, alice.publicKey),
    pubkey: alice.publicKey,
    created_at: Math.floor(Date.now() / 1000 - 1200) // 20 minutes ago
  }, alice.privateKey);
  
  const aliceZapReceipt2 = await createSignedEvent({
    ...createZapReceipt({
      recipientPubkey: charlie.publicKey,
      eventId: charlieNote.id,
      bolt11: 'lnbc400n1...',
      zapRequest: aliceZapRequest2
    }, lnurlServerKeypair.publicKey),
    pubkey: lnurlServerKeypair.publicKey,
    created_at: Math.floor(Date.now() / 1000 - 1150) // 19 minutes ago
  }, lnurlServerKeypair.privateKey);
  
  // Store all zap receipts in the relay
  relay.store(aliceZapReceipt);
  relay.store(charlieZapReceipt);
  relay.store(aliceZapReceipt2);
  
  console.log(`⚡ Stored 3 zap receipts in relay\n`);

  // Demonstrate zap client functionality
  console.log('Fetching zaps received by Bob...');
  const bobZaps = await zapClient.fetchUserReceivedZaps(bob.publicKey);
  console.log(`Found ${bobZaps.length} zaps received by Bob:`);
  
  for (const zap of bobZaps) {
    const validation = zapClient.validateZapReceipt(zap, lnurlServerKeypair.publicKey);
    if (validation.valid) {
      console.log(`  ✅ ${validation.amount} millisats from ${validation.sender?.slice(0, 8)}... with comment: ${validation.content}`);
    } else {
      console.log(`  ❌ Invalid zap: ${validation.message}`);
    }
  }
  
  // Calculate total zaps received
  const bobTotal = await zapClient.getTotalZapsReceived(bob.publicKey);
  console.log(`\nBob has received a total of ${bobTotal.total / 1000} sats across ${bobTotal.count} zaps\n`);
  
  // Demonstrate zap split functionality
  console.log('Analyzing zap split in Charlie\'s note...');
  const splitInfo = parseZapSplit(charlieNote);
  
  console.log('Zap split configuration:');
  let totalWeight = 0;
  for (const split of splitInfo) {
    totalWeight += split.weight;
  }
  
  for (const split of splitInfo) {
    const percentage = (split.weight / totalWeight) * 100;
    let name = 'Unknown';
    if (split.pubkey === alice.publicKey) name = 'Alice';
    if (split.pubkey === bob.publicKey) name = 'Bob';
    if (split.pubkey === charlie.publicKey) name = 'Charlie';
    
    console.log(`  ${name} (${split.pubkey.slice(0, 8)}...): ${percentage.toFixed(1)}% (weight: ${split.weight})`);
  }
  
  console.log('\nIf someone zaps this note with 1000 sats, it would be split as:');
  const splitAmounts = calculateZapSplitAmounts(1000000, splitInfo);
  
  for (const result of splitAmounts) {
    let name = 'Unknown';
    if (result.pubkey === alice.publicKey) name = 'Alice';
    if (result.pubkey === bob.publicKey) name = 'Bob';
    if (result.pubkey === charlie.publicKey) name = 'Charlie';
    
    console.log(`  ${name} would receive ${result.amount / 1000} sats`);
  }

  // Clean up
  setTimeout(async () => {
    await client.disconnectFromRelays();
    await relay.close();
    console.log('\n✅ Example completed');
  }, 1000);
}

main().catch(error => {
  console.error('Error in example:', error);
  process.exit(1);
}); 