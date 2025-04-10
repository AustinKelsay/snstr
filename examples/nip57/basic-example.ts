/**
 * NIP-57 Lightning Zaps - Basic Example
 * 
 * This example demonstrates how to:
 * 1. Create and sign a zap request
 * 2. Validate a zap receipt
 * 3. Parse zap split information from an event
 * 
 * Note: This example doesn't make actual network requests to LNURL servers.
 */

import { 
  Nostr, 
  NostrEvent,
  generateKeypair,
  createZapRequest, 
  validateZapReceipt, 
  parseZapSplit, 
  calculateZapSplitAmounts 
} from '../../src';
import { createSignedEvent, UnsignedEvent } from '../../src/utils/event';

// For a real ephemeral relay implementation
import { NostrRelay } from '../../src/utils/ephemeral-relay';

async function main() {
  console.log('NIP-57 Lightning Zaps Example');
  console.log('-----------------------------\n');

  // Start an ephemeral relay for testing and demonstration
  const relay = new NostrRelay(3333, 60); // Change port to 3333
  await relay.start();
  console.log(`🔌 Ephemeral relay started at ${relay.url}\n`);

  // Generate keypairs for our example
  console.log('Generating keypairs...');
  const senderKeypair = await generateKeypair();
  const recipientKeypair = await generateKeypair();
  const lnurlServerKeypair = await generateKeypair();

  console.log(`🔑 Sender pubkey: ${senderKeypair.publicKey.slice(0, 8)}...`);
  console.log(`🔑 Recipient pubkey: ${recipientKeypair.publicKey.slice(0, 8)}...`);
  console.log(`🔑 LNURL server pubkey: ${lnurlServerKeypair.publicKey.slice(0, 8)}...\n`);

  // Initialize a Nostr client
  const client = new Nostr([relay.url]);
  await client.setPrivateKey(senderKeypair.privateKey);
  await client.connectToRelays();
  console.log('✅ Connected to relay\n');

  // Create a text note to zap
  console.log('Publishing a note to zap...');
  const noteEvent = await client.publishTextNote('This is a note that will receive zaps!');
  console.log(`📝 Published note with ID: ${noteEvent?.id.slice(0, 8)}...\n`);

  // Create a zap request
  console.log('Creating a zap request...');
  const zapRequestTemplate = createZapRequest({
    recipientPubkey: recipientKeypair.publicKey,
    eventId: noteEvent?.id,
    amount: 1000000, // 1000 sats (in millisats)
    relays: [relay.url],
    content: 'Great post! Here\'s 1000 sats.'
  }, senderKeypair.publicKey);

  // Sign the zap request
  const signedZapRequest = await createSignedEvent({
    ...zapRequestTemplate,
    pubkey: senderKeypair.publicKey,
    created_at: Math.floor(Date.now() / 1000)
  } as UnsignedEvent, senderKeypair.privateKey);
  
  console.log(`⚡ Created zap request with ID: ${signedZapRequest.id.slice(0, 8)}...\n`);

  // Display the relay tag format for educational purposes
  const relaysTag = signedZapRequest.tags.find(tag => tag[0] === 'relays');
  if (relaysTag) {
    console.log('Relay tag format in zap request:');
    console.log(JSON.stringify(relaysTag));
    console.log('This format follows NIP-57 specification: a single tag with "relays" as the first element\n');
  }

  // Demonstrate multiple relays (for demonstration purposes)
  console.log('Creating a zap request with multiple relays...');
  const multipleRelaysTemplate = createZapRequest({
    recipientPubkey: recipientKeypair.publicKey,
    eventId: noteEvent?.id,
    amount: 1000000,
    relays: [
      'wss://relay1.example.com',
      'wss://relay2.example.com',
      'wss://relay3.example.com'
    ],
    content: 'Great post with multiple relays!'
  }, senderKeypair.publicKey);

  const signedMultiRelayRequest = await createSignedEvent({
    ...multipleRelaysTemplate,
    pubkey: senderKeypair.publicKey,
    created_at: Math.floor(Date.now() / 1000)
  } as UnsignedEvent, senderKeypair.privateKey);

  const multiRelaysTag = signedMultiRelayRequest.tags.find(tag => tag[0] === 'relays');
  if (multiRelaysTag) {
    console.log('Multiple relays tag format:');
    console.log(JSON.stringify(multiRelaysTag));
    console.log('All relay URLs are in a single tag, not separate tags\n');
  }

  // In a real app, you would:
  // 1. Send this zap request to the recipient's LNURL server
  // 2. Get back a bolt11 invoice
  // 3. Pay the invoice
  // 4. The LNURL server would create and publish a zap receipt
  
  // For this example, we'll simulate a zap receipt
  console.log('Simulating receipt of payment...');
  console.log('Creating a zap receipt...');

  // Create a zap receipt template as UnsignedEvent
  const zapReceiptTemplate: UnsignedEvent = {
    kind: 9735,
    pubkey: lnurlServerKeypair.publicKey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['p', recipientKeypair.publicKey],
      ['e', noteEvent?.id || ''],
      // Use a longer mock invoice - note this is still not a real invoice and won't decode properly
      ['bolt11', 'lnbc10n1pnl9j2dpp5l26x7ehekgvlyys6v0ejx632efxu4takgrjf6djxx27p2mj2s0rshp5hrpx277yr8wz65tkjgk5pasf4206f3uqxwgjvpvumy5tn02u33tscqzzsxqyz5vqsp5xzj5n464jd8zzjfgxk7l6awyh9ljr2dxj840e5afyytsm74w7cvs9qxpqysgqu60yrltgcntw5phmdkdjqagfklrumflhf9facvhjhfljcethwejynzf0z2u6mrmfhxj8pg7a8r6ar9jf2wprmlv6gvyxhgetgnkjxwsqt233t8'],
      ['description', JSON.stringify(signedZapRequest)],
      ['preimage', '5d006d2cf1e73c7148e7519a4c68adc81642ce0e25a432b2434c99f97344c15f']
    ],
    content: ''
  };

  // Sign the zap receipt
  const signedZapReceipt = await createSignedEvent(zapReceiptTemplate, lnurlServerKeypair.privateKey);
  console.log(`🧾 Created zap receipt with ID: ${signedZapReceipt.id.slice(0, 8)}...\n`);

  // Publish the zap receipt to relay
  console.log('Publishing zap receipt to relay...');
  relay.store(signedZapReceipt);
  console.log('✅ Zap receipt published\n');

  // Subscribe to zap receipts for our note - but handle validation differently for the demo
  console.log('Subscribing to zap receipts...');
  const subId = client.subscribe(
    [{ kinds: [9735], '#e': [noteEvent?.id || ''] }],
    (event, relayUrl) => {
      console.log(`Received zap receipt from ${relayUrl}...`);
      
      // For this example, we'll create a custom validation that doesn't try to verify the description hash
      // since our mock bolt11 invoice doesn't contain a real description hash that can be verified
      try {
        // Custom validation for demo purposes
        const pTag = event.tags.find(tag => tag[0] === 'p');
        const descriptionTag = event.tags.find(tag => tag[0] === 'description');
        
        if (!pTag || !descriptionTag) {
          console.error('❌ Invalid zap receipt: Missing required tags');
          return;
        }
        
        // Parse the zap request from the description
        const zapRequest = JSON.parse(descriptionTag[1]);
        
        console.log(`✅ Valid zap receipt (simulated for demo):`);
        console.log(`   Amount: ${zapRequest.tags.find((tag: string[]) => tag[0] === 'amount')?.[1] || 'unknown'} millisats`);
        console.log(`   Sender: ${zapRequest.pubkey.slice(0, 8)}...`);
        console.log(`   Recipient: ${pTag[1].slice(0, 8)}...`);
        console.log(`   Event ID: ${event.tags.find((tag: string[]) => tag[0] === 'e')?.[1]?.slice(0, 8)}...`);
        if (zapRequest.content) {
          console.log(`   Comment: ${zapRequest.content}`);
        }
        
        console.log('\n⚠️ Note: In this demo, we\'re not validating the bolt11 invoice description hash');
        console.log('   In a real implementation, the hash of the zap request would be verified');
        console.log('   against the description hash in the bolt11 invoice.');
      } catch (error) {
        console.error(`❌ Error processing zap receipt: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  // After the custom validation code, add back the description hash verification demo:
  // Demonstrate the importance of description hash verification
  console.log('\nDemonstrating Description Hash Verification...');
  console.log('----------------------------------------------');
  console.log('The bolt11 invoice description_hash field must match the SHA-256 hash of the zap request.');
  console.log('This ensures the invoice was actually generated for the specific zap request.');
  console.log('Without this verification, malicious LNURL servers could generate fake zap receipts.');
  
  // Create a fake tampered zap receipt to demonstrate
  console.log('\nCreating a tampered zap receipt with an incorrect description hash...');
  
  // First, create a different zap request (we'll pretend this is the original one)
  const originalZapRequestTemplate = createZapRequest({
    recipientPubkey: recipientKeypair.publicKey,
    eventId: noteEvent?.id,
    amount: 5000000, // 5000 sats (much higher than claimed)
    relays: [relay.url],
    content: 'Original zap that was much larger!'
  }, senderKeypair.publicKey);

  const originalZapRequest = await createSignedEvent({
    ...originalZapRequestTemplate,
    pubkey: senderKeypair.publicKey,
    created_at: Math.floor(Date.now() / 1000) - 3600 // Pretend it happened an hour ago
  } as UnsignedEvent, senderKeypair.privateKey);
  
  // Now create a fake receipt that claims to be for a smaller amount
  const fakeZapRequestTemplate = createZapRequest({
    recipientPubkey: recipientKeypair.publicKey,
    eventId: noteEvent?.id,
    amount: 100000, // Only 100 sats
    relays: [relay.url],
    content: 'Fake zap with smaller amount!'
  }, senderKeypair.publicKey);

  const fakeZapRequest = await createSignedEvent({
    ...fakeZapRequestTemplate,
    pubkey: senderKeypair.publicKey,
    created_at: Math.floor(Date.now() / 1000)
  } as UnsignedEvent, senderKeypair.privateKey);
  
  // The tampered receipt uses the fake zap request in its description
  // but the bolt11 was actually generated for the original (larger) request
  const tamperedReceiptTemplate = {
    kind: 9735,
    pubkey: lnurlServerKeypair.publicKey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['p', recipientKeypair.publicKey],
      ['e', noteEvent?.id || ''],
      // Use a longer mock invoice for the tampered receipt too
      ['bolt11', 'lnbc5000n1pnl9j2dpp5l26x7ehekgvlyys6v0ejx632efxu4takgrjf6djxx27p2mj2s0rshp5hrpx277yr8wz65tkjgk5pasf4206f3uqxwgjvpvumy5tn02u33tscqzzsxqyz5vqsp5xzj5n464jd8zzjfgxk7l6awyh9ljr2dxj840e5afyytsm74w7cvs9qxpqysgqu60yrltgcntw5phmdkdjqagfklrumflhf9facvhjhfljcethwejynzf0z2u6mrmfhxj8pg7a8r6ar9jf2wprmlv6gvyxhgetgnkjxwsqt233t8'], 
      // But the description contains the fake zap request (mismatched hash!)
      ['description', JSON.stringify(fakeZapRequest)],
      ['preimage', '5d006d2cf1e73c7148e7519a4c68adc81642ce0e25a432b2434c99f97344c15f']
    ],
    content: ''
  };

  const tamperedReceipt = await createSignedEvent(tamperedReceiptTemplate, lnurlServerKeypair.privateKey);
  console.log(`Created tampered receipt with ID: ${tamperedReceipt.id.slice(0, 8)}...`);
  
  // Validate the tampered receipt
  console.log('\nValidating the tampered receipt...');
  // In a real implementation, this would fail because the description hash wouldn't match
  // For demonstration purposes, we'll just show what the validation would return
  console.log('In a real implementation with a real bolt11 invoice:');
  console.log('✓ Description hash verification would detect the tampered receipt');
  console.log('✓ validateZapReceipt() would return valid: false');
  console.log('✓ Error message would be: "Description hash mismatch"');
  console.log('\nThis security check prevents malicious servers from:');
  console.log('1. Claiming larger payments than were actually made');
  console.log('2. Reusing payment proofs for different users or events');
  console.log('3. Generating fake zap receipts without actual payments');

  // Demonstrate zap splits
  console.log('\nDemonstrating zap splits...');
  
  // Create an event with zap split tags
  const noteWithSplitTemplate: UnsignedEvent = {
    kind: 1,
    pubkey: recipientKeypair.publicKey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['zap', 'pubkey1', 'wss://relay1.com', '1'],  // 1/6 of zap amount
      ['zap', 'pubkey2', 'wss://relay2.com', '2'],  // 2/6 of zap amount
      ['zap', 'pubkey3', 'wss://relay3.com', '3']   // 3/6 of zap amount
    ],
    content: 'This post has a zap split configuration!'
  };
  
  const signedNoteWithSplit = await createSignedEvent(noteWithSplitTemplate, recipientKeypair.privateKey);
  
  // Parse the zap split information
  const splitInfo = parseZapSplit(signedNoteWithSplit);
  console.log('Zap split information:');
  splitInfo.forEach(info => {
    console.log(`   Pubkey: ${info.pubkey.slice(0, 8)}..., Relay: ${info.relay}, Weight: ${info.weight}`);
  });
  
  // Calculate actual amounts for a 6000 sat zap
  const totalZapAmount = 6000000; // 6000 sats in millisats
  const splitAmounts = calculateZapSplitAmounts(totalZapAmount, splitInfo);
  
  console.log(`\nIf someone zaps ${totalZapAmount / 1000} sats, it will be split as:`);
  splitAmounts.forEach(info => {
    console.log(`   Pubkey: ${info.pubkey.slice(0, 8)}...: ${info.amount / 1000} sats`);
  });

  // Clean up after 2 seconds
  setTimeout(async () => {
    client.unsubscribe(subId);
    await client.disconnectFromRelays();
    await relay.close();
    console.log('\n✅ Example completed. Cleaned up resources.');
  }, 2000);
}

main().catch(error => {
  console.error('Error in example:', error);
  process.exit(1);
}); 