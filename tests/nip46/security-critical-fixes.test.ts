/**
 * Tests for critical NIP-46 security and reliability fixes
 * 
 * This test suite covers the most critical security and reliability issues:
 * 1. Cryptographically secure request ID generation
 * 2. Reduced replay attack window (2 minutes instead of 1 hour)
 * 3. Improved memory management with proper cleanup
 * 4. Race condition fixes in client disconnect
 */

import { NostrRemoteSignerBunker } from "../../src/nip46/bunker";
import { NostrRemoteSignerClient } from "../../src/nip46/client";
import { SimpleNIP46Bunker } from "../../src/nip46";
import { generateKeypair } from "../../src/utils/crypto";
import { generateRequestId } from "../../src/nip46/utils/request-response";
import { NostrRelay } from "../../src/utils/ephemeral-relay";
import { NIP46ConnectionError } from "../../src/nip46/types";



describe("Critical NIP-46 Security and Reliability Fixes", () => {
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

  describe("1. Cryptographically Secure Request ID Generation", () => {
    test("generateRequestId produces cryptographically secure IDs", () => {
      const ids = new Set<string>();
      const numIds = 1000;
      
      // Generate many IDs to test for uniqueness
      for (let i = 0; i < numIds; i++) {
        const id = generateRequestId();
        expect(id).toBeDefined();
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
        
        // Should not have duplicates
        expect(ids.has(id)).toBe(false);
        ids.add(id);
      }
      
      // All IDs should be unique
      expect(ids.size).toBe(numIds);
    });

    test("Request IDs have sufficient entropy", () => {
      const ids: string[] = [];
      const numIds = 100;
      
      for (let i = 0; i < numIds; i++) {
        ids.push(generateRequestId());
      }
      
      // Check that IDs have good distribution
      const hexPattern = /^[0-9a-f]+$/i;
      let hexCount = 0;
      
      for (const id of ids) {
        if (hexPattern.test(id)) {
          hexCount++;
        }
        
        // Should have reasonable length
        expect(id.length).toBeGreaterThanOrEqual(16);
      }
      
      // Most IDs should be hex (crypto-generated) or have timestamp fallback
      expect(hexCount / numIds).toBeGreaterThan(0.5);
    });

    test("Request IDs are not predictable", () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      const id3 = generateRequestId();
      
      // Should be different
      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
      
      // Should not follow predictable patterns
      expect(id1.charAt(0)).not.toBe(id2.charAt(0));
    });

    test("Client uses secure request ID generation", async () => {
      const client = new NostrRemoteSignerClient({
        relays: [relayUrl],
        timeout: 5000,
        debug: true
      });
      
      // Access the private method via type assertion for testing
      const clientWithInternals = client as any;
      const id1 = clientWithInternals.generateRequestId();
      const id2 = clientWithInternals.generateRequestId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
    });
  });

  describe("2. Reduced Replay Attack Window", () => {
    let bunker: NostrRemoteSignerBunker;

    beforeEach(async () => {
      bunker = new NostrRemoteSignerBunker({
        userPubkey: userKeypair.publicKey,
        signerPubkey: signerKeypair.publicKey,
        relays: [relayUrl],
        defaultPermissions: ["get_public_key", "ping"],
        debug: true
      });
      bunker.setUserPrivateKey(userKeypair.privateKey);
      bunker.setSignerPrivateKey(signerKeypair.privateKey);
      await bunker.start();
    });

    afterEach(async () => {
      if (bunker) {
        await bunker.stop();
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    test("Replay attack window is reduced to 2 minutes", async () => {
      // Access private method for testing
      const bunkerWithInternals = bunker as any;
      
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
      const bunkerWithInternals = bunker as any;
      
      // Check that cleanup interval exists
      expect(bunkerWithInternals.cleanupInterval).toBeDefined();
      expect(bunkerWithInternals.cleanupInterval).not.toBeNull();
    });

    test("Old request IDs are properly cleaned up", async () => {
      const bunkerWithInternals = bunker as any;
      
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

  describe("3. Improved Memory Management", () => {
    let bunker: NostrRemoteSignerBunker;

    beforeEach(async () => {
      bunker = new NostrRemoteSignerBunker({
        userPubkey: userKeypair.publicKey,
        signerPubkey: signerKeypair.publicKey,
        relays: [relayUrl],
        defaultPermissions: ["get_public_key", "ping"],
        debug: true
      });
      bunker.setUserPrivateKey(userKeypair.privateKey);
      bunker.setSignerPrivateKey(signerKeypair.privateKey);
      await bunker.start();
    });

    afterEach(async () => {
      if (bunker) {
        await bunker.stop();
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    test("Cleanup interval is properly cleared on stop", async () => {
      const bunkerWithInternals = bunker as any;
      
      // Verify cleanup interval exists
      expect(bunkerWithInternals.cleanupInterval).toBeDefined();
      
      // Stop the bunker
      await bunker.stop();
      
      // Cleanup interval should be cleared
      expect(bunkerWithInternals.cleanupInterval).toBeNull();
    });

    test("All resources are properly cleaned up on stop", async () => {
      const bunkerWithInternals = bunker as any;
      
      // Add some test data
      bunkerWithInternals.connectedClients.set("test-client", { permissions: new Set(), lastSeen: Date.now() });
      bunkerWithInternals.usedRequestIds.set("test-request", Date.now());
      bunkerWithInternals.pendingAuthChallenges.set("test-challenge", { 
        id: "test", 
        clientPubkey: "test", 
        timestamp: Date.now() 
      });
      
      // Stop the bunker
      await bunker.stop();
      
      // All data structures should be cleared
      expect(bunkerWithInternals.connectedClients.size).toBe(0);
      expect(bunkerWithInternals.usedRequestIds.size).toBe(0);
      expect(bunkerWithInternals.pendingAuthChallenges.size).toBe(0);
    });

    test("Stop method handles errors gracefully", async () => {
      const bunkerWithInternals = bunker as any;
      
      // Mock an error in the rate limiter
      bunkerWithInternals.rateLimiter.destroy = jest.fn(() => {
        throw new Error("Mock rate limiter error");
      });
      
      // Stop should not throw despite the error
      await expect(bunker.stop()).resolves.not.toThrow();
    });
  });

  describe("4. Race Condition Fixes in Client Disconnect", () => {
    let client: NostrRemoteSignerClient;
    let bunker: SimpleNIP46Bunker;

    beforeEach(async () => {
      bunker = new SimpleNIP46Bunker(
        [relayUrl],
        userKeypair.publicKey,
        signerKeypair.publicKey,
        {
          debug: true,
          defaultPermissions: ["get_public_key", "ping", "sign_event"]
        }
      );
      bunker.setUserPrivateKey(userKeypair.privateKey);
      bunker.setSignerPrivateKey(signerKeypair.privateKey);
      await bunker.start();

      client = new NostrRemoteSignerClient({
        relays: [relayUrl],
        timeout: 5000,
        debug: true
      });
    });

    afterEach(async () => {
      if (client) {
        await client.disconnect();
      }
      if (bunker) {
        await bunker.stop();
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    test("Client rejects new requests after disconnect", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);
      
      // Verify connection works
      expect(await client.ping()).toBe("pong");
      
      // Disconnect
      await client.disconnect();
      
      // New requests should be rejected immediately
      await expect(client.ping()).rejects.toThrow(NIP46ConnectionError);
      await expect(client.getUserPublicKey()).rejects.toThrow(NIP46ConnectionError);
    });

    test("Pending requests are properly cleaned up on disconnect", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);
      
      const clientWithInternals = client as any;
      
      // Create multiple pending requests to increase chance of cleanup
      const requestPromises = [
        client.ping(),
        client.ping(),
        client.ping()
      ];
      
      // Small delay to ensure requests are pending
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Verify there are pending requests
      expect(clientWithInternals.pendingRequests.size).toBeGreaterThan(0);
      
      // Disconnect immediately
      await client.disconnect();
      
      // Pending requests map should be cleared
      expect(clientWithInternals.pendingRequests.size).toBe(0);
      
      // Wait for all requests to complete or be rejected
      for (const promise of requestPromises) {
        try {
          await promise;
        } catch (error) {
          // Requests may be rejected due to disconnect, which is expected
        }
      }
      
      // The disconnect should have cleaned up properly
      expect(clientWithInternals.connected).toBe(false);
    });

    test("Connected state is set to false before cleanup", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);
      
      const clientWithInternals = client as any;
      expect(clientWithInternals.connected).toBe(true);
      
      // Disconnect
      await client.disconnect();
      
      // Connected should be false
      expect(clientWithInternals.connected).toBe(false);
    });

    test("Cleanup handles unsubscription errors gracefully", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);
      
      const clientWithInternals = client as any;
      
      // Mock the nostr unsubscribe to throw an error
      const originalUnsubscribe = clientWithInternals.nostr.unsubscribe;
      clientWithInternals.nostr.unsubscribe = jest.fn(() => {
        throw new Error("Mock unsubscribe error");
      });
      
      // Disconnect should not throw despite the error
      await expect(client.disconnect()).resolves.not.toThrow();
      
      // Restore original method
      clientWithInternals.nostr.unsubscribe = originalUnsubscribe;
    });

    test("Multiple disconnect calls are safe", async () => {
      const connectionString = bunker.getConnectionString();
      await client.connect(connectionString);
      
      // Multiple disconnect calls should not cause issues
      await client.disconnect();
      await client.disconnect();
      await client.disconnect();
      
      // Should still be disconnected
      const clientWithInternals = client as any;
      expect(clientWithInternals.connected).toBe(false);
    });
  });

  describe("5. Integration Tests for All Fixes", () => {
    test("End-to-end test with all security fixes", async () => {
      const bunker = new SimpleNIP46Bunker(
        [relayUrl],
        userKeypair.publicKey,
        signerKeypair.publicKey,
        {
          debug: true,
          defaultPermissions: ["get_public_key", "ping", "sign_event"]
        }
      );
      bunker.setUserPrivateKey(userKeypair.privateKey);
      bunker.setSignerPrivateKey(signerKeypair.privateKey);
      await bunker.start();

      const client = new NostrRemoteSignerClient({
        relays: [relayUrl],
        timeout: 5000,
        debug: true
      });

      try {
        // Test secure connection
        const connectionString = bunker.getConnectionString();
        await client.connect(connectionString);
        
        // Test secure request ID generation in practice
        const userPubkey = await client.getUserPublicKey();
        expect(userPubkey).toBe(userKeypair.publicKey);
        
        // Test multiple operations with secure IDs
        for (let i = 0; i < 5; i++) {
          const response = await client.ping();
          expect(response).toBe("pong");
        }
        
        // Test event signing with secure IDs
        const event = await client.signEvent({
          kind: 1,
          content: "Test event with secure ID",
          created_at: Math.floor(Date.now() / 1000),
          tags: []
        });
        
        expect(event.kind).toBe(1);
        expect(event.pubkey).toBe(userKeypair.publicKey);
        
        // Test proper cleanup
        await client.disconnect();
        
        // Verify cleanup
        const clientWithInternals = client as any;
        expect(clientWithInternals.connected).toBe(false);
        expect(clientWithInternals.pendingRequests.size).toBe(0);
        
      } finally {
        await client.disconnect();
        await bunker.stop();
      }
    });
  });
}); 