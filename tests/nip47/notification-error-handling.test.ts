/**
 * Tests for NIP-47 notification error handling
 *
 * This test specifically verifies that notification sending failures
 * for one encryption scheme don't prevent other schemes from succeeding.
 */

import { generateKeypair } from "../../src/utils/crypto";
import {
  NostrWalletService,
  WalletImplementation,
  NIP47Transaction,
  TransactionType,
} from "../../src/nip47";
import {
  NIP47Method,
  NIP47NotificationType,
  NIP47EncryptionScheme,
} from "../../src/nip47/types";
import { NostrRelay } from "../../src/utils/ephemeral-relay";

describe("NIP-47: Notification error handling", () => {
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

  test("should continue sending notifications even if one encryption scheme fails", async () => {
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
        block_height: 100000,
        block_hash: "00000000000000000000000000000000",
        methods: ["get_info", "pay_invoice"],
        notification_types: ["payment_received"],
      }),
      getBalance: jest.fn().mockResolvedValue(50000000),
      payInvoice: jest.fn().mockResolvedValue({
        preimage: "test_preimage",
        payment_hash: "test_payment_hash",
      }),
      makeInvoice: jest.fn().mockResolvedValue({
        invoice: "lnbc...",
        payment_hash: "test_hash",
      }),
      lookupInvoice: jest.fn().mockResolvedValue({
        type: "incoming" as TransactionType,
        invoice: "lnbc...",
        payment_hash: "test_hash",
        amount: 1000,
        settled_at: Date.now(),
      } as NIP47Transaction),
      listTransactions: jest.fn().mockResolvedValue([]),
      signMessage: jest.fn().mockResolvedValue({
        message: "test",
        signature: "sig",
      }),
    };

    // Create service with both encryption schemes
    const service = new NostrWalletService(
      {
        relays: [relay.url],
        pubkey: serviceKeys.publicKey,
        privkey: serviceKeys.privateKey,
        name: "Test Service",
        methods: [NIP47Method.GET_INFO, NIP47Method.PAY_INVOICE],
        notificationTypes: [NIP47NotificationType.PAYMENT_RECEIVED],
        encryptionSchemes: [
          NIP47EncryptionScheme.NIP04,
          NIP47EncryptionScheme.NIP44_V2,
        ],
      },
      mockWallet,
    );

    // Initialize service first
    await service.init();

    // Mock the client's publishEvent to track calls
    let publishCalls = 0;
    let publishErrors = 0;
    const originalPublish = service["client"].publishEvent.bind(
      service["client"],
    );

    service["client"].publishEvent = jest.fn(async (event) => {
      publishCalls++;

      // Simulate failure for NIP-04 encrypted notifications (kind 23196)
      if (event.kind === 23196) {
        publishErrors++;
        throw new Error("Simulated NIP-04 publish failure");
      }

      // Let NIP-44 notifications succeed
      return originalPublish(event);
    });

    // Capture console.error to verify error logging
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

    // Send notification
    await service.sendNotification(
      clientKeys.publicKey,
      NIP47NotificationType.PAYMENT_RECEIVED,
      {
        payment_hash: "test123",
        amount: 1000,
      },
    );

    // Verify that we attempted to publish both notifications
    expect(publishCalls).toBe(2); // One for each encryption scheme

    // Verify that NIP-04 failed and was logged
    expect(publishErrors).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `Failed to send NIP-04 notification to ${clientKeys.publicKey}:`,
      ),
      expect.stringContaining("Simulated NIP-04 publish failure"),
    );

    // Verify that NIP-44 succeeded and was logged
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `Successfully sent NIP-44 notification to ${clientKeys.publicKey}`,
      ),
    );

    // Clean up
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    await service.disconnect();
  });

  test("should handle all notifications failing gracefully", async () => {
    const serviceKeys = await generateKeypair();
    const clientKeys = await generateKeypair();

    const mockWallet: WalletImplementation = {
      getInfo: jest.fn().mockResolvedValue({
        alias: "Test Wallet",
        color: "#ff0000",
        pubkey:
          "0000000000000000000000000000000000000000000000000000000000000000",
        network: "bitcoin",
        block_height: 100000,
        block_hash: "00000000000000000000000000000000",
        methods: ["get_info"],
        notification_types: ["payment_received"],
      }),
      getBalance: jest.fn().mockResolvedValue(0),
      payInvoice: jest.fn(),
      makeInvoice: jest.fn(),
      lookupInvoice: jest.fn(),
      listTransactions: jest.fn(),
      signMessage: jest.fn(),
    };

    const service = new NostrWalletService(
      {
        relays: [relay.url],
        pubkey: serviceKeys.publicKey,
        privkey: serviceKeys.privateKey,
        name: "Test Service",
        methods: [NIP47Method.GET_INFO],
        notificationTypes: [NIP47NotificationType.PAYMENT_RECEIVED],
        encryptionSchemes: [
          NIP47EncryptionScheme.NIP04,
          NIP47EncryptionScheme.NIP44_V2,
        ],
      },
      mockWallet,
    );

    await service.init();

    // Mock publishEvent to always fail
    service["client"].publishEvent = jest
      .fn()
      .mockRejectedValue(new Error("Network error"));

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    // This should not throw despite all notifications failing
    await expect(
      service.sendNotification(
        clientKeys.publicKey,
        NIP47NotificationType.PAYMENT_RECEIVED,
        { payment_hash: "test", amount: 1000 },
      ),
    ).resolves.toBeUndefined();

    // Verify both failures were logged
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to send NIP-04 notification"),
      expect.any(String),
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to send NIP-44 notification"),
      expect.any(String),
    );

    consoleErrorSpy.mockRestore();
    await service.disconnect();
  });
});
