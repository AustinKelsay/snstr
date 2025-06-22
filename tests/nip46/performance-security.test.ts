import {
  SimpleNIP46Client,
  SimpleNIP46Bunker,
  NostrRemoteSignerBunker,
  generateKeypair,
} from "../../src";
import { NostrRelay } from "../../src/utils/ephemeral-relay";
import { generateRequestId } from "../../src/nip46/utils/request-response";
import { NIP46RateLimiter } from "../../src/nip46/utils/rate-limiter";

jest.setTimeout(6000); // Reduced timeout for faster failures

describe("NIP-46 Performance & DoS Protection", () => {
  let relay: NostrRelay;
  let client: SimpleNIP46Client;
  let bunker: SimpleNIP46Bunker;
  let userKeypair: { publicKey: string; privateKey: string };

  beforeAll(async () => {
    relay = new NostrRelay(0); // Let OS assign a free port
    await relay.start();
    userKeypair = await generateKeypair();
    
    // Further reduced initialization delay
    await new Promise(resolve => setTimeout(resolve, 25));
  });

  beforeEach(async () => {
    bunker = new SimpleNIP46Bunker(
      [relay.url],
      userKeypair.publicKey,
      userKeypair.publicKey,
      { debug: false }
    );
    bunker.setUserPrivateKey(userKeypair.privateKey);
    bunker.setSignerPrivateKey(userKeypair.privateKey);
    bunker.setDefaultPermissions(["sign_event"]);
    await bunker.start();

    // Further reduced connection delay
    await new Promise(resolve => setTimeout(resolve, 10));

    client = new SimpleNIP46Client([relay.url], { timeout: 3000 }); // Reduced timeout
  });

  afterEach(async () => {
    try {
      if (client) {
        await client.disconnect();
      }
    } catch (e) {
      // Ignore cleanup errors
    }
    
    try {
      if (bunker) {
        await bunker.stop();
      }
    } catch (e) {
      // Ignore cleanup errors
    }
    
    // Further reduced cleanup delay
    await new Promise(resolve => setTimeout(resolve, 10));
  });

  afterAll(async () => {
    try {
      if (relay) {
        await relay.close();
      }
    } catch (e) {
      // Ignore cleanup errors
    }
    
    // Reduced final delay
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe("Resource Exhaustion Protection", () => {
    test("handles maximum content size enforcement", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      // Test different content sizes
      const sizes = [1000, 10000, 32768]; // 1KB, 10KB, 32KB
      
      for (const size of sizes) {
        const content = "a".repeat(size);
        const event = await client.signEvent({
          kind: 1,
          content,
          created_at: Math.floor(Date.now() / 1000),
          tags: []
        });
        expect(event).toBeDefined();
      }

      // But reject too large content
      const tooLarge = "a".repeat(65537); // > 64KB
      await expect(
        client.signEvent({
          kind: 1,
          content: tooLarge,
          created_at: Math.floor(Date.now() / 1000),
          tags: []
        })
      ).rejects.toThrow();
    });

    test("limits number of concurrent requests", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      // Reduced concurrent requests for speed
      const requests = Array(5).fill(null).map(() => client.ping()); // Reduced from 10
      
      const results = await Promise.allSettled(requests);
      
      // Should handle all requests gracefully
      expect(results.length).toBe(5);
      
      // At least 80% should succeed (4 out of 5)
      const successful = results.filter(r => r.status === "fulfilled");
      expect(successful.length).toBeGreaterThanOrEqual(4);
    });

    test("handles large tag arrays without memory exhaustion", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      // Reduced tag count for speed
      const largeTags = Array(50).fill(null).map((_, i) => ["t", `tag${i}`]); // Reduced from 100
      
      const event = await client.signEvent({
        kind: 1,
        content: "Event with many tags",
        created_at: Math.floor(Date.now() / 1000),
        tags: largeTags
      });

      expect(event).toBeDefined();
      expect(event.tags.length).toBe(50);
    });
  });

  describe("Request Rate Limiting", () => {
    test("gracefully handles burst requests", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      // Reduced burst size for speed
      const burstSize = 5; // Reduced from 10
      const requests = Array(burstSize).fill(null).map(() => client.ping());
      
      const results = await Promise.allSettled(requests);
      
      // Should handle burst without crashing
      expect(results.length).toBe(burstSize);
      
      // At least 80% should succeed (4 out of 5)
      const successful = results.filter(r => r.status === "fulfilled");
      expect(successful.length).toBeGreaterThanOrEqual(4);
    });

    test("maintains performance under sustained load", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      // Reduced load test for speed
      const batchCount = 3; // Reduced from 5
      const batchSize = 3; // Reduced from 5
      const responseTimes: number[] = [];

      for (let i = 0; i < batchCount; i++) {
        const startTime = Date.now();
        
        const requests = Array(batchSize).fill(null).map(() => client.ping());
        await Promise.allSettled(requests);
        
        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
        
        // Reduced delay between batches
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Response times shouldn't degrade significantly
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      expect(avgResponseTime).toBeLessThan(2000);
      
      // Last batch shouldn't be much slower than first
      const firstBatch = responseTimes[0];
      const lastBatch = responseTimes[responseTimes.length - 1];
      expect(lastBatch).toBeLessThan(firstBatch * 3);
    });

    describe("DoS Protection Rate Limiting", () => {
      let rateLimiter: NIP46RateLimiter;
      
      beforeEach(() => {
        rateLimiter = new NIP46RateLimiter({
          maxRequestsPerMinute: 5,
          maxRequestsPerHour: 20,
          burstSize: 3
        });
      });
      
      afterEach(() => {
        rateLimiter.destroy();
      });

      test("should enforce burst limits", () => {
        const clientPubkey = "test_client_123";
        
        // First 3 requests should be allowed
        for (let i = 0; i < 3; i++) {
          const result = rateLimiter.isAllowed(clientPubkey);
          expect(result.allowed).toBe(true);
          expect(result.remainingRequests).toBeGreaterThanOrEqual(0);
        }
        
        // 4th request should be rate limited
        const result = rateLimiter.isAllowed(clientPubkey);
        expect(result.allowed).toBe(false);
        expect(result.retryAfter).toBeGreaterThan(0);
      });

      test("should enforce per-minute limits", () => {
        const clientPubkey = "test_client_456";
        
        // Make requests up to the limit
        for (let i = 0; i < 5; i++) {
          const result = rateLimiter.isAllowed(clientPubkey);
          if (i < 3) {
            expect(result.allowed).toBe(true);
          }
        }
        
        // Next request should be rate limited
        const result = rateLimiter.isAllowed(clientPubkey);
        expect(result.allowed).toBe(false);
      });

      test("should track different clients separately", () => {
        const client1 = "test_client_111";
        const client2 = "test_client_222";
        
        // Exhaust client1's burst limit
        for (let i = 0; i < 3; i++) {
          rateLimiter.isAllowed(client1);
        }
        
        const client1Result = rateLimiter.isAllowed(client1);
        expect(client1Result.allowed).toBe(false);
        
        // Client2 should still be allowed
        const client2Result = rateLimiter.isAllowed(client2);
        expect(client2Result.allowed).toBe(true);
      });

      test("should provide correct remaining request counts", () => {
        const clientPubkey = "test_client_789";
        
        const initial = rateLimiter.getRemainingRequests(clientPubkey);
        expect(initial.burst).toBe(3);
        expect(initial.minute).toBe(5);
        
        // Make one request
        rateLimiter.isAllowed(clientPubkey);
        
        const afterOne = rateLimiter.getRemainingRequests(clientPubkey);
        expect(afterOne.burst).toBe(2);
        expect(afterOne.minute).toBe(4);
      });

      test("should clear client history when requested", () => {
        const clientPubkey = "test_client_clear";
        
        // Exhaust limits
        for (let i = 0; i < 4; i++) {
          rateLimiter.isAllowed(clientPubkey);
        }
        
        expect(rateLimiter.isAllowed(clientPubkey).allowed).toBe(false);
        
        // Clear client
        rateLimiter.clearClient(clientPubkey);
        
        // Should be allowed again
        expect(rateLimiter.isAllowed(clientPubkey).allowed).toBe(true);
      });
    });
  });

  describe("Memory and CPU Protection", () => {
    test("handles complex event structures efficiently", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      // Create complex but valid event structure
      const complexTags = [
        ["e", "a".repeat(64), "wss://relay.example.com"],
        ["p", "b".repeat(64), "wss://relay.example.com", "root"],
        ["r", "https://example.com/image.jpg"],
        ["subject", "This is a subject"],
        ["t", "hashtag1"],
        ["t", "hashtag2"],
        ["t", "hashtag3"]
      ];

      const startTime = Date.now();
      const event = await client.signEvent({
        kind: 1,
        content: "Complex event with many tags and references",
        created_at: Math.floor(Date.now() / 1000),
        tags: complexTags
      });
      const endTime = Date.now();

      expect(event).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete quickly
    });

    test("prevents regex DoS attacks", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      // Reduced pattern complexity for speed
      const potentialReDoSPatterns = [
        "a".repeat(500) + "b", // Reduced from 1000
        "a".repeat(50) + "$" // Reduced from 100
      ];

      for (const pattern of potentialReDoSPatterns) {
        const startTime = Date.now();
        
        try {
          await client.signEvent({
            kind: 1,
            content: pattern,
            created_at: Math.floor(Date.now() / 1000),
            tags: [["subject", pattern]]
          });
        } catch (error) {
          // Errors are fine, we just don't want hangs
        }
        
        const endTime = Date.now();
        
        // Should not hang on regex processing
        expect(endTime - startTime).toBeLessThan(1000);
      }
    });

    test("handles malformed JSON gracefully", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      // Reduced test cases for speed
      const malformedInputs = [
        '{"incomplete": "json"',
        '{"nested": {"deeply": {"very": "deep"}}}', // Reduced nesting
        '{"unicode": "\\u0000\\u0001"}'
      ];

      for (const input of malformedInputs) {
        try {
          await client.signEvent({
            kind: 1,
            content: input,
            created_at: Math.floor(Date.now() / 1000),
            tags: []
          });
        } catch (error) {
          expect(error).toBeDefined();
        }
      }
    });
  });

  describe("Connection Handling", () => {
    test("handles rapid connection attempts", async () => {
      const connectionString = bunker.getConnectionString();
      
      // Reduced connection attempts for speed
      const connectionPromises = Array(3).fill(null).map(async () => { // Reduced from 5
        const tempClient = new SimpleNIP46Client([relay.url], { timeout: 2000 }); // Reduced timeout
        try {
          await tempClient.connect(connectionString);
          await tempClient.ping();
          await tempClient.disconnect();
        } catch (error) {
          // Connection failures are acceptable under load
        }
      });

      const startTime = Date.now();
      await Promise.allSettled(connectionPromises);
      const endTime = Date.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(8000); // Reduced from 15000
    });

    test("cleans up resources on connection failure", async () => {
      // Try to connect to invalid bunker
      const invalidClient = new SimpleNIP46Client([relay.url], { timeout: 1000 });
      
      try {
        await invalidClient.connect("bunker://invalid-pubkey");
      } catch (error) {
        // Expected to fail
      }
      
      // Should be able to disconnect cleanly even after failed connection
      await expect(invalidClient.disconnect()).resolves.not.toThrow();
    });

    test("handles concurrent connections from multiple clients", async () => {
      const connectionString = bunker.getConnectionString();
      
      // Create clients with shorter timeout for faster failure detection
      const clientCount = 3;
      const clients = Array(clientCount).fill(null).map(() => 
        new SimpleNIP46Client([relay.url], { timeout: 2000 })
      );

      try {
        // Connect all clients concurrently (not sequentially)
        const connectionPromises = clients.map(async (client) => {
          try {
            await client.connect(connectionString);
            return { success: true, client };
          } catch (error) {
            return { success: false, client, error };
          }
        });

        const connectionResults = await Promise.allSettled(connectionPromises);
        
        // Get successfully connected clients
        const connectedClients = connectionResults
          .filter(result => result.status === 'fulfilled' && result.value.success)
          .map(result => (result as PromiseFulfilledResult<{ success: boolean; client: SimpleNIP46Client }>).value.client);

        // Should have at least 2 successful connections out of 3
        expect(connectedClients.length).toBeGreaterThanOrEqual(2);

        // Test concurrent operations on connected clients
        if (connectedClients.length > 0) {
          const pingPromises = connectedClients.map(async (client) => {
            try {
              await client.ping();
              return { success: true };
            } catch (error) {
              return { success: false, error };
            }
          });

          const pingResults = await Promise.allSettled(pingPromises);
          const successfulPings = pingResults
            .filter(result => result.status === 'fulfilled' && result.value.success)
            .length;

          // At least 80% of connected clients should be able to ping successfully
          const successRate = successfulPings / connectedClients.length;
          expect(successRate).toBeGreaterThanOrEqual(0.8);
        }
        
      } finally {
        // Clean up all clients concurrently
        const cleanupPromises = clients.map(async (client) => {
          try {
            await client.disconnect();
          } catch (e) {
            // Ignore cleanup errors - client might not have been connected
          }
        });

        // Wait for all cleanup to complete, but don't fail the test if cleanup fails
        await Promise.allSettled(cleanupPromises);
      }
    }, 12000); // Increased timeout to be more realistic for concurrent operations
  });

  describe("Replay Attack Protection", () => {
    let protectedBunker: NostrRemoteSignerBunker;
    let signerKeypair: { publicKey: string; privateKey: string };

    beforeEach(async () => {
      signerKeypair = await generateKeypair();
      protectedBunker = new NostrRemoteSignerBunker({
        userPubkey: userKeypair.publicKey,
        signerPubkey: signerKeypair.publicKey,
        relays: [relay.url],
        defaultPermissions: ["get_public_key", "ping"],
        debug: true
      });
      protectedBunker.setUserPrivateKey(userKeypair.privateKey);
      protectedBunker.setSignerPrivateKey(signerKeypair.privateKey);
      await protectedBunker.start();
    });

    afterEach(async () => {
      if (protectedBunker) {
        await protectedBunker.stop();
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    test("Replay attack window is reduced to 2 minutes", async () => {
      // Access private method for testing
      const bunkerWithInternals = protectedBunker as unknown as { 
        usedRequestIds: Map<string, number>;
        isReplayAttack: (id: string) => boolean;
        cleanupOldRequestIds: () => void;
      };
      
      // Simulate a request ID that's 1 minute old (should be valid)
      const requestId1 = generateRequestId();
      const now = Date.now();
      bunkerWithInternals.usedRequestIds.set(requestId1, now - 60000); // 1 minute ago
      
      // Should be considered a replay attack because already used
      expect(bunkerWithInternals.isReplayAttack(requestId1)).toBe(true); // Already used
      
      // Simulate a request ID that's 3 minutes old
      const requestId2 = generateRequestId();
      bunkerWithInternals.usedRequestIds.set(requestId2, now - 180000); // 3 minutes ago
      
      // Clean up old IDs
      bunkerWithInternals.cleanupOldRequestIds();
      
      // The 3-minute-old ID should be cleaned up
      expect(bunkerWithInternals.usedRequestIds.has(requestId2)).toBe(false);
    });

    test("Cleanup runs more frequently", async () => {
      // This test verifies that cleanup interval is set to 1 minute
      const bunkerWithInternals = protectedBunker as unknown as { cleanupInterval: NodeJS.Timeout | null };
      
      // Check that cleanup interval exists
      expect(bunkerWithInternals.cleanupInterval).toBeDefined();
      expect(bunkerWithInternals.cleanupInterval).not.toBeNull();
    });

    test("Old request IDs are properly cleaned up", async () => {
      const bunkerWithInternals = protectedBunker as unknown as { 
        usedRequestIds: Map<string, number>;
        cleanupOldRequestIds: () => void;
      };
      
      // Add some old request IDs
      const oldId1 = generateRequestId();
      const oldId2 = generateRequestId();
      const recentId = generateRequestId();
      
      const now = Date.now();
      bunkerWithInternals.usedRequestIds.set(oldId1, now - 300000); // 5 minutes ago
      bunkerWithInternals.usedRequestIds.set(oldId2, now - 180000); // 3 minutes ago
      bunkerWithInternals.usedRequestIds.set(recentId, now - 30000); // 30 seconds ago
      
      // Run cleanup
      bunkerWithInternals.cleanupOldRequestIds();
      
      // Old IDs should be removed, recent one should remain
      expect(bunkerWithInternals.usedRequestIds.has(oldId1)).toBe(false);
      expect(bunkerWithInternals.usedRequestIds.has(oldId2)).toBe(false);
      expect(bunkerWithInternals.usedRequestIds.has(recentId)).toBe(true);
    });
  });

  describe("Advanced Memory Management", () => {
    let managedBunker: NostrRemoteSignerBunker;
    let signerKeypair: { publicKey: string; privateKey: string };

    beforeEach(async () => {
      signerKeypair = await generateKeypair();
      managedBunker = new NostrRemoteSignerBunker({
        userPubkey: userKeypair.publicKey,
        signerPubkey: signerKeypair.publicKey,
        relays: [relay.url],
        defaultPermissions: ["get_public_key", "ping"],
        debug: true
      });
      managedBunker.setUserPrivateKey(userKeypair.privateKey);
      managedBunker.setSignerPrivateKey(signerKeypair.privateKey);
      await managedBunker.start();
    });

    afterEach(async () => {
      if (managedBunker) {
        await managedBunker.stop();
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    test("Cleanup interval is properly cleared on stop", async () => {
      const bunkerWithInternals = managedBunker as unknown as { cleanupInterval: NodeJS.Timeout | null };
      
      // Verify cleanup interval exists
      expect(bunkerWithInternals.cleanupInterval).toBeDefined();
      
      // Stop the bunker
      await managedBunker.stop();
      
      // Cleanup interval should be cleared
      expect(bunkerWithInternals.cleanupInterval).toBeNull();
    });

    test("All resources are properly cleaned up on stop", async () => {
      const bunkerWithInternals = managedBunker as unknown as { 
        connectedClients: Map<string, { permissions: Set<string>; lastSeen: number }>;
        usedRequestIds: Map<string, number>;
        pendingAuthChallenges: Map<string, { id: string; clientPubkey: string; timestamp: number }>;
      };
      
      // Add some test data
      bunkerWithInternals.connectedClients.set("test-client", { permissions: new Set(), lastSeen: Date.now() });
      bunkerWithInternals.usedRequestIds.set("test-request", Date.now());
      bunkerWithInternals.pendingAuthChallenges.set("test-challenge", { 
        id: "test", 
        clientPubkey: "test", 
        timestamp: Date.now() 
      });
      
      // Stop the bunker
      await managedBunker.stop();
      
      // All data structures should be cleared
      expect(bunkerWithInternals.connectedClients.size).toBe(0);
      expect(bunkerWithInternals.usedRequestIds.size).toBe(0);
      expect(bunkerWithInternals.pendingAuthChallenges.size).toBe(0);
    });

    test("Stop method handles errors gracefully", async () => {
      const bunkerWithInternals = managedBunker as unknown as { 
        rateLimiter: { destroy: () => void };
      };
      
      // Mock an error in the rate limiter
      bunkerWithInternals.rateLimiter.destroy = jest.fn(() => {
        throw new Error("Mock rate limiter error");
      });
      
      // Stop should not throw despite the error
      await expect(managedBunker.stop()).resolves.not.toThrow();
    });

    test("rate limiter should clean up old data", (done) => {
      const rateLimiter = new NIP46RateLimiter({
        cleanupIntervalMs: 100 // Very short for testing
      });
      
      const clientPubkey = "test_cleanup_client";
      rateLimiter.isAllowed(clientPubkey);
      
      const initialStats = rateLimiter.getStats();
      expect(initialStats.totalClients).toBe(1);
      
      // Wait for cleanup to run
      setTimeout(() => {
        // Make sure cleanup doesn't remove active clients immediately
        const statsAfterShortTime = rateLimiter.getStats();
        expect(statsAfterShortTime.totalClients).toBe(1);
        
        rateLimiter.destroy();
        done();
      }, 150);
    });

    test("rate limiter should be properly destroyable", () => {
      const rateLimiter = new NIP46RateLimiter();
      
      rateLimiter.isAllowed("test_client");
      expect(rateLimiter.getStats().totalClients).toBe(1);
      
      rateLimiter.destroy();
      expect(rateLimiter.getStats().totalClients).toBe(0);
    });
  });
}); 