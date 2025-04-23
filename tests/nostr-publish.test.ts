import { Nostr, Relay, NostrEvent, RelayEvent } from '../src';

// Simulated relay for testing
class MockRelay {
  public publishResults: { success: boolean; reason?: string }[] = [];
  public readonly url: string;
  public connected = true;
  private connectionTimeout = 10000;
  
  constructor(url: string, publishResults: { success: boolean; reason?: string }[] = [], options: { connectionTimeout?: number } = {}) {
    this.url = url;
    this.publishResults = publishResults.length ? publishResults : [{ success: true }];
    if (options.connectionTimeout !== undefined) {
      this.connectionTimeout = options.connectionTimeout;
    }
  }
  
  async connect(): Promise<boolean> {
    this.connected = true;
    return true;
  }
  
  async publish(event: NostrEvent, options: { timeout?: number } = {}): Promise<{ success: boolean; reason?: string }> {
    // Return and remove the first result from the array, or the last one if only one remains
    return this.publishResults.length > 1 
      ? this.publishResults.shift()! 
      : this.publishResults[0];
  }
  
  disconnect(): void {
    this.connected = false;
  }
  
  on() {}
  off() {}
  
  setConnectionTimeout(timeout: number): void {
    if (timeout < 0) {
      throw new Error('Connection timeout must be a positive number');
    }
    this.connectionTimeout = timeout;
  }
  
  getConnectionTimeout(): number {
    return this.connectionTimeout;
  }
}

describe('Nostr publish methods', () => {
  let nostr: Nostr;
  
  beforeEach(() => {
    nostr = new Nostr();
  });
  
  describe('publishEvent', () => {
    it('should aggregate results from multiple relays and report success if at least one succeeds', async () => {
      // Create mock relays
      const relays = new Map<string, MockRelay>();
      relays.set('wss://relay1.com', new MockRelay('wss://relay1.com', [{ success: true, reason: 'accepted' }]));
      relays.set('wss://relay2.com', new MockRelay('wss://relay2.com', [{ success: false, reason: 'error' }]));
      
      // Inject mock relays
      (nostr as any).relays = relays;
      
      // Set required keys
      (nostr as any).privateKey = 'test-private-key';
      (nostr as any).publicKey = 'test-public-key';
      
      // Create test event
      const event: NostrEvent = {
        id: 'test-event-id',
        pubkey: 'test-public-key',
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Test content',
        sig: 'test-signature'
      };
      
      // Call publishEvent
      const result = await nostr.publishEvent(event);
      
      // Verify the result
      expect(result.success).toBe(true);
      expect(result.event).toBe(event);
      expect(result.relayResults.size).toBe(2);
      expect(result.relayResults.get('wss://relay1.com')?.success).toBe(true);
      expect(result.relayResults.get('wss://relay2.com')?.success).toBe(false);
    });
    
    it('should report failure when all relays fail', async () => {
      // Create mock relays that all fail
      const relays = new Map<string, MockRelay>();
      relays.set('wss://relay1.com', new MockRelay('wss://relay1.com', [{ success: false, reason: 'reason1' }]));
      relays.set('wss://relay2.com', new MockRelay('wss://relay2.com', [{ success: false, reason: 'reason2' }]));
      
      // Inject mock relays
      (nostr as any).relays = relays;
      
      // Set required keys
      (nostr as any).privateKey = 'test-private-key';
      (nostr as any).publicKey = 'test-public-key';
      
      // Create test event
      const event: NostrEvent = {
        id: 'test-event-id',
        pubkey: 'test-public-key',
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Test content',
        sig: 'test-signature'
      };
      
      // Call publishEvent
      const result = await nostr.publishEvent(event);
      
      // Verify the result
      expect(result.success).toBe(false);
      expect(result.event).toBeNull();
      expect(result.relayResults.size).toBe(2);
      expect(result.relayResults.get('wss://relay1.com')?.success).toBe(false);
      expect(result.relayResults.get('wss://relay2.com')?.success).toBe(false);
    });
    
    it('should handle having no relays configured', async () => {
      // Empty relays map
      (nostr as any).relays = new Map();
      
      // Set required keys
      (nostr as any).privateKey = 'test-private-key';
      (nostr as any).publicKey = 'test-public-key';
      
      // Create test event
      const event: NostrEvent = {
        id: 'test-event-id',
        pubkey: 'test-public-key',
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Test content',
        sig: 'test-signature'
      };
      
      // Call publishEvent
      const result = await nostr.publishEvent(event);
      
      // Verify the result
      expect(result.success).toBe(false);
      expect(result.event).toBeNull();
      expect(result.relayResults.size).toBe(0);
    });
  });
  
  describe('publishWithDetails', () => {
    it('should return detailed statistics including success and failure counts', async () => {
      // Create mock relays with mixed results
      const relays = new Map<string, MockRelay>();
      relays.set('wss://relay1.com', new MockRelay('wss://relay1.com', [{ success: true, reason: 'accepted' }]));
      relays.set('wss://relay2.com', new MockRelay('wss://relay2.com', [{ success: false, reason: 'error' }]));
      relays.set('wss://relay3.com', new MockRelay('wss://relay3.com', [{ success: true, reason: 'stored' }]));
      
      // Inject mock relays
      (nostr as any).relays = relays;
      
      // Set required keys
      (nostr as any).privateKey = 'test-private-key';
      (nostr as any).publicKey = 'test-public-key';
      
      // Create test event
      const event: NostrEvent = {
        id: 'test-event-id',
        pubkey: 'test-public-key',
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Test content',
        sig: 'test-signature'
      };
      
      // Call publishWithDetails
      const result = await nostr.publishWithDetails(event);
      
      // Verify the result includes the additional statistics
      expect(result.success).toBe(true);
      expect(result.event).toBe(event);
      expect(result.relayResults.size).toBe(3);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
    });
  });
}); 