/**
 * Simplified test for NIP-47 client encryption tracking
 *
 * This test verifies that the client correctly tracks and uses the same
 * encryption scheme for decrypting responses as was used for the request.
 */

import { generateKeypair } from "../../src/utils/crypto";
import {
  NostrWalletConnectClient,
  NostrWalletService,
  WalletImplementation,
} from "../../src/nip47";
import {
  NIP47Method,
  NIP47EncryptionScheme,
  NIP47ConnectionOptions,
  NIP47Request,
} from "../../src/nip47/types";
import { NostrEvent } from "../../src/types/nostr";
import { NostrRelay } from "../../src/utils/ephemeral-relay";

// Type-safe interface for accessing private client methods in tests
interface ClientWithPrivateMethods {
  sendRequest: (request: NIP47Request, expiration?: number) => Promise<unknown>;
  handleResponse: (event: NostrEvent) => Promise<void>;
  chooseEncryptionScheme: () => NIP47EncryptionScheme;
  pendingRequests: Map<string, { encryptionScheme: NIP47EncryptionScheme; resolve: (response: unknown) => void }>;
}

describe("NIP-47: Client encryption tracking (simplified)", () => {
  let relay: NostrRelay;

  beforeAll(async () => {
    relay = new NostrRelay(0);
    await relay.start();
  });

  afterAll(async () => {
    if (relay) {
      await relay.close();
    }
  });

  test("should track and use the correct encryption scheme for responses", async () => {
    const serviceKeys = await generateKeypair();
    const clientKeys = await generateKeypair();

    // Mock wallet implementation
    const mockWallet: WalletImplementation = {
      getInfo: jest.fn().mockResolvedValue({
        alias: "Test Wallet",
        color: "#ff0000",
        pubkey:
          "0000000000000000000000000000000000000000000000000000000000000000",
        network: "bitcoin",
        methods: ["get_info", "get_balance"],
      }),
      getBalance: jest.fn().mockResolvedValue(50000000),
      payInvoice: jest.fn(),
      makeInvoice: jest.fn(),
      lookupInvoice: jest.fn(),
      listTransactions: jest.fn().mockResolvedValue([]),
      signMessage: jest.fn(),
    };

    // Create service that supports both encryption schemes
    const service = new NostrWalletService(
      {
        relays: [relay.url],
        pubkey: serviceKeys.publicKey,
        privkey: serviceKeys.privateKey,
        methods: [NIP47Method.GET_INFO, NIP47Method.GET_BALANCE],
        encryptionSchemes: [
          NIP47EncryptionScheme.NIP04,
          NIP47EncryptionScheme.NIP44_V2,
        ],
      },
      mockWallet,
    );

    await service.init();

    // Create client preferring NIP-44
    const connectionOptions: NIP47ConnectionOptions = {
      pubkey: serviceKeys.publicKey,
      secret: clientKeys.privateKey,
      relays: [relay.url],
      preferredEncryption: NIP47EncryptionScheme.NIP44_V2,
    };

    const client = new NostrWalletConnectClient(connectionOptions);

    // Track what encryption was used
    let requestEncryption: NIP47EncryptionScheme | undefined;
    let responseDecryption: NIP47EncryptionScheme | undefined;

    // Create a type-safe wrapper for accessing private methods
    const clientWithPrivates = client as unknown as ClientWithPrivateMethods;
    
    // Spy on the client's sendRequest to see what encryption it uses
    const originalSendRequest = clientWithPrivates.sendRequest.bind(client);
    clientWithPrivates.sendRequest = jest.fn(
      async (request: NIP47Request, expiration?: number) => {
        // Check the encryption scheme being used
        const chooseEncryption = clientWithPrivates.chooseEncryptionScheme.bind(
          client,
        );
        requestEncryption = chooseEncryption();
        return originalSendRequest(request, expiration);
      },
    );

    // Spy on handleResponse to see what decryption is used
    const originalHandleResponse = clientWithPrivates.handleResponse.bind(client);
    clientWithPrivates.handleResponse = jest.fn(async (event: NostrEvent) => {
      // The handleResponse now uses tracked encryption
      const pendingRequests = clientWithPrivates.pendingRequests;

      // Get request ID from e-tag
      const eTag = event.tags.find((tag: string[]) => tag[0] === "e");
      if (eTag && eTag[1]) {
        const pending = pendingRequests.get(eTag[1]);
        if (pending) {
          responseDecryption = pending.encryptionScheme;
        }
      }

      return originalHandleResponse(event);
    });

    await client.init();

    // Wait for capabilities discovery
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Make a request
    const balance = await client.getBalance();
    expect(balance).toBe(50000000);

    // Verify that request and response used the same encryption
    expect(requestEncryption).toBe(NIP47EncryptionScheme.NIP44_V2);
    expect(responseDecryption).toBe(NIP47EncryptionScheme.NIP44_V2);
    expect(requestEncryption).toBe(responseDecryption);

    await client.disconnect();
    await service.disconnect();
  }, 10000);

  test("should fallback to NIP-04 when NIP-44 is not supported", async () => {
    const serviceKeys = await generateKeypair();
    const clientKeys = await generateKeypair();

    const mockWallet: WalletImplementation = {
      getInfo: jest.fn().mockResolvedValue({
        alias: "NIP-04 Only Wallet",
        methods: ["get_info"],
      }),
      getBalance: jest.fn().mockResolvedValue(100000),
      payInvoice: jest.fn(),
      makeInvoice: jest.fn(),
      lookupInvoice: jest.fn(),
      listTransactions: jest.fn().mockResolvedValue([]),
      signMessage: jest.fn(),
    };

    // Service that only supports NIP-04
    const service = new NostrWalletService(
      {
        relays: [relay.url],
        pubkey: serviceKeys.publicKey,
        privkey: serviceKeys.privateKey,
        methods: [NIP47Method.GET_INFO],
        encryptionSchemes: [NIP47EncryptionScheme.NIP04],
      },
      mockWallet,
    );

    await service.init();

    // Client preferring NIP-44 but will fall back to NIP-04
    const client = new NostrWalletConnectClient({
      pubkey: serviceKeys.publicKey,
      secret: clientKeys.privateKey,
      relays: [relay.url],
      preferredEncryption: NIP47EncryptionScheme.NIP44_V2,
    });

    // Track encryption
    let requestEncryption: NIP47EncryptionScheme | undefined;

    // Use the same type-safe interface
    const clientWithPrivates2 = client as unknown as ClientWithPrivateMethods;
    
    const originalSendRequest = clientWithPrivates2.sendRequest.bind(client);
    clientWithPrivates2.sendRequest = jest.fn(
      async (request: NIP47Request, expiration?: number) => {
        const chooseEncryption = clientWithPrivates2.chooseEncryptionScheme.bind(
          client,
        );
        requestEncryption = chooseEncryption();
        return originalSendRequest(request, expiration);
      },
    );

    await client.init();
    await new Promise((resolve) => setTimeout(resolve, 200));

    const info = await client.getInfo();
    expect(info).toBeDefined();

    // Should have fallen back to NIP-04
    expect(requestEncryption).toBe(NIP47EncryptionScheme.NIP04);

    await client.disconnect();
    await service.disconnect();
  }, 10000);
});
