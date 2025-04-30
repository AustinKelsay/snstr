import {
  createZapRequest,
  createZapReceipt,
  validateZapReceipt,
  ZAP_REQUEST_KIND,
  ZAP_RECEIPT_KIND,
  parseZapSplit,
  calculateZapSplitAmounts,
  NostrEvent,
  LnurlPayResponse,
} from "../../src";
import { generateKeypair } from "../../src";
import { createSignedEvent, UnsignedEvent } from "../../src/utils/event";

// Mock only the specific functions we need for testing
jest.mock("../../src/utils/crypto", () => {
  const originalModule = jest.requireActual("../../src/utils/crypto");

  return {
    ...originalModule,
    sha256: jest.fn().mockImplementation(originalModule.sha256),
    verifySignature: jest
      .fn()
      .mockImplementation(originalModule.verifySignature),
  };
});

jest.mock("../../src/nip57/utils", () => {
  const originalModule = jest.requireActual("../../src/nip57/utils");

  return {
    ...originalModule,
    parseBolt11Invoice: jest
      .fn()
      .mockImplementation(originalModule.parseBolt11Invoice),
    fetchLnurlPayMetadata: jest
      .fn()
      .mockImplementation(originalModule.fetchLnurlPayMetadata),
  };
});

// Import mocked functions after mocking
import { sha256, verifySignature } from "../../src/utils/crypto";
import {
  parseBolt11Invoice,
  fetchLnurlPayMetadata,
} from "../../src/nip57/utils";

// Store originals for restoration
const originalSha256 = jest.requireActual("../../src/utils/crypto").sha256;
const originalVerifySignature = jest.requireActual(
  "../../src/utils/crypto",
).verifySignature;
const originalParseBolt11Invoice = jest.requireActual(
  "../../src/nip57/utils",
).parseBolt11Invoice;
const originalFetchLnurlPayMetadata = jest.requireActual(
  "../../src/nip57/utils",
).fetchLnurlPayMetadata;

