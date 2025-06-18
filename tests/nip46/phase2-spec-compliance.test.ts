import { SimpleNIP46Client, SimpleNIP46Bunker } from "../../src/nip46";
import { 
  NIP46ErrorCode,
  NIP46ErrorUtils
} from "../../src/nip46/types";
import { TestManager } from "./test-utils";

describe("NIP-46 Phase 2: Spec Compliance", () => {
  let testManager: TestManager;

  beforeAll(async () => {
    testManager = new TestManager();
  });

  afterAll(async () => {
    await testManager.cleanup();
  });

  describe("Error Handling", () => {
    it("creates standardized error responses", () => {
      const response = NIP46ErrorUtils.createErrorResponse(
        "test-id",
        NIP46ErrorCode.PERMISSION_DENIED,
        "Not authorized for this action"
      );
      
      expect(response.id).toBe("test-id");
      expect(response.error).toBeTruthy();
      
      const errorObj = JSON.parse(response.error!);
      expect(errorObj.code).toBe(NIP46ErrorCode.PERMISSION_DENIED);
      expect(errorObj.message).toBe("Not authorized for this action");
    });

    it("provides error descriptions", () => {
      const description = NIP46ErrorUtils.getErrorDescription(NIP46ErrorCode.INVALID_PARAMETERS);
      expect(description).toBe("The provided parameters are invalid");
    });
  });

  describe("NIP-46 Method Support", () => {
    let client: SimpleNIP46Client;
    let bunker: SimpleNIP46Bunker;

    beforeEach(async () => {
      const setup = await testManager.createTestSetup();
      const pair = await testManager.createConnectedPair(setup);
      client = pair.client;
      bunker = pair.bunker;

      // Add required permissions for new methods
      bunker.addClientPermission(client["clientKeys"].publicKey, "get_relays");
      bunker.addClientPermission(client["clientKeys"].publicKey, "nip04_encrypt");
      bunker.addClientPermission(client["clientKeys"].publicKey, "nip04_decrypt");
      bunker.addClientPermission(client["clientKeys"].publicKey, "nip44_encrypt");
      bunker.addClientPermission(client["clientKeys"].publicKey, "nip44_decrypt");
    }, 15000);

    afterEach(async () => {
      // Clean up connections to prevent resource leaks
      if (client) {
        try {
          await client.disconnect();
        } catch (e) {
          // Ignore disconnect errors during cleanup
        }
      }
      if (bunker) {
        try {
          await bunker.stop();
        } catch (e) {
          // Ignore stop errors during cleanup
        }
      }
    }, 10000);

    it("get_relays method returns relay list", async () => {
      const relays = await client.getRelays();
      expect(Array.isArray(relays)).toBe(true);
      expect(relays.length).toBeGreaterThan(0);
    });

    it("disconnect method works properly", async () => {
      // First verify connection works
      const initialPing = await client.ping();
      expect(initialPing).toBe(true);
      
      // Disconnect should work
      await client.disconnect();
      
      // After disconnect, ping should return false (not throw)
      const disconnectedPing = await client.ping();
      expect(disconnectedPing).toBe(false);
    });

    it("supports NIP-44 encryption", async () => {
      const message = "Test message for NIP-44";
      const thirdPartyPubkey = "ff52567c0515054e4c022bc485891e0ebf3a175fe3d241458d7bc9ac1747d59f";
      
      const encrypted = await client.nip44Encrypt(thirdPartyPubkey, message);
      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(message);
      
      const decrypted = await client.nip44Decrypt(thirdPartyPubkey, encrypted);
      expect(decrypted).toBe(message);
    });

    it("supports NIP-04 encryption", async () => {
      const message = "Test message for both encryption methods";
      const thirdPartyPubkey = "ff52567c0515054e4c022bc485891e0ebf3a175fe3d241458d7bc9ac1747d59f";
      
      const encrypted = await client.nip04Encrypt(thirdPartyPubkey, message);
      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(message);
      
      const decrypted = await client.nip04Decrypt(thirdPartyPubkey, encrypted);
      expect(decrypted).toBe(message);
    });
  });
}); 