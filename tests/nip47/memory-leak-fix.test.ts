/**
 * Tests for NIP-47 request encryption map memory leak fix
 *
 * This test verifies that the requestEncryption map is properly cleaned up
 * on all error paths to prevent memory leaks.
 */

import { generateKeypair } from "../../src/utils/crypto";
import { NostrWalletService, WalletImplementation } from "../../src/nip47";
import { NIP47Method, NIP47EncryptionScheme } from "../../src/nip47/types";
import { NostrRelay } from "../../src/utils/ephemeral-relay";
import { createEvent, createSignedEvent } from "../../src/nip01/event";
import { encrypt as encryptNIP04 } from "../../src/nip04";
import { getUnixTime } from "../../src/utils/time";
import { NostrEvent } from "../../src/types/nostr";

// Interface for accessing private members in tests
interface ServiceWithPrivates {
  requestEncryption: Map<string, NIP47EncryptionScheme>;
  handleEvent: (event: NostrEvent) => Promise<void>;
}

describe("NIP-47: Request encryption map cleanup", () => {
  let relay: NostrRelay;
  let service: NostrWalletService;
  let serviceKeys: { publicKey: string; privateKey: string };
  let clientKeys: { publicKey: string; privateKey: string };

  beforeAll(async () => {
    relay = new NostrRelay(0); // Use different port
    await relay.start();

    serviceKeys = await generateKeypair();
    clientKeys = await generateKeypair();
  });

  afterAll(async () => {
    if (relay) {
      await relay.close();
    }
  });

  beforeEach(async () => {
    // Create minimal wallet implementation
    const mockWallet: WalletImplementation = {
      getInfo: jest.fn().mockResolvedValue({
        alias: "Test Wallet",
        color: "#ff0000",
        pubkey:
          "0000000000000000000000000000000000000000000000000000000000000000",
        network: "bitcoin",
        methods: ["get_info"],
      }),
      getBalance: jest.fn().mockResolvedValue(0),
      payInvoice: jest.fn(),
      makeInvoice: jest.fn(),
      lookupInvoice: jest.fn(),
      listTransactions: jest.fn(),
      signMessage: jest.fn(),
    };

    service = new NostrWalletService(
      {
        relays: [relay.url],
        pubkey: serviceKeys.publicKey,
        privkey: serviceKeys.privateKey,
        methods: [NIP47Method.GET_INFO],
        authorizedClients: [clientKeys.publicKey], // Only authorize our test client
      },
      mockWallet,
    );

    await service.init();
  });

  afterEach(async () => {
    if (service) {
      await service.disconnect();
    }
  });

  test("should clean up requestEncryption map on expired request", async () => {
    // Create an expired request
    const request = {
      method: NIP47Method.GET_INFO,
      params: {},
    };

    const eventTemplate = {
      kind: 23194, // NIP47EventKind.REQUEST
      content: encryptNIP04(
        clientKeys.privateKey,
        serviceKeys.publicKey,
        JSON.stringify(request),
      ),
      tags: [
        ["p", serviceKeys.publicKey],
        ["expiration", (getUnixTime() - 10).toString()], // Expired 10 seconds ago
      ],
    };

    const event = await createSignedEvent(
      createEvent(eventTemplate, clientKeys.publicKey),
      clientKeys.privateKey,
    );

    // Access private map for testing
    const serviceWithPrivates = service as unknown as ServiceWithPrivates;
    const requestEncryptionMap = serviceWithPrivates.requestEncryption;
    const initialSize = requestEncryptionMap.size;

    // Handle the event
    await serviceWithPrivates.handleEvent(event);

    // Wait a bit for async operations
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify the map was not increased (no leak)
    expect(requestEncryptionMap.size).toBe(initialSize);
    expect(requestEncryptionMap.has(event.id)).toBe(false);
  });

  test("should clean up requestEncryption map on unauthorized client", async () => {
    // Create a new unauthorized client
    const unauthorizedKeys = await generateKeypair();

    const request = {
      method: NIP47Method.GET_INFO,
      params: {},
    };

    const eventTemplate = {
      kind: 23194, // NIP47EventKind.REQUEST
      content: encryptNIP04(
        unauthorizedKeys.privateKey,
        serviceKeys.publicKey,
        JSON.stringify(request),
      ),
      tags: [["p", serviceKeys.publicKey]],
    };

    const event = await createSignedEvent(
      createEvent(eventTemplate, unauthorizedKeys.publicKey),
      unauthorizedKeys.privateKey,
    );

    const serviceWithPrivates = service as unknown as ServiceWithPrivates;
    const requestEncryptionMap = serviceWithPrivates.requestEncryption;
    const initialSize = requestEncryptionMap.size;

    // Handle the event
    await serviceWithPrivates.handleEvent(event);

    // Wait a bit for async operations
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify the map was not increased (no leak)
    expect(requestEncryptionMap.size).toBe(initialSize);
    expect(requestEncryptionMap.has(event.id)).toBe(false);
  });

  test("should clean up requestEncryption map on decryption failure", async () => {
    const eventTemplate = {
      kind: 23194, // NIP47EventKind.REQUEST
      content: "invalid_encrypted_content", // This will fail decryption
      tags: [["p", serviceKeys.publicKey]],
    };

    const event = await createSignedEvent(
      createEvent(eventTemplate, clientKeys.publicKey),
      clientKeys.privateKey,
    );

    const serviceWithPrivates = service as unknown as ServiceWithPrivates;
    const requestEncryptionMap = serviceWithPrivates.requestEncryption;
    const initialSize = requestEncryptionMap.size;

    // Spy on console.error to verify the error is logged
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    // Handle the event
    await serviceWithPrivates.handleEvent(event);

    // Wait a bit for async operations
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify the error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `Failed to decrypt message for event ${event.id}:`,
      ),
      expect.any(Error),
    );

    // Verify the map was cleaned up
    expect(requestEncryptionMap.size).toBe(initialSize);
    expect(requestEncryptionMap.has(event.id)).toBe(false);

    consoleErrorSpy.mockRestore();
  });

  test("should clean up requestEncryption map on successful request", async () => {
    const request = {
      method: NIP47Method.GET_INFO,
      params: {},
    };

    const eventTemplate = {
      kind: 23194, // NIP47EventKind.REQUEST
      content: encryptNIP04(
        clientKeys.privateKey,
        serviceKeys.publicKey,
        JSON.stringify(request),
      ),
      tags: [["p", serviceKeys.publicKey]],
    };

    const event = await createSignedEvent(
      createEvent(eventTemplate, clientKeys.publicKey),
      clientKeys.privateKey,
    );

    const serviceWithPrivates = service as unknown as ServiceWithPrivates;
    const requestEncryptionMap = serviceWithPrivates.requestEncryption;
    const initialSize = requestEncryptionMap.size;

    // Handle the event
    await serviceWithPrivates.handleEvent(event);

    // Wait a bit for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Verify the map was cleaned up after successful processing
    expect(requestEncryptionMap.size).toBe(initialSize);
    expect(requestEncryptionMap.has(event.id)).toBe(false);
  });

  test("should clean up requestEncryption map on JSON parse error", async () => {
    const eventTemplate = {
      kind: 23194, // NIP47EventKind.REQUEST
      content: encryptNIP04(
        clientKeys.privateKey,
        serviceKeys.publicKey,
        "invalid json {{{", // This will decrypt but fail JSON parsing
      ),
      tags: [["p", serviceKeys.publicKey]],
    };

    const event = await createSignedEvent(
      createEvent(eventTemplate, clientKeys.publicKey),
      clientKeys.privateKey,
    );

    const serviceWithPrivates = service as unknown as ServiceWithPrivates;
    const requestEncryptionMap = serviceWithPrivates.requestEncryption;
    const initialSize = requestEncryptionMap.size;

    // Spy on console.error to verify the error is logged
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    // Handle the event
    await serviceWithPrivates.handleEvent(event);

    // Wait a bit for async operations
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify the error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(`Error processing request ${event.id}:`),
      expect.any(Error),
    );

    // Verify the map was cleaned up
    expect(requestEncryptionMap.size).toBe(initialSize);
    expect(requestEncryptionMap.has(event.id)).toBe(false);

    consoleErrorSpy.mockRestore();
  });
});
