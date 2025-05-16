import { describe, it, expect, beforeAll, afterAll, jest } from "@jest/globals";
import { NostrRelay } from "../../src/utils/ephemeral-relay";
import { generateKeypair } from "../../src/utils/crypto";
import {
  NostrWalletConnectClient,
  NostrWalletService,
  WalletImplementation,
  NIP47Transaction,
  NIP47Method,
  NIP47NotificationType,
  TransactionType,
  NIP47ConnectionOptions,
  generateNWCURL,
  parseNWCURL,
  NIP47ErrorCode,
  GetInfoResponseResult,
  PaymentResponseResult,
  MakeInvoiceResponseResult,
  SignMessageResponseResult,
  NIP47Notification,
} from "../../src/nip47";
import { NIP47ClientError } from "../../src/nip47/client";

// Mock Implementation
class MockWalletImplementation implements WalletImplementation {
  private balance: number = 50000000; // 50,000 sats

  async getInfo(): Promise<GetInfoResponseResult> {
    return {
      alias: "Test Wallet",
      color: "#ff0000",
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
      preimage:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      payment_hash:
        "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
      amount: 1000,
      fees_paid: 10,
    };
  }

  async makeInvoice(
    amount: number,
    _description: string,
  ): Promise<MakeInvoiceResponseResult> {
    return {
      invoice: "lnbc10n1ptest",
      payment_hash:
        "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      amount,
      created_at: Math.floor(Date.now() / 1000),
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
  }

  async lookupInvoice(): Promise<NIP47Transaction> {
    return {
      type: TransactionType.INCOMING,
      invoice: "lnbc10n1ptest",
      payment_hash:
        "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      amount: 1000,
      fees_paid: 0,
      created_at: Math.floor(Date.now() / 1000) - 3600,
      settled_at: Math.floor(Date.now() / 1000) - 3000,
    };
  }

  async listTransactions(
    _from?: number,
    _until?: number,
    _limit?: number,
    _offset?: number,
    _unpaid?: boolean,
    _type?: string,
  ): Promise<NIP47Transaction[]> {
    return [
      {
        type: TransactionType.INCOMING,
        invoice: "lnbc10n1ptest1",
        payment_hash:
          "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
        amount: 1000,
        fees_paid: 0,
        created_at: Math.floor(Date.now() / 1000) - 7200,
        settled_at: Math.floor(Date.now() / 1000) - 7100,
      },
      {
        type: TransactionType.OUTGOING,
        invoice: "lnbc20n1ptest2",
        payment_hash:
          "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
        preimage:
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        amount: 2000,
        fees_paid: 20,
        created_at: Math.floor(Date.now() / 1000) - 3600,
        settled_at: Math.floor(Date.now() / 1000) - 3500,
      },
    ];
  }

  async signMessage(message: string): Promise<SignMessageResponseResult> {
    return {
      signature:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      message,
    };
  }
}

// Type for the mock wallet access
type ServiceWithMockAccess = {
  walletImpl: {
    lookupInvoice: (params: {
      payment_hash?: string;
      invoice?: string;
    }) => Promise<NIP47Transaction>;
  };
};

describe("NIP-47: Nostr Wallet Connect", () => {
  let relay: NostrRelay;
  let serviceKeypair: { privateKey: string; publicKey: string };
  let clientKeypair: { privateKey: string; publicKey: string };
  let connectionOptions: NIP47ConnectionOptions;
  let service: NostrWalletService;
  let client: NostrWalletConnectClient;

  beforeAll(async () => {
    // Start ephemeral relay
    relay = new NostrRelay(3047); // Use port 3047 for NIP-47 tests
    await relay.start();

    // Generate keypairs for service and client
    serviceKeypair = await generateKeypair();
    clientKeypair = await generateKeypair();

    // Create connection options
    connectionOptions = {
      pubkey: serviceKeypair.publicKey,
      secret: clientKeypair.privateKey, // Use client private key as secret
      relays: [relay.url],
    };

    // Create and initialize service
    service = new NostrWalletService(
      {
        relays: [relay.url],
        pubkey: serviceKeypair.publicKey,
        privkey: serviceKeypair.privateKey,
        methods: Object.values(NIP47Method),
        notificationTypes: Object.values(NIP47NotificationType),
      },
      new MockWalletImplementation(),
    );

    await service.init();

    // Create and initialize client
    client = new NostrWalletConnectClient(connectionOptions);

    try {
      await client.init();

      // Wait for client to connect and discover capabilities
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error("Failed to initialize client:", error);
      throw error;
    }
  });

  afterAll(async () => {
    // Clean up resources
    try {
      // Add timeout to ensure cleanup completes
      jest.setTimeout(5000);

      // First disconnect the client and service, await if possible
      if (client) {
        await client.disconnect();
      }

      if (service) {
        await service.disconnect();
      }

      // Then close the relay with explicit wait
      if (relay) {
        await relay.close();

        // Allow a small delay for final socket cleanup
        await new Promise((resolve) => setTimeout(resolve, 100).unref());
      }
    } catch (error) {
      console.error("Error during test cleanup:", error);
    }
  });

  describe("URL Handling", () => {
    it("should generate valid NWC URLs", () => {
      const url = generateNWCURL(connectionOptions);
      expect(url.startsWith("nostr+walletconnect://")).toBe(true);
      expect(url).toContain(connectionOptions.pubkey);
      expect(url).toContain("relay=");
      expect(url).toContain("secret=");
    });

    it("should parse NWC URLs correctly", () => {
      const url = generateNWCURL(connectionOptions);
      const parsed = parseNWCURL(url);

      expect(parsed.pubkey).toBe(connectionOptions.pubkey);
      expect(parsed.secret).toBe(connectionOptions.secret);
      expect(parsed.relays).toEqual(
        expect.arrayContaining(connectionOptions.relays),
      );
    });

    it("should reject invalid NWC URLs", () => {
      expect(() => parseNWCURL("invalid")).toThrow();
      expect(() => parseNWCURL("nostr+walletconnect://")).toThrow();
      expect(() => parseNWCURL("nostr+walletconnect://pubkey")).toThrow();
    });
  });

  describe("Basic Client-Service Communication", () => {
    it("should get wallet info", async () => {
      jest.setTimeout(10000);
      const info = await client.getInfo();
      expect(info).toBeDefined();
      if (info) {
        expect(info.methods).toContain(NIP47Method.GET_INFO);
        expect(info.methods).toContain(NIP47Method.GET_BALANCE);
      } else {
        fail("Info result was null");
      }
    });

    it("should get wallet balance", async () => {
      jest.setTimeout(10000);
      const balance = await client.getBalance();
      expect(typeof balance).toBe("number");
      expect(balance).toBeGreaterThan(0);
    });

    it("should create an invoice", async () => {
      jest.setTimeout(10000);
      const invoice = await client.makeInvoice(1000, "Test invoice");
      expect(invoice).toBeDefined();
      if (invoice) {
        expect(invoice.invoice).toBeDefined();
        expect(invoice.payment_hash).toBeDefined();
        expect(invoice.amount).toBe(1000);
      } else {
        fail("Invoice was null");
      }
    });

    it("should look up an invoice", async () => {
      jest.setTimeout(10000);
      const invoice = await client.lookupInvoice({
        payment_hash:
          "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      });
      expect(invoice).toBeDefined();
      if (invoice) {
        expect(invoice.payment_hash).toBeDefined();
        expect(invoice.type).toBe(TransactionType.INCOMING);
      } else {
        fail("Invoice lookup result was null");
      }
    });

    it("should list transactions", async () => {
      jest.setTimeout(10000);
      const result = await client.listTransactions({ limit: 10 });
      expect(result).toBeDefined();
      if (result) {
        // Check that transactions is an array and has at least one item
        expect(Array.isArray(result.transactions)).toBe(true);
        expect(result.transactions.length).toBeGreaterThan(0);
      } else {
        fail("Transaction list result was null");
      }
    });

    it("should pay an invoice", async () => {
      jest.setTimeout(10000);
      const payment = await client.payInvoice("lnbc10n1pdummy");
      expect(payment).toBeDefined();
      if (payment) {
        expect(payment.preimage).toBeDefined();
        expect(payment.payment_hash).toBeDefined();
      } else {
        fail("Payment result was null");
      }
    });

    it("should sign a message", async () => {
      jest.setTimeout(10000);
      const result = await client.signMessage("Test message");
      expect(result).toBeDefined();
      if (result) {
        expect(result.signature).toBeDefined();
        expect(result.message).toBe("Test message");
      } else {
        fail("Sign message result was null");
      }
    });
  });

  describe("Notifications", () => {
    it("should receive notifications from service", async () => {
      jest.setTimeout(10000);
      // Set up notification handler
      const notificationPromise = new Promise<
        NIP47Notification<NIP47Transaction>
      >((resolve) => {
        client.onNotification(
          NIP47NotificationType.PAYMENT_RECEIVED,
          (notification: NIP47Notification<unknown>) => {
            resolve(notification as NIP47Notification<NIP47Transaction>);
          },
        );
      });

      // Send notification from service
      await service.sendNotification(
        client.getPublicKey(),
        NIP47NotificationType.PAYMENT_RECEIVED,
        {
          type: TransactionType.INCOMING,
          invoice: "lnbc100n1test",
          payment_hash:
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          amount: 10000,
          fees_paid: 0,
          created_at: Math.floor(Date.now() / 1000),
          settled_at: Math.floor(Date.now() / 1000),
        } as unknown as Record<string, unknown>,
      );

      // Wait for notification
      const notification = await notificationPromise;
      expect(notification).toBeDefined();
      expect(notification.notification_type).toBe(
        NIP47NotificationType.PAYMENT_RECEIVED,
      );
      expect(notification.notification.payment_hash).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle expired requests", async () => {
      jest.setTimeout(10000);

      // Create a request with an already expired timestamp
      const expiredTime = Math.floor(Date.now() / 1000) - 60; // 60 seconds in the past

      try {
        await client.getBalance({ expiration: expiredTime });
        fail("Should have thrown an error for expired request");
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as NIP47ClientError).code).toBe(
          NIP47ErrorCode.REQUEST_EXPIRED,
        );
      }
    });

    it("should handle invalid method errors", async () => {
      jest.setTimeout(10000);

      try {
        // @ts-expect-error - deliberately call with invalid parameters
        await client.makeInvoice(null);
        fail("Should have thrown an INVALID_REQUEST error");
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as NIP47ClientError).code).toBe(
          NIP47ErrorCode.INVALID_REQUEST,
        );
      }
    });

    it("should handle not found errors", async () => {
      jest.setTimeout(10000);

      // Mock the wallet implementation to throw a NOT_FOUND error
      const serviceMock = service as unknown as ServiceWithMockAccess;
      const originalLookup = serviceMock.walletImpl.lookupInvoice;

      // Create a more specific mocking that replicates a real NOT_FOUND error
      const testPaymentHash = "nonexistent_hash_123";
      serviceMock.walletImpl.lookupInvoice = (params: {
        payment_hash?: string;
        invoice?: string;
      }) => {
        throw {
          code: "NOT_FOUND",
          message: `Invoice not found: Could not find ${params.payment_hash ? "payment_hash" : "invoice"}: ${params.payment_hash || params.invoice} in the wallet's database`,
        };
      };

      try {
        await client.lookupInvoice({ payment_hash: testPaymentHash });
        fail("Should have thrown a NOT_FOUND error");
      } catch (error) {
        expect(error).toBeDefined();
        const nip47Error = error as NIP47ClientError;
        expect(nip47Error.code).toBe(NIP47ErrorCode.NOT_FOUND);

        // Verify the error message contains the specific information about what wasn't found
        expect(nip47Error.message).toContain("Could not find payment_hash");
        expect(nip47Error.message).toContain(testPaymentHash);
        expect(nip47Error.message).toContain("in the wallet's database");

        // Verify error has proper categorization
        expect(nip47Error.category).toBe("RESOURCE");

        // Verify the error has a recovery hint
        expect(nip47Error.recoveryHint).toBeDefined();
        expect(nip47Error.recoveryHint).toContain("For lookupInvoice");
      } finally {
        // Restore original implementation
        serviceMock.walletImpl.lookupInvoice = originalLookup;
      }
    });

    it("should handle not found errors with invoice parameter", async () => {
      jest.setTimeout(10000);

      // Mock the wallet implementation to throw a NOT_FOUND error
      const serviceMock = service as unknown as ServiceWithMockAccess;
      const originalLookup = serviceMock.walletImpl.lookupInvoice;

      // Create a test with invoice parameter instead of payment_hash
      const testInvoice = "lnbc10n1pdummy";
      serviceMock.walletImpl.lookupInvoice = (params: {
        payment_hash?: string;
        invoice?: string;
      }) => {
        throw {
          code: "NOT_FOUND",
          message: `Invoice not found: Could not find ${params.payment_hash ? "payment_hash" : "invoice"}: ${params.payment_hash || params.invoice} in the wallet's database`,
        };
      };

      try {
        await client.lookupInvoice({ invoice: testInvoice });
        fail("Should have thrown a NOT_FOUND error");
      } catch (error) {
        expect(error).toBeDefined();
        const nip47Error = error as NIP47ClientError;
        expect(nip47Error.code).toBe(NIP47ErrorCode.NOT_FOUND);

        // Verify the error message contains the specific information about what wasn't found
        expect(nip47Error.message).toContain("Could not find invoice");
        expect(nip47Error.message).toContain(testInvoice);

        // Verify the client correctly formats the error message with the appropriate context
        expect(nip47Error.message).toMatch(
          /Invoice not found: Could not find invoice: .+ in the wallet's database/,
        );
      } finally {
        // Restore original implementation
        serviceMock.walletImpl.lookupInvoice = originalLookup;
      }
    });
  });

