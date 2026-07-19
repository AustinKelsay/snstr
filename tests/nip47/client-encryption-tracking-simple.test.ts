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
  NIP47Logger,
} from "../../src/nip47/types";
import { dispatchNip47ClientResponse, NostrRelay } from "../../src/testing";

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

    await client.init();

    // Wait for capabilities discovery
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Make a request
    const balance = await client.getBalance();
    expect(balance).toBe(50000000);

    const request = relay.cache
      .filter((event) => event.kind === 23194)
      .reverse()
      .find((event) => event.pubkey === client.getPublicKey());
    expect(request?.tags).toContainEqual([
      "encryption",
      NIP47EncryptionScheme.NIP44_V2,
    ]);

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

    await client.init();
    await new Promise((resolve) => setTimeout(resolve, 200));

    const info = await client.getInfo();
    expect(info).toBeDefined();

    const request = relay.cache
      .filter((event) => event.kind === 23194)
      .reverse()
      .find((event) => event.pubkey === client.getPublicKey());
    expect(request?.tags.some((tag) => tag[0] === "encryption")).toBe(false);

    await client.disconnect();
    await service.disconnect();
  }, 10000);

  test("logs a response decryption failure exactly once", async () => {
    const serviceKeys = await generateKeypair();
    const clientKeys = await generateKeypair();
    const errors: string[] = [];
    const logger: NIP47Logger = {
      error: (message) => errors.push(message),
      warn: () => {},
      info: () => {},
      debug: () => {},
      trace: () => {},
    };
    const client = new NostrWalletConnectClient({
      pubkey: serviceKeys.publicKey,
      secret: clientKeys.privateKey,
      relays: [relay.url],
      logger,
    });
    await dispatchNip47ClientResponse(
      client,
      "request-id",
      NIP47EncryptionScheme.NIP04,
      {
        id: "response-id",
        pubkey: serviceKeys.publicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 23195,
        tags: [["e", "request-id"]],
        content: "invalid-encrypted-content",
        sig: "",
      },
    );

    expect(errors).toEqual([
      expect.stringContaining("Error handling nip04 response event"),
    ]);
  });
});
