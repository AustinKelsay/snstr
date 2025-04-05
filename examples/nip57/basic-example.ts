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

  // Set up an ephemeral relay for testing
  const relay = new NostrRelay(3000);
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
      ['bolt11', 'lnbc10m1...'], // This would be a real bolt11 invoice in production
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

  // Subscribe to zap receipts for our note
  console.log('Subscribing to zap receipts...');
  const subId = client.subscribe(
    [{ kinds: [9735], '#e': [noteEvent?.id || ''] }],
    (event, relayUrl) => {
      console.log(`Received zap receipt from ${relayUrl}...`);
      
      // Validate the zap receipt
      const validation = validateZapReceipt(event, lnurlServerKeypair.publicKey);
      
      if (validation.valid) {
        console.log(`✅ Valid zap receipt:`);
        console.log(`   Amount: ${validation.amount} millisats`);
        console.log(`   Sender: ${validation.sender?.slice(0, 8)}...`);
        console.log(`   Recipient: ${validation.recipient?.slice(0, 8)}...`);
        console.log(`   Event ID: ${validation.eventId?.slice(0, 8)}...`);
        if (validation.content) {
          console.log(`   Comment: ${validation.content}`);
        }
      } else {
        console.error(`❌ Invalid zap receipt: ${validation.message}`);
      }
    }
  );

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

  // Demonstrate bolt11 invoice parsing and validation
  console.log('\nDemonstrating bolt11 invoice parsing and validation...');
  
  // Import bolt11 parsing utility
  const { parseBolt11Invoice } = require('../../src/nip57/utils');
  
  // Sample invoice with description hash (this is from the Lightning Network test vectors)
  const validInvoice = 'lnbc25m1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5vdhkven9v5sxyetpdeessp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygs9q5sqqqqqqqqqqqqqqqpqsq67gye39hfg3zd8rgc80k32tvy9xk2xunwm5lzexnvpx6fd77en8qaq424dxgt56cag2dpt359k3ssyhetktkpqh24jqnjyw6uqd08sgptq44qu';
  
  try {
    const invoiceData = parseBolt11Invoice(validInvoice);
    console.log('Parsed bolt11 invoice:');
    console.log(JSON.stringify(invoiceData, null, 2));
    
    console.log('\nIn a real application, the zap validation would:');
    console.log('1. Parse the bolt11 invoice to extract the description hash');
    console.log('2. Calculate the SHA-256 hash of the zap request JSON');
    console.log('3. Verify that these hashes match to ensure the payment was for this specific zap request');
    
    // Show how this protects against tampering
    console.log('\nThis security check prevents:');
    console.log('- Reusing a zap receipt for a different event');
    console.log('- Creating fake zap receipts without actual payments');
    console.log('- Modifying the zap request parameters after payment');
  } catch (error) {
    console.error('Error parsing bolt11 invoice:', error);
  }

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