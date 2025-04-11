import { Relay, RelayEvent, NostrEvent } from '../src';
import { NostrRelay } from '../src/utils/ephemeral-relay';

// Ephemeral relay port for tests
const RELAY_TEST_PORT = 3444;

describe('Relay', () => {
  // Setup ephemeral relay for integration tests
  let ephemeralRelay: NostrRelay;

  beforeAll(async () => {
    // Start the ephemeral relay before all tests
    ephemeralRelay = new NostrRelay(RELAY_TEST_PORT);
    await ephemeralRelay.start();
    console.log(`Ephemeral test relay started on port ${RELAY_TEST_PORT}`);
  });

  afterAll(() => {
    // Close the ephemeral relay after tests
    if (ephemeralRelay) {
      ephemeralRelay.close();
      console.log('Ephemeral test relay shut down');
    }
  });

  describe('Connection Management', () => {
    test('should connect to ephemeral relay', async () => {
      const relay = new Relay(ephemeralRelay.url);
      
      // Track connection event
      let connectionEvent = false;
      relay.on(RelayEvent.Connect, () => {
        connectionEvent = true;
      });
      
      const result = await relay.connect();
      
      expect(result).toBe(true);
      expect(connectionEvent).toBe(true);
      
      // Cleanup
      relay.disconnect();
    });
    
    test('should disconnect gracefully', async () => {
      const relay = new Relay(ephemeralRelay.url);
      await relay.connect();
      
      // Track disconnect event
      let disconnectEvent = false;
      relay.on(RelayEvent.Disconnect, () => {
        disconnectEvent = true;
      });
      
      relay.disconnect();
      
      // Give time for the disconnect event to fire
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(disconnectEvent).toBe(true);
    });
  });

  describe('Event Handling', () => {
    test('should register event handlers', () => {
      const relay = new Relay(ephemeralRelay.url);
      
      const handleConnect = jest.fn();
      const handleDisconnect = jest.fn();
      
      relay.on(RelayEvent.Connect, handleConnect);
      relay.on(RelayEvent.Disconnect, handleDisconnect);
      
      expect(typeof relay.on).toBe('function');
      expect(() => {
        relay.on(RelayEvent.Notice, () => {});
        relay.on(RelayEvent.Error, () => {});
      }).not.toThrow();
    });
  });

  describe('Publishing', () => {
    test('should publish events to the ephemeral relay', async () => {
      const relay = new Relay(ephemeralRelay.url);
      await relay.connect();
      
      // Create a simple event
      const event: NostrEvent = {
        id: 'test-event-id',
        pubkey: 'test-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Hello from ephemeral relay test!',
        sig: 'test-signature'
      };
      
      // Publish the event
      const published = await relay.publish(event);
      expect(published).toBe(true);
      
      // Cleanup
      relay.disconnect();
    });
  });

  describe('Subscription', () => {
    test('should create subscription on ephemeral relay', async () => {
      const relay = new Relay(ephemeralRelay.url);
      await relay.connect();
      
      // Create subscription
      const receivedEvents: NostrEvent[] = [];
      
      const subId = relay.subscribe(
        [{ kinds: [1], limit: 10 }],
        (event) => {
          receivedEvents.push(event);
        },
        () => {
          // EOSE handler
        }
      );
      
      // Verify that we get a subscription ID back
      expect(typeof subId).toBe('string');
      
      // Try to unsubscribe
      relay.unsubscribe(subId);
      
      // Cleanup
      relay.disconnect();
    });
  });

  describe('Tag Filtering', () => {
    test('should match events according to NIP-01 tag filtering rules', async () => {
      const relay = new Relay(ephemeralRelay.url);
      await relay.connect();
      
      // Create events with different tag combinations
      const event1 = {
        id: 'test-event-id-1',
        pubkey: 'test-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [['e', 'id1'], ['p', 'pubkey1']],
        content: 'Event with e:id1',
        sig: 'test-signature'
      };
      
      const event2 = {
        id: 'test-event-id-2',
        pubkey: 'test-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [['e', 'id2'], ['p', 'pubkey1']],
        content: 'Event with e:id2',
        sig: 'test-signature'
      };
      
      // Publish events to the relay
      await relay.publish(event1);
      await relay.publish(event2);
      
      // This subscription should receive BOTH events according to NIP-01,
      // because '#e' filter should match events with EITHER 'id1' OR 'id2'
      const receivedEvents: NostrEvent[] = [];
      
      // Create subscription with filter for both e tags
      const subId = relay.subscribe(
        [{ kinds: [1], '#e': ['id1', 'id2'] }],
        (event) => {
          receivedEvents.push(event);
        },
        () => {
          // Test the results after EOSE is received
          // With the current implementation, we may not receive all events
          // that match according to NIP-01 spec
          
          // According to NIP-01, we should have received both events
          expect(receivedEvents.length).toBe(2);
          
          // Clean up
          relay.unsubscribe(subId);
          relay.disconnect();
        }
      );
    });
  });

  describe('Message Handling', () => {
    test('should handle OK messages correctly', () => {
      const relay = new Relay(ephemeralRelay.url);
      
      // Setup a mock to track OK message handling
      let okMessageReceived = false;
      let okEventId = '';
      let okSuccess = false;
      let okMessage = '';
      
      // Mock the event handler to capture OK messages
      relay.on(RelayEvent.OK, (eventId: string, success: boolean, message: string) => {
        okMessageReceived = true;
        okEventId = eventId;
        okSuccess = success;
        okMessage = message;
      });
      
      // Manually trigger the OK message handling
      // This is a direct test of the internal handleMessage method
      const testEventId = 'test-event-id-ok-message';
      const testSuccess = true;
      const testMessage = 'Event was stored';
      
      // Access the private handleMessage method using type assertion
      (relay as any).handleMessage(['OK', testEventId, testSuccess, testMessage]);
      
      // Verify the handler was called with the right parameters
      expect(okMessageReceived).toBe(true);
      expect(okEventId).toBe(testEventId);
      expect(okSuccess).toBe(testSuccess);
      expect(okMessage).toBe(testMessage);
    });
    
    test('should handle CLOSED messages correctly', () => {
      const relay = new Relay(ephemeralRelay.url);
      
      // Setup a mock to track CLOSED message handling
      let closedMessageReceived = false;
      let closedSubId = '';
      let closedMessage = '';
      
      // Mock the event handler to capture CLOSED messages
      relay.on(RelayEvent.Closed, (subscriptionId: string, message: string) => {
        closedMessageReceived = true;
        closedSubId = subscriptionId;
        closedMessage = message;
      });
      
      // Create a subscription so we can verify it gets removed
      const subId = 'test-subscription-id';
      (relay as any).subscriptions.set(subId, {
        id: subId,
        filters: [{ kinds: [1] }],
        onEvent: () => {}
      });
      
      // Verify the subscription exists before
      expect((relay as any).subscriptions.has(subId)).toBe(true);
      
      // Manually trigger the CLOSED message handling
      const testMessage = 'Subscription closed due to inactivity';
      (relay as any).handleMessage(['CLOSED', subId, testMessage]);
      
      // Verify the handler was called with the right parameters
      expect(closedMessageReceived).toBe(true);
      expect(closedSubId).toBe(subId);
      expect(closedMessage).toBe(testMessage);
      
      // Verify the subscription was removed
      expect((relay as any).subscriptions.has(subId)).toBe(false);
    });
  });
}); 