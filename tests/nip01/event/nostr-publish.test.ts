import { 
  Nostr, 
  NostrEvent, 
  RelayEvent, 
  RelayEventCallbacks, 
  PublishResponse,
  RelayStatus,
  NostrFilter
} from "../../../src";

// Simulated relay for testing
class MockRelay {
  public publishResults: PublishResponse[] = [];
  public readonly url: string;
  public connected = true;
  private connectionTimeout = 10000;
  // Add status property required by the real interface
  public readonly status: RelayStatus = RelayStatus.CONNECTED;

  constructor(
    url: string,
    publishResults: PublishResponse[] = [],
    options: { connectionTimeout?: number } = {},
  ) {
    this.url = url;
    this.publishResults = publishResults.length
      ? publishResults
      : [{ success: true }];
    if (options.connectionTimeout !== undefined) {
      this.connectionTimeout = options.connectionTimeout;
    }
  }

  async connect(): Promise<boolean> {
    this.connected = true;
    return true;
  }

  async publish(_event: NostrEvent): Promise<PublishResponse> {
    // Return and remove the first result from the array, or the last one if only one remains
    return this.publishResults.length > 1
      ? this.publishResults.shift()!
      : this.publishResults[0];
  }

  disconnect(): void {
    this.connected = false;
  }

  on<E extends RelayEvent>(_event: E, _callback: RelayEventCallbacks[E]): void {}
  off<E extends RelayEvent>(_event: E, _callback: RelayEventCallbacks[E]): void {}

  // These methods are needed to satisfy the interface but aren't used in tests
  send(_message: string): void {}
  subscribe(_filters: NostrFilter[], _onEvent: (event: NostrEvent) => void, _onEose?: () => void): string {
    return "";
  }
  unsubscribe(_subscriptionId: string): void {}

  setConnectionTimeout(timeout: number): void {
    if (timeout < 0) {
      throw new Error("Connection timeout must be a positive number");
    }
    this.connectionTimeout = timeout;
  }

  getConnectionTimeout(): number {
    return this.connectionTimeout;
  }
}

// Interface for Nostr private members we need to access in tests
interface NostrPrivateMembers {
  privateKey: string;
  publicKey: string;
  relays: Map<string, MockRelay>; // Properly typed for our test context
}

// Extended Nostr class for testing that exposes private members
class TestNostr extends Nostr {
  getPrivateMembers(): NostrPrivateMembers {
    return this as unknown as NostrPrivateMembers;
  }

  setPrivateKey(key: string): void {
    this.getPrivateMembers().privateKey = key;
  }

  setPublicKey(key: string): void {
    this.getPrivateMembers().publicKey = key;
  }

  setRelays(relays: Map<string, MockRelay>): void {
    this.getPrivateMembers().relays = relays;
  }
}

describe("Nostr publish methods", () => {
  let nostr: TestNostr;

  beforeEach(() => {
    nostr = new TestNostr();
  });

  describe("publishEvent", () => {
    it("should aggregate results from multiple relays and report success if at least one succeeds", async () => {
      // Create mock relays
      const relays = new Map<string, MockRelay>();
      relays.set(
        "wss://relay1.com",
        new MockRelay("wss://relay1.com", [
          { success: true, reason: "accepted" },
        ]),
      );
      relays.set(
        "wss://relay2.com",
        new MockRelay("wss://relay2.com", [
          { success: false, reason: "error" },
        ]),
      );

      // Inject mock relays
      nostr.setRelays(relays);

      // Set required keys
      nostr.setPrivateKey("test-private-key");
      nostr.setPublicKey("test-public-key");

      // Create test event
      const event: NostrEvent = {
        id: "test-event-id",
        pubkey: "test-public-key",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: "Test content",
        sig: "test-signature",
      };

      // Call publishEvent
      const result = await nostr.publishEvent(event);

      // Verify the result
      expect(result.success).toBe(true);
      expect(result.event).toBe(event);
      expect(result.relayResults.size).toBe(2);
      expect(result.relayResults.get("wss://relay1.com")?.success).toBe(true);
      expect(result.relayResults.get("wss://relay2.com")?.success).toBe(false);
    });

    it("should report failure when all relays fail", async () => {
      // Create mock relays that all fail
      const relays = new Map<string, MockRelay>();
      relays.set(
        "wss://relay1.com",
        new MockRelay("wss://relay1.com", [
          { success: false, reason: "reason1" },
        ]),
      );
      relays.set(
        "wss://relay2.com",
        new MockRelay("wss://relay2.com", [
          { success: false, reason: "reason2" },
        ]),
      );

      // Inject mock relays
      nostr.setRelays(relays);

      // Set required keys
      nostr.setPrivateKey("test-private-key");
      nostr.setPublicKey("test-public-key");

      // Create test event
      const event: NostrEvent = {
        id: "test-event-id",
        pubkey: "test-public-key",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: "Test content",
        sig: "test-signature",
      };

      // Call publishEvent
      const result = await nostr.publishEvent(event);

      // Verify the result
      expect(result.success).toBe(false);
      expect(result.event).toBeNull();
      expect(result.relayResults.size).toBe(2);
      expect(result.relayResults.get("wss://relay1.com")?.success).toBe(false);
      expect(result.relayResults.get("wss://relay2.com")?.success).toBe(false);
    });

    it("should handle having no relays configured", async () => {
      // Empty relays map
      nostr.setRelays(new Map());

      // Set required keys
      nostr.setPrivateKey("test-private-key");
      nostr.setPublicKey("test-public-key");

      // Create test event
      const event: NostrEvent = {
        id: "test-event-id",
        pubkey: "test-public-key",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: "Test content",
        sig: "test-signature",
      };

      // Call publishEvent
      const result = await nostr.publishEvent(event);

      // Verify the result
      expect(result.success).toBe(false);
      expect(result.event).toBeNull();
      expect(result.relayResults.size).toBe(0);
    });
  });

  describe("publishWithDetails", () => {
    it("should return detailed statistics including success and failure counts", async () => {
      // Create mock relays with mixed results
      const relays = new Map<string, MockRelay>();
      relays.set(
        "wss://relay1.com",
        new MockRelay("wss://relay1.com", [
          { success: true, reason: "accepted" },
        ]),
      );
      relays.set(
        "wss://relay2.com",
        new MockRelay("wss://relay2.com", [
          { success: false, reason: "error" },
        ]),
      );
      relays.set(
        "wss://relay3.com",
        new MockRelay("wss://relay3.com", [
          { success: true, reason: "stored" },
        ]),
      );

      // Inject mock relays
      nostr.setRelays(relays);

      // Set required keys
      nostr.setPrivateKey("test-private-key");
      nostr.setPublicKey("test-public-key");

      // Create test event
      const event: NostrEvent = {
        id: "test-event-id",
        pubkey: "test-public-key",
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: "Test content",
        sig: "test-signature",
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
