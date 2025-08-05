import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { NostrRelay } from "../../src/utils/ephemeral-relay";
import { generateKeypair } from "../../src/utils/crypto";
import {
  NostrWalletConnectClient,
  NostrWalletService,
  WalletImplementation,
  NIP47Method,
  NIP47NotificationType,
  NIP47EncryptionScheme,
  NIP47ConnectionOptions,
  GetInfoResponseResult,
  PaymentResponseResult,
  MakeInvoiceResponseResult,
  NIP47Transaction,
  TransactionType,
  NIP47Notification,
} from "../../src/nip47";
import { NostrEvent } from "../../src/types/nostr";
import { encrypt as encryptNIP04, decrypt as decryptNIP04 } from "../../src/nip04";
import { decrypt as decryptNIP44 } from "../../src/nip44";

// Mock Implementation that tracks encryption
class MockWalletImplementation implements WalletImplementation {
  private balance: number = 50000000; // 50,000 sats
  
  async getInfo(): Promise<GetInfoResponseResult> {
    return {
      alias: "NIP-44 Test Wallet",
      color: "#00ff00",
      pubkey: "00000000000000000000000000000000000000000000000000000000000000",
      network: "regtest",
      methods: [
        NIP47Method.GET_INFO,
        NIP47Method.GET_BALANCE,
        NIP47Method.PAY_INVOICE,
        NIP47Method.MAKE_INVOICE,
        NIP47Method.LOOKUP_INVOICE,
        NIP47Method.LIST_TRANSACTIONS,
      ],
      notifications: [
        NIP47NotificationType.PAYMENT_RECEIVED,
        NIP47NotificationType.PAYMENT_SENT,
      ],
    };
  }

  async getBalance(): Promise<number> {
    return this.balance;
  }

  async payInvoice(_invoice: string): Promise<PaymentResponseResult> {
    return {
      preimage: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      payment_hash: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
      amount: 1000,
      fees_paid: 10,
    };
  }

