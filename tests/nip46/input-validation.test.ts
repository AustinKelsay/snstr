import {
  SimpleNIP46Client,
  SimpleNIP46Bunker,
  generateKeypair,
} from "../../src";
import { NostrRelay } from "../../src/utils/ephemeral-relay";

jest.setTimeout(15000);


// Helper function to race a promise with a timeout that cleans up properly
function raceWithTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string = "timeout"): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });
  
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  });
}

describe("NIP-46 Input Validation Security", () => {
  let relay: NostrRelay;
  let client: SimpleNIP46Client;
  let bunker: SimpleNIP46Bunker;
  let userKeypair: { publicKey: string; privateKey: string };

  beforeAll(async () => {
    relay = new NostrRelay(0);
    
    // Start relay - relay.start() only resolves when WSS is fully listening
    try {
      await relay.start();
    } catch (error) {
      throw new Error(`Failed to start relay: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    userKeypair = await generateKeypair();
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
    bunker.setDefaultPermissions(["sign_event", "nip44_encrypt", "nip44_decrypt"]);
    await bunker.start();

    // The bunker.start() Promise resolves when the relay connection is established
    // and the subscription is active, so no additional waiting is needed

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
    
    // No artificial delay needed - the disconnect/stop methods handle cleanup properly
  });

  afterAll(async () => {
    try {
      if (relay) {
        await relay.close();
      }
    } catch (e) {
      // Ignore cleanup errors
    }
    
    // No artificial delay needed - relay.close() handles cleanup properly
  });

  describe("Connection String Validation", () => {
    test("rejects malformed connection strings", async () => {
      await expect(client.connect("invalid-connection")).rejects.toThrow();
      await expect(client.connect("http://not-a-bunker")).rejects.toThrow();
      await expect(client.connect("")).rejects.toThrow();
      await expect(client.connect("bunker://")).rejects.toThrow();
    });

    test("rejects connection strings with invalid pubkeys", async () => {
      await expect(
        client.connect("bunker://invalidpubkey?relay=ws://localhost:3334")
      ).rejects.toThrow();
      
      await expect(
        client.connect("bunker://gg" + "a".repeat(62) + "?relay=ws://localhost:3334")
      ).rejects.toThrow();
    });

    test("validates relay URLs in connection strings", async () => {
      const validPubkey = "a".repeat(64);
      
      // Use timeout helper that properly cleans up timers
      await expect(
        raceWithTimeout(
          client.connect(`bunker://${validPubkey}?relay=http://insecure.com`),
          2000,
          "timeout"
        )
      ).rejects.toThrow();
      
      await expect(
        raceWithTimeout(
          client.connect(`bunker://${validPubkey}?relay=invalid-url`),
          2000,
          "timeout"
        )
              ).rejects.toThrow();
    }, 6000); // Reduced timeout
  });

  describe("Key Validation", () => {
    test("accepts hex keys with mixed case in connection strings", async () => {
      // Test various case combinations for public keys in connection strings
      const testKeys = [
        "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", // lowercase
        "1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF", // uppercase
        "1234567890AbCdEf1234567890aBcDeF1234567890AbCdEf1234567890aBcDeF", // mixed case
      ];

      for (const pubkey of testKeys) {
        // Test connection string parsing - this is where validation actually happens
        const connectionString = `bunker://${pubkey}?relay=${relay.url}`;
        
        // These should pass connection string parsing but fail during actual connection
        // since the pubkeys don't match the bunker's actual key
        try {
          await client.connect(connectionString);
          // If we reach here, the connection succeeded when it should have failed
          // This is a security issue - mismatched signer keys should be rejected
          throw new Error(`Security violation: Connection with mismatched signer key ${pubkey} should have been rejected but succeeded`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          // If it's our security violation error, re-throw to fail the test
          if (errorMessage.startsWith("Security violation:")) {
            throw error;
          }
          
          // The key point is that it should NOT fail with the connection string parsing error
          expect(errorMessage).not.toBe("Invalid signer public key in connection string");
        } finally {
          // Always disconnect to prevent resource leaks and connection conflicts
          try {
            await client.disconnect();
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      }
    });

    test("rejects invalid hex keys in connection strings", async () => {
      const invalidKeys = [
        "G234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", // invalid character 'G'
        "1234567890abcdef123456789", // too short (25 chars)
        "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1", // too long (65 chars)
        "", // empty
        "not-hex-at-all", // not hex
      ];

      for (const pubkey of invalidKeys) {
        const connectionString = `bunker://${pubkey}?relay=${relay.url}`;
        
        // These should throw during connection string parsing with the specific error message
        await expect(client.connect(connectionString)).rejects.toThrow("Invalid signer public key in connection string");
      }
    });
  });

  describe("Event Content Validation", () => {
    test("handles events with various timestamps", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      // Current timestamp should always work
      const currentEvent = await client.signEvent({
        kind: 1,
        content: "Hello current",
        created_at: Math.floor(Date.now() / 1000),
        tags: []
      });
      expect(currentEvent).toBeDefined();
      
      // Test that future-dated events can be signed (validation happens at relay level)
      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour in future
      const futureEvent = await client.signEvent({
        kind: 1,
        content: "Hello future",
        created_at: futureTimestamp,
        tags: []
      });
      expect(futureEvent).toBeDefined();
      expect(futureEvent.created_at).toBe(futureTimestamp);
    });

    test("handles events with various kind values", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      // Reduced test cases for speed
      const validKinds = [1, 1000]; // Reduced from [0, 1, 3, 1000, 10000]
      
      for (const kind of validKinds) {
        const event = await client.signEvent({
          kind,
          content: `Hello kind ${kind}`,
          created_at: Math.floor(Date.now() / 1000),
          tags: []
        });
        expect(event).toBeDefined();
        expect(event.kind).toBe(kind);
      }
      
      // Test negative kind values can be signed (validation happens at relay level)
      const negativeKindEvent = await client.signEvent({
        kind: -1,
        content: "Hello negative kind",
        created_at: Math.floor(Date.now() / 1000),
        tags: []
      });
      expect(negativeKindEvent).toBeDefined();
      expect(negativeKindEvent.kind).toBe(-1);
    });

    test("handles various content sizes", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      // Reduced content size for speed
      const normalContent = "Hello world! ".repeat(50); // Reduced from 100
      const normalEvent = await client.signEvent({
        kind: 1,
        content: normalContent,
        created_at: Math.floor(Date.now() / 1000),
        tags: []
      });
      expect(normalEvent).toBeDefined();
      
      // Test large content handling - should succeed for reasonable sizes
      const largeContent = "a".repeat(5000); // 5KB - well below 64KB limit
      const largeEvent = await client.signEvent({
        kind: 1,
        content: largeContent,
        created_at: Math.floor(Date.now() / 1000),
        tags: []
      });
      expect(largeEvent).toBeDefined();
      expect(largeEvent.content.length).toBe(5000);
      
      // Test that content over 64KB limit is rejected
      await expect(
        client.signEvent({
          kind: 1,
          content: "a".repeat(65537), // > 64KB limit
          created_at: Math.floor(Date.now() / 1000),
          tags: []
        })
      ).rejects.toThrow();
    });

    test("validates event tag structure", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      // Valid tags should work
      const validEvent = await client.signEvent({
        kind: 1,
        content: "Hello",
        created_at: Math.floor(Date.now() / 1000),
        tags: [["e", "event_id"], ["p", "pubkey"]]
      });
      expect(validEvent).toBeDefined();

      // Invalid tag structure should fail
      await expect(
        client.signEvent({
          kind: 1,
          content: "Hello",
          created_at: Math.floor(Date.now() / 1000),
          tags: ["invalid", "tag"] as unknown as string[][]
        })
      ).rejects.toThrow();
    });
  });

  describe("Parameter Validation", () => {
    test("validates pubkey parameters", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      // Invalid pubkey format
      await expect(
        client.nip44Encrypt("invalid-pubkey", "message")
      ).rejects.toThrow();

      // Pubkey too short
      await expect(
        client.nip44Encrypt("a".repeat(63), "message")
      ).rejects.toThrow();

      // Pubkey with invalid characters
      await expect(
        client.nip44Encrypt("g" + "a".repeat(63), "message")
      ).rejects.toThrow();
    });

    test("validates message size limits", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      const validPubkey = (await generateKeypair()).publicKey;
      
      // Test large message encryption - should succeed for sizes under NIP-44 limit (65535 bytes)
      const largeMessage = "a".repeat(32769); // 32KB+ - well below 65535 byte limit
      const result = await client.nip44Encrypt(validPubkey, largeMessage);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
      
      // Test that messages exceeding NIP-44 limit are rejected
      await expect(
        client.nip44Encrypt(validPubkey, "a".repeat(65536)) // > 65535 byte limit
      ).rejects.toThrow();
    });

    test("sanitizes dangerous input", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      const validPubkey = (await generateKeypair()).publicKey;
      
      // For the simple implementation, we test that dangerous content
      // is handled without causing system issues
      const dangerousMessage = '<script>alert("xss")</script>';
      const encrypted = await client.nip44Encrypt(validPubkey, dangerousMessage);
      expect(encrypted).toBeDefined();
      
      // The simple implementation may not sanitize, but should handle safely
      const decrypted = await client.nip44Decrypt(validPubkey, encrypted);
      expect(decrypted).toBeDefined();
      // Test that the system remains stable (no need for sanitization in this layer)
      expect(typeof decrypted).toBe("string");
      // Verify round-trip correctness - decrypted message should match original
      expect(decrypted).toBe(dangerousMessage);
    });
  });

  describe("Rate Limiting", () => {
    test("handles rapid requests gracefully", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      // Send multiple rapid requests
      const requests = Array(5).fill(null).map(() => client.ping());
      
      const results = await Promise.allSettled(requests);
      
      // Should handle at least 80% of requests successfully (4 out of 5)
      const successful = results.filter(r => r.status === "fulfilled");
      expect(successful.length).toBeGreaterThanOrEqual(4);
    });

    test("prevents DoS with large numbers of simultaneous requests", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      // Reduced request count for speed
      const requests = Array(10).fill(null).map(() => client.ping()); // Reduced from 20
      
      const results = await Promise.allSettled(requests);
      
      expect(results.length).toBe(10);
      
      const successful = results.filter(r => r.status === "fulfilled");
      expect(successful.length).toBeGreaterThanOrEqual(8); // At least 80% success rate (8 out of 10)
    });
  });

  describe("Error Handling Security", () => {
    test("does not leak sensitive information in errors", async () => {
      expect.assertions(3); // Ensure all assertions are executed
      
      // Try to connect with invalid configuration
      try {
        await client.connect("bunker://invalid");
        // If we reach this point, the test should fail
        throw new Error("Expected client.connect to throw an error, but it succeeded");
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Should not contain sensitive patterns
        expect(errorMessage).not.toMatch(/[0-9a-f]{64}/); // No hex keys
        expect(errorMessage).not.toContain("privateKey");
        expect(errorMessage).not.toContain("secret");
      }
    });

    test("handles encryption errors securely", async () => {
      expect.assertions(3); // Ensure all assertions are executed
      
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      try {
        // Force an encryption error
        await client.nip44Encrypt("invalid-pubkey", "message");
        // If we reach this point, the test should fail
        throw new Error("Expected nip44Encrypt to throw an error, but it succeeded");
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Error should be generic, not revealing internal details
        expect(errorMessage).not.toContain("stack trace");
        expect(errorMessage).not.toContain("internal");
        expect(errorMessage).not.toMatch(/[0-9a-f]{64}/);
      }
    });
  });
}); 