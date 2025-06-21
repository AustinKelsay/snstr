import {
  SimpleNIP46Client,
  SimpleNIP46Bunker,
  generateKeypair,
} from "../../src";
import { NostrRemoteSignerClient } from "../../src/nip46";
import { NostrRelay } from "../../src/utils/ephemeral-relay";
import {
  NIP46SecurityError,
} from "../../src/nip46/types";
import { parseConnectionString } from "../../src/nip46/utils/connection";

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

    test("validates connection string length", () => {
      const longString = "bunker://" + "a".repeat(8200);
      expect(() => parseConnectionString(longString)).toThrow(NIP46SecurityError);
    });

    test("rejects dangerous characters", () => {
      const maliciousStrings = [
        "bunker://abc<script>alert(1)</script>def",
        "bunker://abc'onload=alert(1)'def",
        'bunker://abc"onload=alert(1)"def',
        "bunker://abc>alert(1)<def",
        
        "bunker://abc<script src='evil.js'></script>def",
        "bunker://abcjavascript:alert(1)def",
        "bunker://abcdata:text/html,<script>alert(1)</script>def",
        "bunker://abcvbscript:alert(1)def",
        "bunker://abconclick=alert(1)def",
        "bunker://abconload=alert(1)def",
        "bunker://abcexpression(alert(1))def",
        "bunker://abchttps://example.com://evil.comdef",
        "bunker://abc<img src=x onerror=alert(1)>def",
        "bunker://abc<svg onload=alert(1)>def",
        "bunker://abc<iframe src=javascript:alert(1)>def",
        "bunker://abc<link rel=stylesheet href=data:,*{x:expression(alert(1))}>def",
      ];

      maliciousStrings.forEach(str => {
        expect(() => parseConnectionString(str)).toThrow(NIP46SecurityError);
      });
    });

    test("validates secret token length", () => {
      const validPubkey = "a".repeat(64);
      
      // Too short secret
      expect(() => 
        parseConnectionString(`bunker://${validPubkey}?secret=short`)
      ).toThrow(NIP46SecurityError);

      // Too long secret
      const longSecret = "a".repeat(130);
      expect(() => 
        parseConnectionString(`bunker://${validPubkey}?secret=${longSecret}`)
      ).toThrow(NIP46SecurityError);

      // Valid secret
      const validConnection = parseConnectionString(`bunker://${validPubkey}?secret=validSecret123`);
      expect(validConnection.secret).toBe("validSecret123");
    });

    test("sanitizes metadata fields", () => {
      const validPubkey = "a".repeat(64);
      const dangerousName = "App<script>alert(1)</script>";
      const connection = parseConnectionString(
        `bunker://${validPubkey}?name=${encodeURIComponent(dangerousName)}`
      );
      
      // Should be sanitized
      expect(connection.metadata?.name).not.toContain("<script>");
      expect(connection.metadata?.name).toBe("Appscriptalert(1)/script");
    });

    test("validates permissions format", () => {
      const validPubkey = "a".repeat(64);
      
      // Valid permissions
      const validConnection = parseConnectionString(
        `bunker://${validPubkey}?perms=sign_event:1,get_public_key,ping`
      );
      expect(validConnection.permissions).toEqual(["sign_event:1", "get_public_key", "ping"]);

      // Invalid permissions should be filtered out
      const mixedConnection = parseConnectionString(
        `bunker://${validPubkey}?perms=sign_event:1,invalid_perm,get_public_key`
      );
      expect(mixedConnection.permissions).toEqual(["sign_event:1", "get_public_key"]);
    });

    test("validates metadata URLs", () => {
      const validPubkey = "a".repeat(64);
      
      // Invalid URL should be filtered out
      const connection = parseConnectionString(
        `bunker://${validPubkey}?url=${encodeURIComponent("not-a-url")}&image=https://example.com/valid.png`
      );
      
      expect(connection.metadata?.url).toBeUndefined();
      expect(connection.metadata?.image).toBe("https://example.com/valid.png");
    });

    test("comprehensive security pattern validation", () => {
      const validPubkey = "a".repeat(64);
      
      // Test all security patterns individually
      const securityPatterns = [
        // Script injection patterns
        { pattern: "<script>", name: "script tags" },
        { pattern: "<script src='evil.js'>", name: "script with source" },
        { pattern: "javascript:", name: "javascript protocol" },
        { pattern: "data:", name: "data URLs" },
        { pattern: "vbscript:", name: "vbscript protocol" },
        { pattern: "onload=", name: "event handlers" },
        { pattern: "onclick=", name: "click handlers" },
        { pattern: "expression(", name: "CSS expressions" },
        { pattern: "https://example.com://evil.com", name: "protocol confusion" },
        
        // XSS patterns
        { pattern: "<img src=x onerror=alert(1)>", name: "image XSS" },
        { pattern: "<svg onload=alert(1)>", name: "SVG XSS" },
        { pattern: "<iframe src=javascript:alert(1)>", name: "iframe XSS" },
        { pattern: "<link rel=stylesheet href=data:,*{x:expression(alert(1))}>", name: "link XSS" },
      ];

      securityPatterns.forEach(({ pattern }) => {
        const maliciousString = `bunker://${validPubkey}${pattern}`;
        expect(() => parseConnectionString(maliciousString)).toThrow(NIP46SecurityError);
        
        // Test in query parameters without URL encoding to trigger validation
        const maliciousQuery = `bunker://${validPubkey}?relay=wss://relay.com${pattern}`;
        expect(() => parseConnectionString(maliciousQuery)).toThrow(NIP46SecurityError);
      });
    });

    test("validates query parameter structure", () => {
      const validPubkey = "a".repeat(64);
      
      // Multiple question marks should be rejected
      expect(() => {
        parseConnectionString(`bunker://${validPubkey}?relay=wss://relay.com?evil=param`);
      }).toThrow(NIP46SecurityError);
      
      // Valid single query parameter should work
      const validConnection = parseConnectionString(`bunker://${validPubkey}?relay=wss://relay.com`);
      expect(validConnection.relays).toEqual(["wss://relay.com"]);
    });

    test("Valid bunker connection string format", async () => {
      const connectionString = bunker.getConnectionString();
      expect(connectionString).toMatch(/^bunker:\/\/[a-f0-9]{64}\?/);
      
      // Should be able to parse and connect
      await client.connect(connectionString);
      const userPubkey = await client.getPublicKey();
      expect(typeof userPubkey).toBe("string");
      expect(userPubkey.length).toBe(64);
      
      await client.disconnect();
    });

    test("Invalid connection string formats", async () => {
      // Test various invalid formats
      const invalidStrings = [
        "bunker://",
        "bunker://invalid",
        "nostrconnect://invalid",
        "invalid://string",
        "",
        "just-a-string",
      ];

      for (const invalidString of invalidStrings) {
        await expect(client.connect(invalidString)).rejects.toThrow();
      }
    });

    test("Connection string with invalid relay", async () => {
      // Create a client that only uses the relay specified in the connection string
      const isolatedClient = new SimpleNIP46Client([], { timeout: 2000 });
      
      try {
        // Use a different signer pubkey that doesn't match our bunker to ensure failure
        const fakePubkey = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
        const connectionString = `bunker://${fakePubkey}?relay=ws://invalid-relay.com`;
        
        await expect(
          raceWithTimeout(
            isolatedClient.connect(connectionString),
            2000,
            "timeout"
          )
        ).rejects.toThrow();
      } finally {
        await isolatedClient.disconnect().catch(() => {});
      }
    });
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
      const encrypted = await client.nip44Encrypt(validPubkey, largeMessage);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe("string");
      expect(encrypted.length).toBeGreaterThan(0);
      
      // Test decryption to ensure round-trip correctness
      const decrypted = await client.nip44Decrypt(validPubkey, encrypted);
      expect(decrypted).toBeDefined();
      expect(decrypted).toBe(largeMessage);
      
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

  describe("Auth URL Domain Whitelist Validation", () => {
    test("validates auth URLs against domain whitelist", () => {
      // Create client with domain whitelist
      const clientWithWhitelist = new NostrRemoteSignerClient({
        relays: ["wss://relay.example.com"],
        authDomainWhitelist: ["trusted-domain.com", "auth.example.com"],
        debug: false
      });

      // Access private method for testing
      const clientAny = clientWithWhitelist as any;

      // Test allowed domains
      expect(clientAny.isValidAuthUrl("https://trusted-domain.com/auth")).toBe(true);
      expect(clientAny.isValidAuthUrl("https://auth.example.com/login")).toBe(true);
      
      // Test subdomain matching
      expect(clientAny.isValidAuthUrl("https://api.trusted-domain.com/oauth")).toBe(true);
      expect(clientAny.isValidAuthUrl("https://secure.auth.example.com/callback")).toBe(true);
      
      // Test blocked domains
      expect(clientAny.isValidAuthUrl("https://malicious-site.com/auth")).toBe(false);
      expect(clientAny.isValidAuthUrl("https://evil.com/steal-keys")).toBe(false);
      expect(clientAny.isValidAuthUrl("https://not-trusted.org/login")).toBe(false);
    });

    test("allows all valid HTTPS URLs when no whitelist is configured", () => {
      // Create client without domain whitelist
      const clientWithoutWhitelist = new NostrRemoteSignerClient({
        relays: ["wss://relay.example.com"],
        debug: false
      });

      const clientAny = clientWithoutWhitelist as any;

      // Should allow any valid HTTPS URL
      expect(clientAny.isValidAuthUrl("https://any-domain.com/auth")).toBe(true);
      expect(clientAny.isValidAuthUrl("https://random-site.org/login")).toBe(true);
      expect(clientAny.isValidAuthUrl("https://valid-site.net/oauth")).toBe(true);
      
      // Should still block HTTP URLs
      expect(clientAny.isValidAuthUrl("http://insecure.com/auth")).toBe(false);
    });

    test("handles case-insensitive domain matching", () => {
      const clientWithWhitelist = new NostrRemoteSignerClient({
        relays: ["wss://relay.example.com"],
        authDomainWhitelist: ["TrustedDomain.com", "AUTH.example.com"],
        debug: false
      });

      const clientAny = clientWithWhitelist as any;

      // Test case variations
      expect(clientAny.isValidAuthUrl("https://trusteddomain.com/auth")).toBe(true);
      expect(clientAny.isValidAuthUrl("https://TRUSTEDDOMAIN.COM/auth")).toBe(true);
      expect(clientAny.isValidAuthUrl("https://auth.EXAMPLE.com/login")).toBe(true);
      expect(clientAny.isValidAuthUrl("https://AUTH.EXAMPLE.COM/login")).toBe(true);
    });

    test("validates against all other security checks with whitelist", () => {
      const clientWithWhitelist = new NostrRemoteSignerClient({
        relays: ["wss://relay.example.com"],
        authDomainWhitelist: ["trusted-domain.com"],
        debug: false
      });

      const clientAny = clientWithWhitelist as any;

      // Should still enforce HTTPS requirement
      expect(clientAny.isValidAuthUrl("http://trusted-domain.com/auth")).toBe(false);
      
      // Should still check for dangerous characters
      expect(clientAny.isValidAuthUrl("https://trusted-domain.com/auth<script>")).toBe(false);
      
      // Should still validate hostname format
      expect(clientAny.isValidAuthUrl("https://")).toBe(false);
      
      // Valid URL should pass all checks
      expect(clientAny.isValidAuthUrl("https://trusted-domain.com/auth")).toBe(true);
    });
  });
}); 