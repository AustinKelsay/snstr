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
}); 