describe("NIP-57: Lightning Zaps", () => {
  let senderKeypair: { privateKey: string; publicKey: string };
  let recipientKeypair: { privateKey: string; publicKey: string };
  let lnurlServerKeypair: { privateKey: string; publicKey: string };

  beforeAll(async () => {
    // Generate keypairs for testing
    senderKeypair = await generateKeypair();
    recipientKeypair = await generateKeypair();
    lnurlServerKeypair = await generateKeypair();
  });

  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset to original implementations by default
    (sha256 as jest.Mock).mockImplementation(originalSha256);
    (verifySignature as jest.Mock).mockImplementation(originalVerifySignature);
    (parseBolt11Invoice as jest.Mock).mockImplementation(
      originalParseBolt11Invoice,
    );
    (fetchLnurlPayMetadata as jest.Mock).mockImplementation(
      originalFetchLnurlPayMetadata,
    );
  });

  // Restore original implementations after all tests
  afterAll(() => {
    (sha256 as jest.Mock).mockImplementation(originalSha256);
    (verifySignature as jest.Mock).mockImplementation(originalVerifySignature);
    (parseBolt11Invoice as jest.Mock).mockImplementation(
      originalParseBolt11Invoice,
    );
    (fetchLnurlPayMetadata as jest.Mock).mockImplementation(
      originalFetchLnurlPayMetadata,
    );
  });

  describe("Zap Request Creation", () => {
    it("should create a valid zap request event", async () => {
      const zapRequestTemplate = createZapRequest(
        {
          recipientPubkey: recipientKeypair.publicKey,
          amount: 1000000, // 1000 sats
          relays: ["wss://relay.example.com"],
          content: "Great post!",
          eventId: "abc123",
        },
        senderKeypair.publicKey,
      );

      // Sign the event to convert template to full NostrEvent
      const zapRequest = await createSignedEvent(
        {
          ...zapRequestTemplate,
          pubkey: senderKeypair.publicKey,
          created_at: Math.floor(Date.now() / 1000),
        } as UnsignedEvent,
        senderKeypair.privateKey,
      );

      expect(zapRequest.kind).toBe(ZAP_REQUEST_KIND);
      expect(zapRequest.pubkey).toBe(senderKeypair.publicKey);

      // Check tags
      const pTag = zapRequest.tags.find((tag: string[]) => tag[0] === "p");
      const eTag = zapRequest.tags.find((tag: string[]) => tag[0] === "e");
      const amountTag = zapRequest.tags.find(
        (tag: string[]) => tag[0] === "amount",
      );
      const relaysTag = zapRequest.tags.find(
        (tag: string[]) => tag[0] === "relays",
      );

      expect(pTag?.[1]).toBe(recipientKeypair.publicKey);
      expect(eTag?.[1]).toBe("abc123");
      expect(amountTag?.[1]).toBe("1000000");
      expect(relaysTag?.[0]).toBe("relays");
      expect(relaysTag?.[1]).toBe("wss://relay.example.com");
      expect(zapRequest.content).toBe("Great post!");
    });

    it("should correctly format multiple relays in a single tag", async () => {
      const relaysList = [
        "wss://relay1.example.com",
        "wss://relay2.example.com",
        "wss://relay3.example.com",
      ];

      const zapRequestTemplate = createZapRequest(
        {
          recipientPubkey: recipientKeypair.publicKey,
          amount: 1000000,
          relays: relaysList,
          content: "Great post!",
        },
        senderKeypair.publicKey,
      );

      const zapRequest = await createSignedEvent(
        {
          ...zapRequestTemplate,
          pubkey: senderKeypair.publicKey,
          created_at: Math.floor(Date.now() / 1000),
        } as UnsignedEvent,
        senderKeypair.privateKey,
      );

      // Check the relays tag format
      const relaysTag = zapRequest.tags.find(
        (tag: string[]) => tag[0] === "relays",
      );
      expect(relaysTag).toBeDefined();
      expect(relaysTag?.[0]).toBe("relays");

      // Verify all relays are in the same tag
      expect(relaysTag?.[1]).toBe(relaysList[0]);
      expect(relaysTag?.[2]).toBe(relaysList[1]);
      expect(relaysTag?.[3]).toBe(relaysList[2]);

      // Ensure there's only one relays tag
      const allRelaysTags = zapRequest.tags.filter(
        (tag: string[]) => tag[0] === "relays",
      );
      expect(allRelaysTags.length).toBe(1);
    });

    it("should support anonymous zaps", async () => {
      // For anonymous zaps we should still use a valid private key
      // but mark it anonymous in the request
      const anonymousKey =
        "0000000000000000000000000000000000000000000000000000000000000001";

      const zapRequestTemplate = createZapRequest(
        {
          recipientPubkey: recipientKeypair.publicKey,
          amount: 1000000,
          relays: ["wss://relay.example.com"],
          senderPubkey: senderKeypair.publicKey,
        },
        anonymousKey,
      );

      const zapRequest = await createSignedEvent(
        {
          ...zapRequestTemplate,
          pubkey: anonymousKey,
          created_at: Math.floor(Date.now() / 1000),
        } as UnsignedEvent,
        anonymousKey,
      );

      // Check for P tag
      const pSenderTag = zapRequest.tags.find(
        (tag: string[]) => tag[0] === "P",
      );
      expect(pSenderTag?.[1]).toBe(senderKeypair.publicKey);
    });
  });

  describe("Zap Receipt Creation", () => {
    it("should create a valid zap receipt event", async () => {
      // First create a zap request
      const zapRequestTemplate = createZapRequest(
        {
          recipientPubkey: recipientKeypair.publicKey,
          amount: 1000000,
          relays: ["wss://relay.example.com"],
          eventId: "abc123",
          content: "Great post!",
        },
        senderKeypair.publicKey,
      );

      const zapRequest = await createSignedEvent(
        {
          ...zapRequestTemplate,
          pubkey: senderKeypair.publicKey,
          created_at: Math.floor(Date.now() / 1000),
        } as UnsignedEvent,
        senderKeypair.privateKey,
      );

      // Then create the receipt
      const zapReceiptTemplate = createZapReceipt(
        {
          recipientPubkey: recipientKeypair.publicKey,
          eventId: "abc123",
          bolt11: "lnbc1000n1...",
          preimage: "123abc...",
          zapRequest,
        },
        lnurlServerKeypair.publicKey,
      );

      const zapReceipt = await createSignedEvent(
        {
          ...zapReceiptTemplate,
          pubkey: lnurlServerKeypair.publicKey,
          created_at: Math.floor(Date.now() / 1000),
        } as UnsignedEvent,
        lnurlServerKeypair.privateKey,
      );

      expect(zapReceipt.kind).toBe(ZAP_RECEIPT_KIND);
      expect(zapReceipt.pubkey).toBe(lnurlServerKeypair.publicKey);

      // Check tags
      const pTag = zapReceipt.tags.find((tag: string[]) => tag[0] === "p");
      const eTag = zapReceipt.tags.find((tag: string[]) => tag[0] === "e");
      const bolt11Tag = zapReceipt.tags.find(
        (tag: string[]) => tag[0] === "bolt11",
      );
      const descriptionTag = zapReceipt.tags.find(
        (tag: string[]) => tag[0] === "description",
      );
      const preimageTag = zapReceipt.tags.find(
        (tag: string[]) => tag[0] === "preimage",
      );

      expect(pTag?.[1]).toBe(recipientKeypair.publicKey);
      expect(eTag?.[1]).toBe("abc123");
      expect(bolt11Tag?.[1]).toBe("lnbc1000n1...");
      expect(typeof descriptionTag?.[1]).toBe("string");
      expect(preimageTag?.[1]).toBe("123abc...");

      // The content should be empty
      expect(zapReceipt.content).toBe("");
    });
  });

  describe("Zap Receipt Validation", () => {
    it("should validate a proper zap receipt", async () => {
      // Create a signed zap request
      const zapRequestTemplate = createZapRequest(
        {
          recipientPubkey: recipientKeypair.publicKey,
          amount: 1000000,
          relays: ["wss://relay.example.com"],
          eventId: "abc123",
        },
        senderKeypair.publicKey,
      );

      const signedZapRequest = await createSignedEvent(
        {
          ...zapRequestTemplate,
          pubkey: senderKeypair.publicKey,
          created_at: Math.floor(Date.now() / 1000),
        } as UnsignedEvent,
        senderKeypair.privateKey,
      );

      // Create a zap receipt
      const zapReceiptTemplate = createZapReceipt(
        {
          recipientPubkey: recipientKeypair.publicKey,
          eventId: "abc123",
          bolt11: "lnbc1000n1...",
          zapRequest: signedZapRequest,
        },
        lnurlServerKeypair.publicKey,
      );

      const signedZapReceipt = await createSignedEvent(
        {
          ...zapReceiptTemplate,
          pubkey: lnurlServerKeypair.publicKey,
          created_at: Math.floor(Date.now() / 1000),
        } as UnsignedEvent,
        lnurlServerKeypair.privateKey,
      );

      // Mock the parser to return valid data
      const mockHashBytes = new Uint8Array([1, 2, 3, 4]);
      const mockHashHex = Array.from(mockHashBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // Setup mocks for this test only
      (sha256 as jest.Mock).mockReturnValueOnce(mockHashBytes);
      (verifySignature as jest.Mock).mockReturnValueOnce(true);
      (parseBolt11Invoice as jest.Mock).mockReturnValueOnce({
        descriptionHash: mockHashHex,
        paymentHash: "123abc",
        amount: "1000000",
      });

      // Validate it
      const validation = validateZapReceipt(
        signedZapReceipt,
        lnurlServerKeypair.publicKey,
      );

      expect(validation.valid).toBe(true);
      expect(validation.recipient).toBe(recipientKeypair.publicKey);
      expect(validation.sender).toBe(senderKeypair.publicKey);
      expect(validation.eventId).toBe("abc123");
      expect(validation.amount).toBe(1000000);
    });

    it("should reject a zap receipt with mismatched pubkey", async () => {
      // Create a signed zap request
      const zapRequestTemplate = createZapRequest(
        {
          recipientPubkey: recipientKeypair.publicKey,
          amount: 1000000,
          relays: ["wss://relay.example.com"],
        },
        senderKeypair.publicKey,
      );

      const signedZapRequest = await createSignedEvent(
        {
          ...zapRequestTemplate,
          pubkey: senderKeypair.publicKey,
          created_at: Math.floor(Date.now() / 1000),
        } as UnsignedEvent,
        senderKeypair.privateKey,
      );

      // Create a zap receipt
      const zapReceiptTemplate = createZapReceipt(
        {
          recipientPubkey: recipientKeypair.publicKey,
          bolt11: "lnbc1000n1...",
          zapRequest: signedZapRequest,
        },
        lnurlServerKeypair.publicKey,
      );

      const signedZapReceipt = await createSignedEvent(
        {
          ...zapReceiptTemplate,
          pubkey: lnurlServerKeypair.publicKey,
          created_at: Math.floor(Date.now() / 1000),
        } as UnsignedEvent,
        lnurlServerKeypair.privateKey,
      );

      // Validate with wrong pubkey
      const validation = validateZapReceipt(
        signedZapReceipt,
        senderKeypair.publicKey,
      );

      expect(validation.valid).toBe(false);
      expect(validation.message).toContain("not from expected LNURL provider");
    });

    describe("Description Hash Validation", () => {
      it("should validate when description hash matches", async () => {
        // Create a signed zap request
        const zapRequestTemplate = createZapRequest(
          {
            recipientPubkey: recipientKeypair.publicKey,
            amount: 1000000,
            relays: ["wss://relay.example.com"],
            eventId: "abc123",
          },
          senderKeypair.publicKey,
        );

        const signedZapRequest = await createSignedEvent(
          {
            ...zapRequestTemplate,
            pubkey: senderKeypair.publicKey,
            created_at: Math.floor(Date.now() / 1000),
          } as UnsignedEvent,
          senderKeypair.privateKey,
        );

        // Create a zap receipt
        const zapReceiptTemplate = createZapReceipt(
          {
            recipientPubkey: recipientKeypair.publicKey,
            eventId: "abc123",
            bolt11: "lnbc1000n1...",
            zapRequest: signedZapRequest,
          },
          lnurlServerKeypair.publicKey,
        );

        const signedZapReceipt = await createSignedEvent(
          {
            ...zapReceiptTemplate,
            pubkey: lnurlServerKeypair.publicKey,
            created_at: Math.floor(Date.now() / 1000),
          } as UnsignedEvent,
          lnurlServerKeypair.privateKey,
        );

        // Mock hash calculation to match the hash in invoice - scoped to this test only
        const mockHashBytes = new Uint8Array([1, 2, 3, 4]);
        const mockHashHex = Array.from(mockHashBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        (sha256 as jest.Mock).mockReturnValueOnce(mockHashBytes);
        (verifySignature as jest.Mock).mockReturnValueOnce(true);

        // Mock invoice parsing to return matching hash - scoped to this test only
        (parseBolt11Invoice as jest.Mock).mockReturnValueOnce({
          descriptionHash: mockHashHex,
          paymentHash: "payment_hash",
          amount: "1000000",
        });

        // Validate
        const validation = validateZapReceipt(
          signedZapReceipt,
          lnurlServerKeypair.publicKey,
        );

        // Check that sha256 was called with the description tag content
        expect(sha256).toHaveBeenCalled();
        expect(parseBolt11Invoice).toHaveBeenCalledWith("lnbc1000n1...");

        expect(validation.valid).toBe(true);
        expect(validation.recipient).toBe(recipientKeypair.publicKey);
        expect(validation.sender).toBe(senderKeypair.publicKey);
      });

      it("should reject if description hash does not match", async () => {
        // Create a signed zap request
        const zapRequestTemplate = createZapRequest(
          {
            recipientPubkey: recipientKeypair.publicKey,
            amount: 1000000,
            relays: ["wss://relay.example.com"],
          },
          senderKeypair.publicKey,
        );

        const signedZapRequest = await createSignedEvent(
          {
            ...zapRequestTemplate,
            pubkey: senderKeypair.publicKey,
            created_at: Math.floor(Date.now() / 1000),
          } as UnsignedEvent,
          senderKeypair.privateKey,
        );

        // Create a zap receipt
        const zapReceiptTemplate = createZapReceipt(
          {
            recipientPubkey: recipientKeypair.publicKey,
            bolt11: "lnbc1000n1...",
            zapRequest: signedZapRequest,
          },
          lnurlServerKeypair.publicKey,
        );

        const signedZapReceipt = await createSignedEvent(
          {
            ...zapReceiptTemplate,
            pubkey: lnurlServerKeypair.publicKey,
            created_at: Math.floor(Date.now() / 1000),
          } as UnsignedEvent,
          lnurlServerKeypair.privateKey,
        );

        // Mock hash calculation - this will be different from invoice hash
        const mockHashBytes = new Uint8Array([1, 2, 3, 4]);
        const calculatedHashHex = Array.from(mockHashBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        (sha256 as jest.Mock).mockReturnValue(mockHashBytes);

        // Mock invoice parsing with different hash
        (parseBolt11Invoice as jest.Mock).mockReturnValue({
          descriptionHash: "different_hash_value",
          paymentHash: "payment_hash",
          amount: "1000000",
        });

        // Validate
        const validation = validateZapReceipt(
          signedZapReceipt,
          lnurlServerKeypair.publicKey,
        );

        expect(validation.valid).toBe(false);
        expect(validation.message).toContain("Description hash mismatch");
        expect(validation.message).toContain("different_hash_value");
        expect(validation.message).toContain(calculatedHashHex);
      });

      it("should reject if invoice parsing fails", async () => {
        // Create a signed zap request and receipt
        const zapRequestTemplate = createZapRequest(
          {
            recipientPubkey: recipientKeypair.publicKey,
            amount: 1000000,
            relays: ["wss://relay.example.com"],
          },
          senderKeypair.publicKey,
        );

        const signedZapRequest = await createSignedEvent(
          {
            ...zapRequestTemplate,
            pubkey: senderKeypair.publicKey,
            created_at: Math.floor(Date.now() / 1000),
          } as UnsignedEvent,
          senderKeypair.privateKey,
        );

        const zapReceiptTemplate = createZapReceipt(
          {
            recipientPubkey: recipientKeypair.publicKey,
            bolt11: "invalid_invoice",
            zapRequest: signedZapRequest,
          },
          lnurlServerKeypair.publicKey,
        );

        const signedZapReceipt = await createSignedEvent(
          {
            ...zapReceiptTemplate,
            pubkey: lnurlServerKeypair.publicKey,
            created_at: Math.floor(Date.now() / 1000),
          } as UnsignedEvent,
          lnurlServerKeypair.privateKey,
        );

        // Mock invoice parsing to fail
        (parseBolt11Invoice as jest.Mock).mockReturnValue(null);

        // Validate
        const validation = validateZapReceipt(
          signedZapReceipt,
          lnurlServerKeypair.publicKey,
        );

        expect(validation.valid).toBe(false);
        expect(validation.message).toBe("Failed to parse bolt11 invoice");
      });

      it("should reject if invoice is missing description hash", async () => {
        // Create a signed zap request and receipt
        const zapRequestTemplate = createZapRequest(
          {
            recipientPubkey: recipientKeypair.publicKey,
            amount: 1000000,
            relays: ["wss://relay.example.com"],
          },
          senderKeypair.publicKey,
        );

        const signedZapRequest = await createSignedEvent(
          {
            ...zapRequestTemplate,
            pubkey: senderKeypair.publicKey,
            created_at: Math.floor(Date.now() / 1000),
          } as UnsignedEvent,
          senderKeypair.privateKey,
        );

        const zapReceiptTemplate = createZapReceipt(
          {
            recipientPubkey: recipientKeypair.publicKey,
            bolt11: "lnbc1000n1...",
            zapRequest: signedZapRequest,
          },
          lnurlServerKeypair.publicKey,
        );

        const signedZapReceipt = await createSignedEvent(
          {
            ...zapReceiptTemplate,
            pubkey: lnurlServerKeypair.publicKey,
            created_at: Math.floor(Date.now() / 1000),
          } as UnsignedEvent,
          lnurlServerKeypair.privateKey,
        );

        // Mock invoice parsing to return no description hash
        (parseBolt11Invoice as jest.Mock).mockReturnValue({
          paymentHash: "payment_hash",
          amount: "1000000",
          // No descriptionHash field
        });

        // Validate
        const validation = validateZapReceipt(
          signedZapReceipt,
          lnurlServerKeypair.publicKey,
        );

        expect(validation.valid).toBe(false);
        expect(validation.message).toBe("Invoice is missing description hash");
      });

      it("should work with a real bolt11 invoice", async () => {
        // Test with a real invoice
        const realInvoice =
          "lnbc10n1pnl9j2dpp5l26x7ehekgvlyys6v0ejx632efxu4takgrjf6djxx27p2mj2s0rshp5hrpx277yr8wz65tkjgk5pasf4206f3uqxwgjvpvumy5tn02u33tscqzzsxqyz5vqsp5xzj5n464jd8zzjfgxk7l6awyh9ljr2dxj840e5afyytsm74w7cvs9qxpqysgqu60yrltgcntw5phmdkdjqagfklrumflhf9facvhjhfljcethwejynzf0z2u6mrmfhxj8pg7a8r6ar9jf2wprmlv6gvyxhgetgnkjxwsqt233t8";

        // First, parse the real invoice to see its structure
        const invoiceData = parseBolt11Invoice(realInvoice);

        // Ensure we have some data from parsing
        expect(invoiceData).not.toBeNull();

        // Create a mock invoice data with a description hash for testing
        const mockInvoiceData = {
          ...invoiceData,
          // Add a mock description hash that we'll use for validation
          descriptionHash:
            "5d006d2cf1e73c7148e7519a4c68adc81642ce0e25a432b2434c99f97344c15f",
        };

        // Create a zap request that matches the description hash
        const zapRequestTemplate = createZapRequest(
          {
            recipientPubkey: recipientKeypair.publicKey,
            amount: 1000, // 1 sat in millisats
            relays: ["wss://relay.example.com"],
          },
          senderKeypair.publicKey,
        );

        const signedZapRequest = await createSignedEvent(
          {
            ...zapRequestTemplate,
            pubkey: senderKeypair.publicKey,
            created_at: Math.floor(Date.now() / 1000),
          } as UnsignedEvent,
          senderKeypair.privateKey,
        );

        // Mock the invoice parsing to return our custom data with description hash
        (parseBolt11Invoice as jest.Mock).mockReturnValue(mockInvoiceData);

        // And mock the sha256 function to return the expected hash value
        // The descriptionHash from the invoice is already a hex string,
        // so we need to convert it to a Uint8Array for our mock
        const descHashBytes = new Uint8Array(
          mockInvoiceData.descriptionHash
            .match(/.{1,2}/g)!
            .map((byte) => parseInt(byte, 16)),
        );
        (sha256 as jest.Mock).mockReturnValue(descHashBytes);

        // Create zap receipt with our real invoice
        const zapReceiptTemplate = createZapReceipt(
          {
            recipientPubkey: recipientKeypair.publicKey,
            bolt11: realInvoice,
            zapRequest: signedZapRequest,
          },
          lnurlServerKeypair.publicKey,
        );

        const signedZapReceipt = await createSignedEvent(
          {
            ...zapReceiptTemplate,
            pubkey: lnurlServerKeypair.publicKey,
            created_at: Math.floor(Date.now() / 1000),
          } as UnsignedEvent,
          lnurlServerKeypair.privateKey,
        );

        // Validate
        const validation = validateZapReceipt(
          signedZapReceipt,
          lnurlServerKeypair.publicKey,
        );

        // Should be valid since we mocked sha256 to return the expected hash
        expect(validation.valid).toBe(true);

        // Now test with incorrect hash
        const wrongHashBytes = new Uint8Array([0, 1, 2, 3]); // different hash
        (sha256 as jest.Mock).mockReturnValue(wrongHashBytes);

        const validationWithWrongHash = validateZapReceipt(
          signedZapReceipt,
          lnurlServerKeypair.publicKey,
        );
        expect(validationWithWrongHash.valid).toBe(false);
        expect(validationWithWrongHash.message).toContain(
          "Description hash mismatch",
        );
      });
    });
  });

  describe("Zap Split", () => {
    it("should parse zap split tags correctly", () => {
      const event: NostrEvent = {
        id: "abc123",
        pubkey: "pubkey",
        created_at: 1234567890,
        kind: 1,
        tags: [
          ["zap", "pubkey1", "wss://relay1.com", "1"],
          ["zap", "pubkey2", "wss://relay2.com", "2"],
          ["zap", "pubkey3", "wss://relay3.com", "3"],
        ],
        content: "Test",
        sig: "sig",
      };

      const zapSplit = parseZapSplit(event);

      expect(zapSplit.length).toBe(3);
      expect(zapSplit[0].pubkey).toBe("pubkey1");
      expect(zapSplit[0].relay).toBe("wss://relay1.com");
      expect(zapSplit[0].weight).toBe(1);
      expect(zapSplit[1].pubkey).toBe("pubkey2");
      expect(zapSplit[1].weight).toBe(2);
      expect(zapSplit[2].pubkey).toBe("pubkey3");
      expect(zapSplit[2].weight).toBe(3);
    });

    it("should calculate split amounts correctly", () => {
      const splitInfo = [
        { pubkey: "pubkey1", relay: "wss://relay1.com", weight: 1 },
        { pubkey: "pubkey2", relay: "wss://relay2.com", weight: 2 },
        { pubkey: "pubkey3", relay: "wss://relay3.com", weight: 3 },
      ];

      const splitAmounts = calculateZapSplitAmounts(6000000, splitInfo);

      expect(splitAmounts.length).toBe(3);
      expect(splitAmounts[0].pubkey).toBe("pubkey1");
      expect(splitAmounts[0].amount).toBe(1000000); // 1/6 of 6000000
      expect(splitAmounts[1].pubkey).toBe("pubkey2");
      expect(splitAmounts[1].amount).toBe(2000000); // 2/6 of 6000000
      expect(splitAmounts[2].pubkey).toBe("pubkey3");
      expect(splitAmounts[2].amount).toBe(3000000); // 3/6 of 6000000
    });

    it("should handle equal splits when no weights are provided", () => {
      const splitInfo = [
        { pubkey: "pubkey1", relay: "wss://relay1.com", weight: 0 },
        { pubkey: "pubkey2", relay: "wss://relay2.com", weight: 0 },
        { pubkey: "pubkey3", relay: "wss://relay3.com", weight: 0 },
      ];

      const equalSplitInfo = parseZapSplit({
        id: "abc123",
        pubkey: "pubkey",
        created_at: 1234567890,
        kind: 1,
        tags: [
          ["zap", "pubkey1", "wss://relay1.com"],
          ["zap", "pubkey2", "wss://relay2.com"],
          ["zap", "pubkey3", "wss://relay3.com"],
        ],
        content: "Test",
        sig: "sig",
      });

      // Check if parseZapSplit assigns equal weights
      expect(equalSplitInfo[0].weight).toBe(1);
      expect(equalSplitInfo[1].weight).toBe(1);
      expect(equalSplitInfo[2].weight).toBe(1);

      // Check if calculateZapSplitAmounts handles the zero weight case
      expect(calculateZapSplitAmounts(3000000, splitInfo)).toEqual([]);
    });
  });

  // Fix the Integration test
  describe("Integration: Full Zap Flow", () => {
    // Clear mocks before each test
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should complete the full zap flow with validation", async () => {
      // 1. Simulate LNURL metadata fetch (for bitcoinplebdev@stacker.news)
      const mockLnurlResponse: LnurlPayResponse = {
        callback: "https://stacker.news/api/v1/lnurl/bitcoinplebdev/callback",
        maxSendable: 100000000000, // 100,000 sats in millisats
        minSendable: 1000, // 1 sat in millisats
        metadata: JSON.stringify([
          ["text/plain", "Zap to bitcoinplebdev on Stacker News"],
          ["text/identifier", "bitcoinplebdev@stacker.news"],
        ]),
        tag: "payRequest",
        allowsNostr: true, // Supports zaps
        nostrPubkey: lnurlServerKeypair.publicKey,
      };

      // Use our already mocked function
      (parseBolt11Invoice as jest.Mock).mockReturnValue({
        paymentHash: "payment_hash",
        amount: "1000",
        descriptionHash:
          "5d006d2cf1e73c7148e7519a4c68adc81642ce0e25a432b2434c99f97344c15f",
      });

      (fetchLnurlPayMetadata as jest.Mock).mockResolvedValue(mockLnurlResponse);

      // 2. Create a note to zap
      const noteEvent: NostrEvent = {
        id: "note123",
        pubkey: recipientKeypair.publicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: "This is a test note that will receive a zap!",
        sig: "sig123",
      };

      // 3. Create a zap request
      const zapRequestTemplate = createZapRequest(
        {
          recipientPubkey: recipientKeypair.publicKey,
          eventId: noteEvent.id,
          amount: 1000, // 1 sat in millisats
          relays: ["wss://relay.example.com"],
          content: "Great post!",
          lnurl:
            "lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0wvhxjmmrv9kzmmrv9kzumrfde9jq", // fake LNURL
        },
        senderKeypair.publicKey,
      );

      const signedZapRequest = await createSignedEvent(
        {
          ...zapRequestTemplate,
          pubkey: senderKeypair.publicKey,
          created_at: Math.floor(Date.now() / 1000),
        } as UnsignedEvent,
        senderKeypair.privateKey,
      );

      // 4. Mock the LNURL server response (invoice generation)
      const realInvoice =
        "lnbc10n1pnl9j2dpp5l26x7ehekgvlyys6v0ejx632efxu4takgrjf6djxx27p2mj2s0rshp5hrpx277yr8wz65tkjgk5pasf4206f3uqxwgjvpvumy5tn02u33tscqzzsxqyz5vqsp5xzj5n464jd8zzjfgxk7l6awyh9ljr2dxj840e5afyytsm74w7cvs9qxpqysgqu60yrltgcntw5phmdkdjqagfklrumflhf9facvhjhfljcethwejynzf0z2u6mrmfhxj8pg7a8r6ar9jf2wprmlv6gvyxhgetgnkjxwsqt233t8";

      // 5. Generate a zap receipt
      // Mock the hash calculation to match the real invoice
      const realInvoiceData = parseBolt11Invoice(realInvoice);
      (parseBolt11Invoice as jest.Mock).mockReturnValue(realInvoiceData);

      // Create a zap receipt with the real invoice
      const zapReceiptTemplate = createZapReceipt(
        {
          recipientPubkey: recipientKeypair.publicKey,
          eventId: noteEvent.id,
          bolt11: realInvoice,
          zapRequest: signedZapRequest,
          preimage:
            "5d006d2cf1e73c7148e7519a4c68adc81642ce0e25a432b2434c99f97344c15f", // random preimage
        },
        lnurlServerKeypair.publicKey,
      );

      const signedZapReceipt = await createSignedEvent(
        {
          ...zapReceiptTemplate,
          pubkey: lnurlServerKeypair.publicKey,
          created_at: Math.floor(Date.now() / 1000),
        } as UnsignedEvent,
        lnurlServerKeypair.privateKey,
      );

      // When validating, we need to mock sha256 to return the correct hash
      const descriptionHash = realInvoiceData?.descriptionHash;
      if (descriptionHash) {
        // Convert hex string to Uint8Array
        const descHashBytes = new Uint8Array(
          descriptionHash.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
        );
        (sha256 as jest.Mock).mockReturnValue(descHashBytes);
      }

      // 6. Validate the zap receipt
      const validation = validateZapReceipt(
        signedZapReceipt,
        lnurlServerKeypair.publicKey,
      );

      // 7. Check that everything is valid
      expect(validation.valid).toBe(true);
      expect(validation.sender).toBe(senderKeypair.publicKey);
      expect(validation.recipient).toBe(recipientKeypair.publicKey);
      expect(validation.eventId).toBe(noteEvent.id);
      expect(validation.content).toBe("Great post!");

      // 8. Finally, check that our new implementation used the correct methods
      expect(parseBolt11Invoice).toHaveBeenCalledWith(realInvoice);
      expect(sha256).toHaveBeenCalled();
    });
  });
});
