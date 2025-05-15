import {
  NostrRemoteSignerBunker,
  generateKeypair,
  NIP46BunkerOptions,
} from "../../src";
import { NIP46AuthChallenge } from "../../src/nip46/types";

// No need for interface since we're using 'as any' for testing

describe("NIP-46 Auth Challenges", () => {
  let userKeypair: { publicKey: string; privateKey: string };
  let signerKeypair: { publicKey: string; privateKey: string };
  let bunker: NostrRemoteSignerBunker;

  beforeEach(async () => {
    // Generate keypairs
    userKeypair = await generateKeypair();
    signerKeypair = await generateKeypair();
  });

  afterEach(async () => {
    // Stop bunker if it exists
    if (bunker) {
      await bunker.stop().catch(() => {});
    }
  });

  test("resolveAuthChallenge resolves a pending challenge", async () => {
    // Create bunker with auth challenge requirement
    const bunkerOptions: NIP46BunkerOptions = {
      relays: ["wss://localhost:3000"], // Doesn't need to be a real relay for this test
      userPubkey: userKeypair.publicKey,
      signerPubkey: signerKeypair.publicKey,
      requireAuthChallenge: true,
      authUrl: "https://example.com/auth",
      authTimeout: 5000, // Short timeout for tests
      debug: true, // Enable debug mode for testing
    };

    // Create bunker
    bunker = new NostrRemoteSignerBunker(bunkerOptions);
    bunker.setUserPrivateKey(userKeypair.privateKey);
    bunker.setSignerPrivateKey(signerKeypair.privateKey);

    // Manually add a pending challenge
    const challenge: NIP46AuthChallenge = {
      id: "test-id",
      clientPubkey: userKeypair.publicKey,
      timestamp: Date.now(),
      permissions: ["sign_event:1", "get_public_key"],
    };

    // Access private fields for testing purposes
    const testBunker = bunker as unknown as {
      pendingAuthChallenges: Map<string, NIP46AuthChallenge>;
      connectedClients: Map<string, { 
        permissions: Set<string>;
        lastSeen: number; 
      }>;
    };
    testBunker.pendingAuthChallenges.set("test-id", challenge);

    // Resolve the challenge
    const resolved = bunker.resolveAuthChallenge(userKeypair.publicKey);

    // Verify challenge was resolved
    expect(resolved).toBe(true);

    // Verify challenge was removed
    expect(testBunker.pendingAuthChallenges.size).toBe(0);

    // Verify client session was created with permissions
    const clientSession = testBunker.connectedClients.get(
      userKeypair.publicKey,
    );
    expect(clientSession).toBeTruthy();
    expect(clientSession!.permissions.has("sign_event:1")).toBe(true);
    expect(clientSession!.permissions.has("get_public_key")).toBe(true);
  });

  test("resolveAuthChallenge returns false when no challenges exist", async () => {
    // Create bunker
    const bunkerOptions: NIP46BunkerOptions = {
      relays: ["wss://localhost:3000"], // Doesn't need to be a real relay for this test
      userPubkey: userKeypair.publicKey,
      signerPubkey: signerKeypair.publicKey,
      debug: true, // Enable debug mode for testing
    };

    bunker = new NostrRemoteSignerBunker(bunkerOptions);

    // Try to resolve a non-existent challenge
    const resolved = bunker.resolveAuthChallenge(userKeypair.publicKey);

    // Verify no challenge was resolved
    expect(resolved).toBe(false);
  });
});
