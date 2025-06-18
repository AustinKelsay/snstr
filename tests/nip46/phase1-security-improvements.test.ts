import {
  SimpleNIP46Client,
  NostrRemoteSignerBunker,
  generateKeypair,
} from "../../src";
import { NostrRelay } from "../../src/utils/ephemeral-relay";
import {
  NIP46SecurityError,
} from "../../src/nip46/types";
import { NIP46Validator } from "../../src/nip46/utils/validator";
import { parseConnectionString } from "../../src/nip46/utils/connection";

describe("NIP-46 Phase 1 Security Improvements", () => {
  let relay: NostrRelay;
  let relayUrl: string;
  let userKeypair: { publicKey: string; privateKey: string };
  let signerKeypair: { publicKey: string; privateKey: string };

  beforeAll(async () => {
    // Start ephemeral relay for testing (use 0 to let OS assign free port)
    relay = new NostrRelay(0);
    await relay.start();
    relayUrl = relay.url;

    // Generate keypairs
    userKeypair = await generateKeypair();
    signerKeypair = await generateKeypair();

    // Give the relay time to start properly
    await new Promise((resolve) => setTimeout(resolve, 500));
  }, 10000);

  afterAll(async () => {
    try {
      if (relay) {
        await relay.close();
      }
    } catch (error) {
      // Ignore cleanup errors
    }
    
    // Force cleanup of any remaining resources
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }, 15000);

  describe("Custom Permission Handler", () => {
    let bunker: NostrRemoteSignerBunker;
    let client: SimpleNIP46Client;

    beforeEach(async () => {
      bunker = new NostrRemoteSignerBunker({
        userPubkey: userKeypair.publicKey,
        signerPubkey: signerKeypair.publicKey,
        relays: [relayUrl],
        defaultPermissions: ["get_public_key", "ping", "sign_event"],
        debug: true,
      });

      bunker.setUserPrivateKey(userKeypair.privateKey);
      bunker.setSignerPrivateKey(signerKeypair.privateKey);

      await bunker.start();

      client = new SimpleNIP46Client([relayUrl], {
        timeout: 5000,
        debug: true,
      });
    });

    afterEach(async () => {
      // Disconnect client first
      try {
        if (client) {
          await client.disconnect();
          client = null as any;
        }
      } catch (error) {
        // Ignore cleanup errors
      }
      
      // Stop bunker second
      try {
        if (bunker) {
          await bunker.stop();
          bunker = null as any;
        }
      } catch (error) {
        // Ignore cleanup errors
      }
      
      // Give time for all resources to cleanup
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    test("Custom permission handler allows specific operations", async () => {
      // Set up custom permission handler that only allows kind 1 events
      bunker.setPermissionHandler((_clientPubkey, method, params) => {
        if (method === "sign_event") {
          try {
            const eventData = JSON.parse(params[0]);
            return eventData.kind === 1; // Only allow kind 1 (text notes)
          } catch {
            return false;
          }
        }
        return null; // Use default permission checking for other methods
      });

      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      // Should allow kind 1 event
      const kind1Event = await client.signEvent({
        kind: 1,
        content: "This should work",
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
      });
      expect(kind1Event.kind).toBe(1);

      // Should reject kind 4 event
      await expect(
        client.signEvent({
          kind: 4,
          content: "This should fail",
          created_at: Math.floor(Date.now() / 1000),
          tags: [["p", "recipient"]],
        })
      ).rejects.toThrow();
    });

    test("Custom permission handler can be cleared", async () => {
      // Set strict handler
      bunker.setPermissionHandler(() => false);

      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);

      // Should reject everything
      await expect(
        client.signEvent({
          kind: 1,
          content: "Should fail",
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
        })
      ).rejects.toThrow();

      // Clear handler and add default permissions
      bunker.clearPermissionHandler();
      bunker.setPermissionHandler((_clientPubkey, method, _params) => {
        if (method === "sign_event") return true;
        return null;
      });

      // Should now work
      const event = await client.signEvent({
        kind: 1,
        content: "Should work now",
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
      });
      expect(event.kind).toBe(1);
    });
  });

  describe("Enhanced Input Validation", () => {
    test("Validates event IDs correctly", () => {
      expect(NIP46Validator.validateEventId("a".repeat(64))).toBe(true);
      expect(NIP46Validator.validateEventId("A".repeat(64))).toBe(true);
      expect(NIP46Validator.validateEventId("1234567890abcdef".repeat(4))).toBe(true);
      
      expect(NIP46Validator.validateEventId("")).toBe(false);
      expect(NIP46Validator.validateEventId("a".repeat(63))).toBe(false);
      expect(NIP46Validator.validateEventId("a".repeat(65))).toBe(false);
      expect(NIP46Validator.validateEventId("xyz" + "a".repeat(61))).toBe(false);
    });

    test("Validates signatures correctly", () => {
      expect(NIP46Validator.validateSignature("a".repeat(128))).toBe(true);
      expect(NIP46Validator.validateSignature("A".repeat(128))).toBe(true);
      expect(NIP46Validator.validateSignature("1234567890abcdef".repeat(8))).toBe(true);
      
      expect(NIP46Validator.validateSignature("")).toBe(false);
      expect(NIP46Validator.validateSignature("a".repeat(127))).toBe(false);
      expect(NIP46Validator.validateSignature("a".repeat(129))).toBe(false);
      expect(NIP46Validator.validateSignature("xyz" + "a".repeat(125))).toBe(false);
    });

    test("Validates JSON input securely", () => {
      const validJson = '{"test": "value"}';
      const result = NIP46Validator.validateAndParseJson(validJson);
      expect(result.valid).toBe(true);
      expect(result.data).toEqual({ test: "value" });

      const invalidJson = '{"test": value}'; // Missing quotes
      const result2 = NIP46Validator.validateAndParseJson(invalidJson);
      expect(result2.valid).toBe(false);
      expect(result2.error).toContain("JSON parsing failed");

      const tooLarge = "a".repeat(70000);
      const result3 = NIP46Validator.validateAndParseJson(tooLarge);
      expect(result3.valid).toBe(false);
      expect(result3.error).toBe("JSON string too large");
    });

    test("Relaxed timestamp validation for offline signing", () => {
      const now = Math.floor(Date.now() / 1000);
      
      // Should allow up to 24 hours difference
      expect(NIP46Validator.validateTimestamp(now - 86000, 86400)).toBe(true); // ~23.9 hours ago with 24h tolerance
      expect(NIP46Validator.validateTimestamp(now + 86000, 86400)).toBe(false); // Future timestamps not allowed
      expect(NIP46Validator.validateTimestamp(now - 90000, 86400)).toBe(false); // >25 hours ago
    });
  });

  describe("Connection String Security", () => {
    test("Validates connection string length", () => {
      const longString = "bunker://" + "a".repeat(8200);
      expect(() => parseConnectionString(longString)).toThrow(NIP46SecurityError);
    });

    test("Rejects dangerous characters", () => {
      const maliciousStrings = [
        "bunker://abc<script>alert(1)</script>def",
        "bunker://abc'onload=alert(1)'def",
        'bunker://abc"onload=alert(1)"def',
        "bunker://abc>alert(1)<def",
      ];

      maliciousStrings.forEach(str => {
        expect(() => parseConnectionString(str)).toThrow(NIP46SecurityError);
      });
    });

    test("Validates secret token length", () => {
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

    test("Sanitizes metadata fields", () => {
      const validPubkey = "a".repeat(64);
      const dangerousName = "App<script>alert(1)</script>";
      const connection = parseConnectionString(
        `bunker://${validPubkey}?name=${encodeURIComponent(dangerousName)}`
      );
      
      // Should be sanitized
      expect(connection.metadata?.name).not.toContain("<script>");
      expect(connection.metadata?.name).toBe("Appscriptalert(1)/script");
    });

    test("Validates permissions format", () => {
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

    test("Validates metadata URLs", () => {
      const validPubkey = "a".repeat(64);
      
      // Invalid URL should be filtered out
      const connection = parseConnectionString(
        `bunker://${validPubkey}?url=${encodeURIComponent("not-a-url")}&image=https://example.com/valid.png`
      );
      
      expect(connection.metadata?.url).toBeUndefined();
      expect(connection.metadata?.image).toBe("https://example.com/valid.png");
    });
  });
}); 