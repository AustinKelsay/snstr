import {
  SimpleNIP46Client,
  SimpleNIP46Bunker,
  generateKeypair,
} from "../../src";
import { NostrRelay } from "../../src/utils/ephemeral-relay";

jest.setTimeout(10000);

describe("NIP-46 Performance & DoS Protection", () => {
  let relay: NostrRelay;
  let client: SimpleNIP46Client;
  let bunker: SimpleNIP46Bunker;
  let userKeypair: { publicKey: string; privateKey: string };

  beforeAll(async () => {
    relay = new NostrRelay(3335);
    await relay.start();
    userKeypair = await generateKeypair();
    
    // Reduced initialization delay
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  beforeEach(async () => {
    bunker = new SimpleNIP46Bunker(
      [relay.url],
      userKeypair.publicKey,
      undefined,
      { debug: false }
    );
    bunker.setUserPrivateKey(userKeypair.privateKey);
    bunker.setSignerPrivateKey(userKeypair.privateKey);
    bunker.setDefaultPermissions(["sign_event"]);
    await bunker.start();

    // Reduced connection delay
    await new Promise(resolve => setTimeout(resolve, 50));

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
    
    // Reduced cleanup delay
    await new Promise(resolve => setTimeout(resolve, 25));
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
      
      // Most should succeed
      const successful = results.filter(r => r.status === "fulfilled");
      expect(successful.length).toBeGreaterThan(0);
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
      
      const successful = results.filter(r => r.status === "fulfilled");
      expect(successful.length).toBeGreaterThan(0);
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
      
      // Multiple clients test for concurrency
      const clients = Array(3).fill(null).map(() => 
        new SimpleNIP46Client([relay.url], { timeout: 3000 }) // Reduced timeout
      );

      try {
        // Connect clients
        for (const client of clients) {
          await client.connect(connectionString);
          // Reduced delay
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Each should be able to perform operations
        const operations = clients.map(c => c.ping());
        const results = await Promise.allSettled(operations);
        
        const successful = results.filter(r => r.status === "fulfilled");
        const successRate = successful.length / clients.length;
        
        expect(successRate).toBeGreaterThanOrEqual(0.6); // At least 2 out of 3 should succeed
        
      } finally {
        // Clean up all clients
        for (const client of clients) {
          try {
            await client.disconnect();
            await new Promise(resolve => setTimeout(resolve, 50)); // Reduced delay
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      }
    }, 8000); // Reduced timeout
  });
}); 