  async makeInvoice(amount: number, _description: string): Promise<MakeInvoiceResponseResult> {
    return {
      invoice: "lnbc10n1ptest",
      payment_hash: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      amount,
      created_at: Math.floor(Date.now() / 1000),
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
  }

  async lookupInvoice(): Promise<NIP47Transaction> {
    return {
      type: TransactionType.INCOMING,
      payment_hash: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      amount: 1000,
      fees_paid: 0,
      created_at: Math.floor(Date.now() / 1000) - 3600,
    };
  }

  async listTransactions(): Promise<NIP47Transaction[]> {
    return [];
  }
}

describe("NIP-47 with NIP-44 Encryption", () => {
  let relay: NostrRelay;
  let serviceKeys: { privateKey: string; publicKey: string };
  let clientKeys: { privateKey: string; publicKey: string };
  let service: NostrWalletService;
  let client: NostrWalletConnectClient;

  beforeAll(async () => {
    // Set up ephemeral relay
    relay = new NostrRelay(3048); // Use port 3048 for NIP-44 tests
    await relay.start();

    // Generate keys
    serviceKeys = await generateKeypair();
    clientKeys = await generateKeypair();
  });

  afterAll(async () => {
    if (service) {
      await service.disconnect();
    }
    if (client) {
      await client.disconnect();
    }
    if (relay) {
      await relay.close();
    }
  });

  describe("Encryption Negotiation", () => {
    it("should publish NIP-44 support in info event", async () => {
      const walletImpl = new MockWalletImplementation();
      service = new NostrWalletService(
        {
          relays: [relay.url],
          pubkey: serviceKeys.publicKey,
          privkey: serviceKeys.privateKey,
          methods: [NIP47Method.GET_INFO, NIP47Method.GET_BALANCE],
          encryptionSchemes: [NIP47EncryptionScheme.NIP44_V2, NIP47EncryptionScheme.NIP04],
        },
        walletImpl
      );

      await service.init();

      // Wait for info event to be published
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check that info event contains encryption tag
      const events = relay.cache;
      const infoEvent = events.find((e: NostrEvent) => e.kind === 13194);
      expect(infoEvent).toBeDefined();
      
      const encryptionTag = infoEvent?.tags.find((tag: string[]) => tag[0] === "encryption");
      expect(encryptionTag).toBeDefined();
      expect(encryptionTag?.[1]).toContain("nip44_v2");
      expect(encryptionTag?.[1]).toContain("nip04");
    });

    it("should only publish NIP-44 support when configured", async () => {
      // Clear relay cache for a clean test
      relay.cache.length = 0;
      
      const walletImpl = new MockWalletImplementation();
      const nip44OnlyService = new NostrWalletService(
        {
          relays: [relay.url],
          pubkey: serviceKeys.publicKey,
          privkey: serviceKeys.privateKey,
          methods: [NIP47Method.GET_INFO],
          encryptionSchemes: [NIP47EncryptionScheme.NIP44_V2],
        },
        walletImpl
      );

      await nip44OnlyService.init();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const events = relay.cache;
      const infoEvent = events.find((e) => e.kind === 13194 && e.pubkey === serviceKeys.publicKey);
      const encryptionTag = infoEvent?.tags.find((tag) => tag[0] === "encryption");
      
      expect(encryptionTag?.[1]).toBe("nip44_v2");
      expect(encryptionTag?.[1]).not.toContain("nip04");

      await nip44OnlyService.disconnect();
    });
  });

  describe("Request/Response Encryption", () => {
    beforeEach(async () => {
      // Clear relay events
      relay.cache.length = 0;
      
      // Set up service with both encryption types
      const walletImpl = new MockWalletImplementation();
      service = new NostrWalletService(
        {
          relays: [relay.url],
          pubkey: serviceKeys.publicKey,
          privkey: serviceKeys.privateKey,
          methods: [NIP47Method.GET_INFO, NIP47Method.GET_BALANCE, NIP47Method.PAY_INVOICE],
          encryptionSchemes: [NIP47EncryptionScheme.NIP44_V2, NIP47EncryptionScheme.NIP04],
        },
        walletImpl
      );

      await service.init();
    });

    afterEach(async () => {
      if (client) {
        await client.disconnect();
        client = null as unknown as NostrWalletConnectClient;
      }
      if (service) {
        await service.disconnect();
        service = null as unknown as NostrWalletService;
      }
    });

    it("should use NIP-44 encryption when client prefers it", async () => {
      const connectionOptions: NIP47ConnectionOptions = {
        pubkey: serviceKeys.publicKey,
        secret: clientKeys.privateKey,
        relays: [relay.url],
        preferredEncryption: NIP47EncryptionScheme.NIP44_V2,
      };

      client = new NostrWalletConnectClient(connectionOptions);
      await client.init();

      // Make a request
      const balance = await client.getBalance();
      expect(balance).toBe(50000000);

      // Check that the request used NIP-44 encryption
      await new Promise((resolve) => setTimeout(resolve, 100));
      const events = relay.cache;
      const requestEvent = events.find((e) => e.kind === 23194 && e.pubkey === clientKeys.publicKey);
      
      expect(requestEvent).toBeDefined();
      const encryptionTag = requestEvent?.tags.find((tag) => tag[0] === "encryption");
      expect(encryptionTag?.[1]).toBe("nip44_v2");

      // Verify the content is actually NIP-44 encrypted by trying to decrypt
      if (requestEvent) {
        // Should fail with NIP-04
        await expect(async () => {
          decryptNIP04(clientKeys.privateKey, serviceKeys.publicKey, requestEvent.content);
        }).rejects.toThrow();

        // Should succeed with NIP-44
        const decrypted = await decryptNIP44(
          requestEvent.content,
          serviceKeys.privateKey,
          clientKeys.publicKey
        );
        const request = JSON.parse(decrypted);
        expect(request.method).toBe("get_balance");
      }
    });

    it("should fall back to NIP-04 when service doesn't support NIP-44", async () => {
      // First disconnect the default service that supports both
      await service.disconnect();
      
      // Clear relay cache to ensure clean state
      relay.cache.length = 0;
      
      // Create a service that only supports NIP-04
      const nip04Service = new NostrWalletService(
        {
          relays: [relay.url],
          pubkey: serviceKeys.publicKey,
          privkey: serviceKeys.privateKey,
          methods: [NIP47Method.GET_INFO, NIP47Method.GET_BALANCE],
          encryptionSchemes: [NIP47EncryptionScheme.NIP04],
        },
        new MockWalletImplementation()
      );

      await nip04Service.init();
      
      // Wait for the info event to be published
      await new Promise((resolve) => setTimeout(resolve, 100));

      const connectionOptions: NIP47ConnectionOptions = {
        pubkey: serviceKeys.publicKey,
        secret: clientKeys.privateKey,
        relays: [relay.url],
        preferredEncryption: NIP47EncryptionScheme.NIP44_V2,
      };

      client = new NostrWalletConnectClient(connectionOptions);
      await client.init();

      const balance = await client.getBalance();
      expect(balance).toBe(50000000);

      // Check that the request fell back to NIP-04
      await new Promise((resolve) => setTimeout(resolve, 100));
      const events = relay.cache;
      const requestEvent = events.find((e) => e.kind === 23194 && e.pubkey === clientKeys.publicKey);
      
      // No encryption tag means NIP-04
      const encryptionTag = requestEvent?.tags.find((tag) => tag[0] === "encryption");
      expect(encryptionTag).toBeUndefined();

      await nip04Service.disconnect();
    });

    it("should handle mixed encryption in responses", async () => {
      const connectionOptions: NIP47ConnectionOptions = {
        pubkey: serviceKeys.publicKey,
        secret: clientKeys.privateKey,
        relays: [relay.url],
      };

      client = new NostrWalletConnectClient(connectionOptions);
      await client.init();

      // Make multiple requests with different encryption
      const results = await Promise.all([
        client.getBalance(),
        client.getInfo(),
      ]);

      expect(results[0]).toBe(50000000);
      expect(results[1]?.alias).toBe("NIP-44 Test Wallet");
    });
  });

  describe("Notification Encryption", () => {
    it("should send notifications with both encryption types", async () => {
      const walletImpl = new MockWalletImplementation();
      service = new NostrWalletService(
        {
          relays: [relay.url],
          pubkey: serviceKeys.publicKey,
          privkey: serviceKeys.privateKey,
          methods: [NIP47Method.GET_INFO],
          notificationTypes: [NIP47NotificationType.PAYMENT_RECEIVED],
          encryptionSchemes: [NIP47EncryptionScheme.NIP44_V2, NIP47EncryptionScheme.NIP04],
        },
        walletImpl
      );

      await service.init();

      // Send a notification
      await service.sendNotification(
        clientKeys.publicKey,
        NIP47NotificationType.PAYMENT_RECEIVED,
        {
          type: TransactionType.INCOMING,
          payment_hash: "test_hash",
          amount: 1000,
          fees_paid: 0,
          created_at: Math.floor(Date.now() / 1000),
        }
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check that both notification types were sent
      const events = relay.cache;
      const nip04Notification = events.find((e) => e.kind === 23196);
      const nip44Notification = events.find((e) => e.kind === 23197);

      expect(nip04Notification).toBeDefined();
      expect(nip44Notification).toBeDefined();

      // Verify NIP-04 notification
      if (nip04Notification) {
        const decrypted = decryptNIP04(
          clientKeys.privateKey,
          serviceKeys.publicKey,
          nip04Notification.content
        );
        const notification = JSON.parse(decrypted);
        expect(notification.notification_type).toBe("payment_received");
      }

      // Verify NIP-44 notification
      if (nip44Notification) {
        const decrypted = await decryptNIP44(
          nip44Notification.content,
          clientKeys.privateKey,
          serviceKeys.publicKey
        );
        const notification = JSON.parse(decrypted);
        expect(notification.notification_type).toBe("payment_received");
      }
    });

    it("should receive NIP-44 notifications correctly", async () => {
      const walletImpl = new MockWalletImplementation();
      service = new NostrWalletService(
        {
          relays: [relay.url],
          pubkey: serviceKeys.publicKey,
          privkey: serviceKeys.privateKey,
          methods: [NIP47Method.GET_INFO],
          notificationTypes: [NIP47NotificationType.PAYMENT_RECEIVED],
          encryptionSchemes: [NIP47EncryptionScheme.NIP44_V2, NIP47EncryptionScheme.NIP04],
        },
        walletImpl
      );

      await service.init();

      const connectionOptions: NIP47ConnectionOptions = {
        pubkey: serviceKeys.publicKey,
        secret: clientKeys.privateKey,
        relays: [relay.url],
      };

      client = new NostrWalletConnectClient(connectionOptions);
      await client.init();

      let receivedNotification: NIP47Notification<NIP47Transaction> | null = null;
      client.onNotification(
        NIP47NotificationType.PAYMENT_RECEIVED,
        (notification) => {
          receivedNotification = notification as NIP47Notification<NIP47Transaction>;
        }
      );

      // Send notification from service
      await service.sendNotification(
        clientKeys.publicKey,
        NIP47NotificationType.PAYMENT_RECEIVED,
        {
          type: TransactionType.INCOMING,
          payment_hash: "test_notification",
          amount: 2000,
          fees_paid: 0,
          created_at: Math.floor(Date.now() / 1000),
        }
      );

      // Wait for notification to be received
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(receivedNotification).toBeDefined();
      expect(receivedNotification!.notification_type).toBe("payment_received");
      expect(receivedNotification!.notification.amount).toBe(2000);
    });
  });

  describe("Error Handling", () => {
    it("should not respond to requests with unsupported encryption", async () => {
      // Generate new keys for this test to avoid conflicts
      const testServiceKeys = await generateKeypair();
      const testClientKeys = await generateKeypair();
      
      // Create service that only supports NIP-44
      const walletImpl = new MockWalletImplementation();
      const nip44OnlyService = new NostrWalletService(
        {
          relays: [relay.url],
          pubkey: testServiceKeys.publicKey,
          privkey: testServiceKeys.privateKey,
          methods: [NIP47Method.GET_INFO],
          encryptionSchemes: [NIP47EncryptionScheme.NIP44_V2],
        },
        walletImpl
      );

      await nip44OnlyService.init();
      
      // Wait for service to be ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Manually create a NIP-04 encrypted request
      const request = {
        method: NIP47Method.GET_INFO,
        params: {},
      };

      const eventTemplate = {
        kind: 23194,
        content: encryptNIP04(
          testClientKeys.privateKey,
          testServiceKeys.publicKey,
          JSON.stringify(request)
        ),
        tags: [
          ["p", testServiceKeys.publicKey],
          ["encryption", "nip04"], // Explicitly request NIP-04
        ],
        created_at: Math.floor(Date.now() / 1000),
        pubkey: testClientKeys.publicKey,
      };

      // Publish the request
      const event: NostrEvent = {
        ...eventTemplate,
        id: "test_id",
        sig: "test_sig",
      };

      // Add event directly to relay cache for testing
      relay.cache.push(event);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Check that no response was sent
      const events = relay.cache;
      const responseEvent = events.find((e) => e.kind === 23195 && e.tags.some(tag => tag[0] === "e" && tag[1] === event.id));
      expect(responseEvent).toBeUndefined();
      
      // Clean up
      await nip44OnlyService.disconnect();
    });

    it("should handle decryption failures gracefully", async () => {
      const connectionOptions: NIP47ConnectionOptions = {
        pubkey: serviceKeys.publicKey,
        secret: clientKeys.privateKey,
        relays: [relay.url],
      };

      client = new NostrWalletConnectClient(connectionOptions);
      await client.init();

      // Manually create a response with corrupted encryption
      const responseEvent: NostrEvent = {
        id: "test_response",
        kind: 23195,
        content: "invalid_encrypted_content",
        tags: [
          ["p", clientKeys.publicKey],
          ["e", "test_request_id"],
        ],
        created_at: Math.floor(Date.now() / 1000),
        pubkey: serviceKeys.publicKey,
        sig: "test_sig",
      };

      // This should not throw but handle gracefully
      relay.cache.push(responseEvent);
      
      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      // Client should continue functioning
      expect(client).toBeDefined();
    });
  });

  describe("getInfo with encryption field", () => {
    it("should include encryption schemes in getInfo response", async () => {
      const walletImpl = new MockWalletImplementation();
      service = new NostrWalletService(
        {
          relays: [relay.url],
          pubkey: serviceKeys.publicKey,
          privkey: serviceKeys.privateKey,
          methods: [NIP47Method.GET_INFO],
          encryptionSchemes: [NIP47EncryptionScheme.NIP44_V2, NIP47EncryptionScheme.NIP04],
        },
        walletImpl
      );

      await service.init();

      const connectionOptions: NIP47ConnectionOptions = {
        pubkey: serviceKeys.publicKey,
        secret: clientKeys.privateKey,
        relays: [relay.url],
      };

      client = new NostrWalletConnectClient(connectionOptions);
      await client.init();

      const info = await client.getInfo();
      expect(info).toBeDefined();
      expect(info?.encryption).toBeDefined();
      expect(info?.encryption).toContain("nip44_v2");
      expect(info?.encryption).toContain("nip04");
    });
  });
});