  describe("Response Validation", () => {
    it("should validate response structure according to NIP-47 specification", async () => {
      // Access the private validateResponse method for testing
      const validateResponse = client["validateResponse"].bind(client);

      // Valid successful response
      expect(() =>
        validateResponse({
          result_type: "get_balance",
          result: { balance: 1000 },
          error: null,
        }),
      ).not.toThrow();

      // Valid error response
      expect(() =>
        validateResponse({
          result_type: "pay_invoice",
          result: null,
          error: {
            code: "INSUFFICIENT_BALANCE",
            message: "Not enough funds",
          },
        }),
      ).not.toThrow();

      // Invalid: missing result_type
      expect(() =>
        validateResponse({
          result: { balance: 1000 },
          error: null,
        }),
      ).toThrow();

      // Invalid: missing error field
      expect(() =>
        validateResponse({
          result_type: "get_balance",
          result: { balance: 1000 },
        }),
      ).toThrow();

      // Invalid: error present but result not null
      expect(() =>
        validateResponse({
          result_type: "pay_invoice",
          result: { preimage: "123" },
          error: {
            code: "INSUFFICIENT_BALANCE",
            message: "Not enough funds",
          },
        }),
      ).toThrow();

      // Invalid: no error but result is null
      expect(() =>
        validateResponse({
          result_type: "get_info",
          result: null,
          error: null,
        }),
      ).toThrow();

      // Invalid: error without required code
      expect(() =>
        validateResponse({
          result_type: "get_balance",
          result: null,
          error: {
            message: "Something went wrong",
          },
        }),
      ).toThrow();

      // Invalid: error without required message
      expect(() =>
        validateResponse({
          result_type: "get_balance",
          result: null,
          error: {
            code: "INTERNAL_ERROR",
          },
        }),
      ).toThrow();
    });
  });
});
