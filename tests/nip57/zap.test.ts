import { 
  createZapRequest, 
  createZapReceipt, 
  validateZapReceipt, 
  ZAP_REQUEST_KIND, 
  ZAP_RECEIPT_KIND,
  parseZapSplit, 
  calculateZapSplitAmounts,
  NostrEvent
} from '../../src';
import { generateKeypair } from '../../src';
import { createSignedEvent, UnsignedEvent } from '../../src/utils/event';

describe('NIP-57: Lightning Zaps', () => {
  let senderKeypair: { privateKey: string, publicKey: string };
  let recipientKeypair: { privateKey: string, publicKey: string };
  let lnurlServerKeypair: { privateKey: string, publicKey: string };
  
  beforeAll(async () => {
    // Generate keypairs for testing
    senderKeypair = await generateKeypair();
    recipientKeypair = await generateKeypair();
    lnurlServerKeypair = await generateKeypair();
  });
  
  describe('Zap Request Creation', () => {
    it('should create a valid zap request event', async () => {
      const zapRequestTemplate = createZapRequest({
        recipientPubkey: recipientKeypair.publicKey,
        amount: 1000000, // 1000 sats
        relays: ['wss://relay.example.com'],
        content: 'Great post!',
        eventId: 'abc123'
      }, senderKeypair.publicKey);
      
      // Sign the event to convert template to full NostrEvent
      const zapRequest = await createSignedEvent({
        ...zapRequestTemplate,
        pubkey: senderKeypair.publicKey,
        created_at: Math.floor(Date.now() / 1000)
      } as UnsignedEvent, senderKeypair.privateKey);
      
      expect(zapRequest.kind).toBe(ZAP_REQUEST_KIND);
      expect(zapRequest.pubkey).toBe(senderKeypair.publicKey);
      
      // Check tags
      const pTag = zapRequest.tags.find((tag: string[]) => tag[0] === 'p');
      const eTag = zapRequest.tags.find((tag: string[]) => tag[0] === 'e');
      const amountTag = zapRequest.tags.find((tag: string[]) => tag[0] === 'amount');
      const relaysTag = zapRequest.tags.find((tag: string[]) => tag[0] === 'relays');
      
      expect(pTag?.[1]).toBe(recipientKeypair.publicKey);
      expect(eTag?.[1]).toBe('abc123');
      expect(amountTag?.[1]).toBe('1000000');
      expect(relaysTag?.[0]).toBe('relays');
      expect(relaysTag?.[1]).toBe('wss://relay.example.com');
      expect(zapRequest.content).toBe('Great post!');
    });
    
    it('should correctly format multiple relays in a single tag', async () => {
      const relaysList = [
        'wss://relay1.example.com',
        'wss://relay2.example.com',
        'wss://relay3.example.com'
      ];
      
      const zapRequestTemplate = createZapRequest({
        recipientPubkey: recipientKeypair.publicKey,
        amount: 1000000,
        relays: relaysList,
        content: 'Great post!'
      }, senderKeypair.publicKey);
      
      const zapRequest = await createSignedEvent({
        ...zapRequestTemplate,
        pubkey: senderKeypair.publicKey,
        created_at: Math.floor(Date.now() / 1000)
      } as UnsignedEvent, senderKeypair.privateKey);
      
      // Check the relays tag format
      const relaysTag = zapRequest.tags.find((tag: string[]) => tag[0] === 'relays');
      expect(relaysTag).toBeDefined();
      expect(relaysTag?.[0]).toBe('relays');
      
      // Verify all relays are in the same tag
      expect(relaysTag?.[1]).toBe(relaysList[0]);
      expect(relaysTag?.[2]).toBe(relaysList[1]);
      expect(relaysTag?.[3]).toBe(relaysList[2]);
      
      // Ensure there's only one relays tag
      const allRelaysTags = zapRequest.tags.filter((tag: string[]) => tag[0] === 'relays');
      expect(allRelaysTags.length).toBe(1);
    });
    
    it('should support anonymous zaps', async () => {
      // For anonymous zaps we should still use a valid private key
      // but mark it anonymous in the request
      const anonymousKey = '0000000000000000000000000000000000000000000000000000000000000001';
      
      const zapRequestTemplate = createZapRequest({
        recipientPubkey: recipientKeypair.publicKey,
        amount: 1000000,
        relays: ['wss://relay.example.com'],
        senderPubkey: senderKeypair.publicKey
      }, anonymousKey);
      
      const zapRequest = await createSignedEvent({
        ...zapRequestTemplate,
        pubkey: anonymousKey,
        created_at: Math.floor(Date.now() / 1000)
      } as UnsignedEvent, anonymousKey);
      
      // Check for P tag
      const pSenderTag = zapRequest.tags.find((tag: string[]) => tag[0] === 'P');
      expect(pSenderTag?.[1]).toBe(senderKeypair.publicKey);
    });
  });
  
  describe('Zap Receipt Creation', () => {
    it('should create a valid zap receipt event', async () => {
      // First create a zap request
      const zapRequestTemplate = createZapRequest({
        recipientPubkey: recipientKeypair.publicKey,
        amount: 1000000,
        relays: ['wss://relay.example.com'],
        eventId: 'abc123',
        content: 'Great post!'
      }, senderKeypair.publicKey);
      
      const zapRequest = await createSignedEvent({
        ...zapRequestTemplate,
        pubkey: senderKeypair.publicKey,
        created_at: Math.floor(Date.now() / 1000)
      } as UnsignedEvent, senderKeypair.privateKey);
      
      // Then create the receipt
      const zapReceiptTemplate = createZapReceipt({
        recipientPubkey: recipientKeypair.publicKey,
        eventId: 'abc123',
        bolt11: 'lnbc1000n1...',
        preimage: '123abc...',
        zapRequest
      }, lnurlServerKeypair.publicKey);
      
      const zapReceipt = await createSignedEvent({
        ...zapReceiptTemplate,
        pubkey: lnurlServerKeypair.publicKey,
        created_at: Math.floor(Date.now() / 1000)
      } as UnsignedEvent, lnurlServerKeypair.privateKey);
      
      expect(zapReceipt.kind).toBe(ZAP_RECEIPT_KIND);
      expect(zapReceipt.pubkey).toBe(lnurlServerKeypair.publicKey);
      
      // Check tags
      const pTag = zapReceipt.tags.find((tag: string[]) => tag[0] === 'p');
      const eTag = zapReceipt.tags.find((tag: string[]) => tag[0] === 'e');
      const bolt11Tag = zapReceipt.tags.find((tag: string[]) => tag[0] === 'bolt11');
      const descriptionTag = zapReceipt.tags.find((tag: string[]) => tag[0] === 'description');
      const preimageTag = zapReceipt.tags.find((tag: string[]) => tag[0] === 'preimage');
      
      expect(pTag?.[1]).toBe(recipientKeypair.publicKey);
      expect(eTag?.[1]).toBe('abc123');
      expect(bolt11Tag?.[1]).toBe('lnbc1000n1...');
      expect(typeof descriptionTag?.[1]).toBe('string');
      expect(preimageTag?.[1]).toBe('123abc...');
      
      // The content should be empty
      expect(zapReceipt.content).toBe('');
    });
  });
  
  describe('Zap Receipt Validation', () => {
    it('should validate a proper zap receipt', async () => {
      // Create a signed zap request
      const zapRequestTemplate = createZapRequest({
        recipientPubkey: recipientKeypair.publicKey,
        amount: 1000000,
        relays: ['wss://relay.example.com'],
        eventId: 'abc123'
      }, senderKeypair.publicKey);
      
      const signedZapRequest = await createSignedEvent({
        ...zapRequestTemplate,
        pubkey: senderKeypair.publicKey,
        created_at: Math.floor(Date.now() / 1000)
      } as UnsignedEvent, senderKeypair.privateKey);
      
      // Create a zap receipt
      const zapReceiptTemplate = createZapReceipt({
        recipientPubkey: recipientKeypair.publicKey,
        eventId: 'abc123',
        bolt11: 'lnbc1000n1...',
        zapRequest: signedZapRequest
      }, lnurlServerKeypair.publicKey);
      
      const signedZapReceipt = await createSignedEvent({
        ...zapReceiptTemplate,
        pubkey: lnurlServerKeypair.publicKey,
        created_at: Math.floor(Date.now() / 1000)
      } as UnsignedEvent, lnurlServerKeypair.privateKey);
      
      // Validate it
      const validation = validateZapReceipt(signedZapReceipt, lnurlServerKeypair.publicKey);
      
      expect(validation.valid).toBe(true);
      expect(validation.recipient).toBe(recipientKeypair.publicKey);
      expect(validation.sender).toBe(senderKeypair.publicKey);
      expect(validation.eventId).toBe('abc123');
      expect(validation.amount).toBe(1000000);
    });
    
    it('should reject a zap receipt with mismatched pubkey', async () => {
      // Create a signed zap request
      const zapRequestTemplate = createZapRequest({
        recipientPubkey: recipientKeypair.publicKey,
        amount: 1000000,
        relays: ['wss://relay.example.com']
      }, senderKeypair.publicKey);
      
      const signedZapRequest = await createSignedEvent({
        ...zapRequestTemplate,
        pubkey: senderKeypair.publicKey,
        created_at: Math.floor(Date.now() / 1000)
      } as UnsignedEvent, senderKeypair.privateKey);
      
      // Create a zap receipt
      const zapReceiptTemplate = createZapReceipt({
        recipientPubkey: recipientKeypair.publicKey,
        bolt11: 'lnbc1000n1...',
        zapRequest: signedZapRequest
      }, lnurlServerKeypair.publicKey);
      
      const signedZapReceipt = await createSignedEvent({
        ...zapReceiptTemplate,
        pubkey: lnurlServerKeypair.publicKey,
        created_at: Math.floor(Date.now() / 1000)
      } as UnsignedEvent, lnurlServerKeypair.privateKey);
      
      // Validate with wrong pubkey
      const validation = validateZapReceipt(signedZapReceipt, senderKeypair.publicKey);
      
      expect(validation.valid).toBe(false);
      expect(validation.message).toContain('not from expected LNURL provider');
    });
  });
  
  describe('Zap Split', () => {
    it('should parse zap split tags correctly', () => {
      const event: NostrEvent = {
        id: 'abc123',
        pubkey: senderKeypair.publicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [
          ['zap', 'pubkey1', 'wss://relay1.com', '1'],
          ['zap', 'pubkey2', 'wss://relay2.com', '2'],
          ['zap', 'pubkey3', 'wss://relay3.com', '3']
        ],
        content: 'Test post with zap split',
        sig: 'sig'
      };
      
      const splitInfo = parseZapSplit(event);
      
      expect(splitInfo).toHaveLength(3);
      expect(splitInfo[0].pubkey).toBe('pubkey1');
      expect(splitInfo[0].relay).toBe('wss://relay1.com');
      expect(splitInfo[0].weight).toBe(1);
      expect(splitInfo[1].weight).toBe(2);
      expect(splitInfo[2].weight).toBe(3);
    });
    
    it('should calculate split amounts correctly', () => {
      const splitInfo = [
        { pubkey: 'pubkey1', relay: 'relay1', weight: 1 },
        { pubkey: 'pubkey2', relay: 'relay2', weight: 2 },
        { pubkey: 'pubkey3', relay: 'relay3', weight: 3 }
      ];
      
      const amounts = calculateZapSplitAmounts(6000000, splitInfo);
      
      expect(amounts).toHaveLength(3);
      expect(amounts[0].amount).toBe(1000000); // 1/6 of total
      expect(amounts[1].amount).toBe(2000000); // 2/6 of total
      expect(amounts[2].amount).toBe(3000000); // 3/6 of total
      
      // The sum should equal the original amount
      const sum = amounts.reduce((acc, curr) => acc + curr.amount, 0);
      expect(sum).toBe(6000000);
    });
    
    it('should handle equal splits when no weights are provided', () => {
      const event: NostrEvent = {
        id: 'abc123',
        pubkey: senderKeypair.publicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [
          ['zap', 'pubkey1', 'wss://relay1.com'],
          ['zap', 'pubkey2', 'wss://relay2.com'],
          ['zap', 'pubkey3', 'wss://relay3.com']
        ],
        content: 'Test post with equal zap split',
        sig: 'sig'
      };
      
      const splitInfo = parseZapSplit(event);
      
      // All weights should be equal
      expect(splitInfo[0].weight).toBe(splitInfo[1].weight);
      expect(splitInfo[1].weight).toBe(splitInfo[2].weight);
      
      const amounts = calculateZapSplitAmounts(3000000, splitInfo);
      
      // Each should get 1/3
      expect(amounts[0].amount).toBe(1000000);
      expect(amounts[1].amount).toBe(1000000);
      expect(amounts[2].amount).toBe(1000000);
    });
  });
}); 