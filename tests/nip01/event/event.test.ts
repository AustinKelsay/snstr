import {
  createSignedEvent,
  createTextNote,
  createDirectMessage,
  createMetadataEvent,
  createAddressableEvent,
  UnsignedEvent,
  getEventHash,
  validateEvent,
  NostrValidationError,
} from "../../../src/nip01/event";
import { NostrEvent } from "../../../src/types/nostr";
import { verifySignature } from "../../../src/utils/crypto";
import { getPublicKey } from "../../../src/utils/crypto";

describe("Event Creation and Signing", () => {
  const privateKey =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const publicKey = getPublicKey(privateKey);

  describe("getEventHash", () => {
    it("should consistently generate the same hash for the same event data", async () => {
      const event: UnsignedEvent = {
        pubkey: publicKey,
        created_at: 1652347275,
        kind: 1,
        tags: [["t", "test"]],
        content: "Hello, world!",
      };

      const hash1 = await getEventHash(event);
      const hash2 = await getEventHash(event);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    });

    it("should throw error for missing pubkey", async () => {
      const event = {
        created_at: 1652347275,
        kind: 1,
        tags: [],
        content: "Hello, world!",
      } as unknown as UnsignedEvent;

      await expect(getEventHash(event)).rejects.toThrow(
        "Invalid event: missing pubkey",
      );
    });

    it("should throw error for missing created_at", async () => {
      const event = {
        pubkey: publicKey,
        kind: 1,
        tags: [],
        content: "Hello, world!",
      } as unknown as UnsignedEvent;

      await expect(getEventHash(event)).rejects.toThrow(
        "Invalid event: missing created_at",
      );
    });

    it("should throw error for missing kind", async () => {
      const event = {
        pubkey: publicKey,
        created_at: 1652347275,
        tags: [],
        content: "Hello, world!",
      } as unknown as UnsignedEvent;

      await expect(getEventHash(event)).rejects.toThrow(
        "Invalid event: missing kind",
      );
    });

    it("should throw error for invalid tags (not an array)", async () => {
      const event = {
        pubkey: publicKey,
        created_at: 1652347275,
        kind: 1,
        tags: "not an array" as string,
        content: "Hello, world!",
      } as unknown as UnsignedEvent;

      await expect(getEventHash(event)).rejects.toThrow(
        "Invalid event: tags must be an array",
      );
    });

    it("should throw error for invalid tag item (not an array)", async () => {
      const event = {
        pubkey: publicKey,
        created_at: 1652347275,
        kind: 1,
        tags: ["not an array" as string],
        content: "Hello, world!",
      } as unknown as UnsignedEvent;

      await expect(getEventHash(event)).rejects.toThrow(
        "Invalid event: each tag must be an array",
      );
    });

    it("should throw error for invalid tag item content (not a string)", async () => {
      const event = {
        pubkey: publicKey,
        created_at: 1652347275,
        kind: 1,
        tags: [["t", 123 as number]],
        content: "Hello, world!",
      } as unknown as UnsignedEvent;

      await expect(getEventHash(event)).rejects.toThrow(
        "Invalid event: tag items must be strings",
      );
    });

    it("should throw error for invalid content (not a string)", async () => {
      const event = {
        pubkey: publicKey,
        created_at: 1652347275,
        kind: 1,
        tags: [],
        content: 123 as number,
      } as unknown as UnsignedEvent;

      await expect(getEventHash(event)).rejects.toThrow(
        "Invalid event: content must be a string",
      );
    });

    it("should hash events with special characters in content correctly", async () => {
      // Test with various special characters that might be encoded differently
      const event: UnsignedEvent = {
        pubkey: publicKey,
        created_at: 1652347275,
        kind: 1,
        tags: [],
        content: 'Hello, "world"!\n\\Special/\t\r\u2022\u0000',
      };

      const hash = await getEventHash(event);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("should produce the same hash for the same event even if object props are ordered differently", async () => {
      // Create the same event data in two different ways
      const event1: UnsignedEvent = {
        pubkey: publicKey,
        created_at: 1652347275,
        kind: 1,
        tags: [["t", "test"]],
        content: "Hello, world!",
      };

      // TypeScript doesn't care about property order, so this is fine
      const event2: UnsignedEvent = {
        content: "Hello, world!",
        pubkey: publicKey,
        tags: [["t", "test"]],
        created_at: 1652347275,
        kind: 1,
      };

      const hash1 = await getEventHash(event1);
      const hash2 = await getEventHash(event2);

      expect(hash1).toBe(hash2);
    });
  });

  describe("createSignedEvent", () => {
    it("should create a signed event with valid signature", async () => {
      const template: UnsignedEvent = {
        pubkey: publicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        content: "Hello, world!",
        tags: [],
      };

      const signedEvent = await createSignedEvent(template, privateKey);

      expect(signedEvent.id).toBeDefined();
      expect(signedEvent.sig).toBeDefined();
      expect(signedEvent.sig).toMatch(/^[0-9a-f]{128}$/);

      const isValid = await verifySignature(
        signedEvent.id,
        signedEvent.sig,
        signedEvent.pubkey,
      );
      expect(isValid).toBe(true);
    });
  });

  describe("createTextNote", () => {
    it("should create a text note event with pubkey automatically set", async () => {
      const content = "Hello, world!";
      const tags = [["t", "test"]];

      const template = createTextNote(content, privateKey, tags);

      expect(template.kind).toBe(1);
      expect(template.content).toBe(content);
      expect(template.tags).toEqual(tags);
      expect(template.pubkey).toBe(publicKey);

      const signedEvent = await createSignedEvent(template, privateKey);
      expect(signedEvent.id).toBeDefined();
      expect(signedEvent.sig).toBeDefined();
    });
  });

  describe("createDirectMessage", () => {
    it("should create a direct message event with pubkey automatically set", async () => {
      const content = "Secret message";
      const recipientPrivateKey =
        "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
      const recipientPubkey = getPublicKey(recipientPrivateKey);
      const tags = [["t", "test"]];

      const template = await createDirectMessage(
        content,
        recipientPubkey,
        privateKey,
        tags,
      );

      expect(template.kind).toBe(4);
      expect(template.content).toContain("?iv=");
      expect(template.tags).toContainEqual(["p", recipientPubkey]);
      expect(template.tags).toContainEqual(["t", "test"]);
      expect(template.pubkey).toBe(publicKey);

      const signedEvent = await createSignedEvent(template, privateKey);
      expect(signedEvent.id).toBeDefined();
      expect(signedEvent.sig).toBeDefined();
    });

    it("should throw NostrValidationError for invalid recipient pubkey", async () => {
      const content = "Secret message";
      const invalidPubkeys = [
        "", // Empty string
        "invalidpubkey", // Too short
        "ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789", // Uppercase hex
        "123456789012345678901234567890123456789012345678901234567890123X", // Invalid character
        "123456789012345678901234567890123456789012345678901234567890123456", // Too long
        "12345678901234567890123456789012345678901234567890123456789012", // Too short by one
      ];

      for (const invalidPubkey of invalidPubkeys) {
        await expect(
          createDirectMessage(content, invalidPubkey, privateKey),
        ).rejects.toThrow(
          new NostrValidationError(
            "Invalid recipient public key: must be a 64-character lowercase hex string",
            "recipientPubkey",
          ),
        );
      }
    });

    it("should throw NostrValidationError for missing or null recipient pubkey", async () => {
      const content = "Secret message";
      
      await expect(
        createDirectMessage(content, null as any, privateKey),
      ).rejects.toThrow(
        new NostrValidationError(
          "Invalid recipient public key: must be a 64-character lowercase hex string",
          "recipientPubkey",
        ),
      );

      await expect(
        createDirectMessage(content, undefined as any, privateKey),
      ).rejects.toThrow(
        new NostrValidationError(
          "Invalid recipient public key: must be a 64-character lowercase hex string",
          "recipientPubkey",
        ),
      );
    });
  });

  describe("createMetadataEvent", () => {
    it("should create a metadata event with pubkey automatically set", async () => {
      const metadata = {
        name: "Test User",
        about: "Just testing",
      };

      const template = createMetadataEvent(metadata, privateKey);

      expect(template.kind).toBe(0);
      expect(template.tags).toEqual([]);
      expect(JSON.parse(template.content)).toEqual(metadata);
      expect(template.pubkey).toBe(publicKey);

      const signedEvent = await createSignedEvent(template, privateKey);
      expect(signedEvent.id).toBeDefined();
      expect(signedEvent.sig).toBeDefined();
    });
  });

  describe("createAddressableEvent", () => {
    it("should create an addressable event with the correct kind, d-tag, and pubkey", async () => {
      const kind = 30001;
      const dTagValue = "test-identifier";
      const content = "Addressable event content";
      const additionalTags = [
        ["t", "test"],
        ["client", "snstr"],
      ];

      const template = createAddressableEvent(
        kind,
        dTagValue,
        content,
        privateKey,
        additionalTags,
      );

      expect(template.kind).toBe(30001);
      expect(template.content).toBe(content);
      expect(template.pubkey).toBe(publicKey);

      // Check that the d tag is included and is the first tag
      expect(template.tags[0]).toEqual(["d", dTagValue]);

      // Check that additional tags are included
      expect(template.tags).toContainEqual(["t", "test"]);
      expect(template.tags).toContainEqual(["client", "snstr"]);

      // Create a signed version and verify it
      const signedEvent = await createSignedEvent(template, privateKey);
      expect(signedEvent.id).toBeDefined();
      expect(signedEvent.sig).toBeDefined();

      const isValid = await verifySignature(
        signedEvent.id,
        signedEvent.sig,
        signedEvent.pubkey,
      );
      expect(isValid).toBe(true);
    });

    it("should throw an error if kind is outside the valid range (30000-39999)", async () => {
      // Test with kinds outside the valid range
      const invalidKinds = [1, 29999, 40000, 50000];

      for (const kind of invalidKinds) {
        expect(() => {
          createAddressableEvent(
            kind,
            "test-identifier",
            "Invalid kind test",
            privateKey,
          );
        }).toThrow("Addressable events must have kind between 30000-39999");
      }
    });

    it("should work with different d-tag values", async () => {
      // Test with various d-tag values
      const dTagValues = [
        "",
        "simple",
        "complex-value",
        "value_with_underscores",
        "123",
      ];

      for (const dTagValue of dTagValues) {
        const template = createAddressableEvent(
          30001,
          dTagValue,
          "Test with different d-tag values",
          privateKey,
        );

        expect(template.tags[0]).toEqual(["d", dTagValue]);
      }
    });

    it("should allow creating events with different kinds in the valid range", async () => {
      // Test with different valid kinds
      const validKinds = [30000, 30001, 35000, 39999];

      for (const kind of validKinds) {
        const template = createAddressableEvent(
          kind,
          "test-identifier",
          "Valid kind test",
          privateKey,
        );

        expect(template.kind).toBe(kind);
      }
    });
  });

  describe("validateEvent - NIP-01 Field Format Validations", () => {
    const privateKey =
      "1111111111111111111111111111111111111111111111111111111111111111"; // A different private key for these tests
    const publicKey = getPublicKey(privateKey);
    const baseTime = Math.floor(Date.now() / 1000);

    let baseEvent: NostrEvent;

    beforeEach(async () => {
      // Create a valid base event structure before each test
      const unsigned: UnsignedEvent = {
        pubkey: publicKey,
        created_at: baseTime,
        kind: 1,
        tags: [],
        content: "Validating event structure",
      };
      const id = await getEventHash(unsigned);
      const sig = (await verifySignature(id, "ab".repeat(64), publicKey)) // Placeholder, real sig not strictly needed for these field format tests if signature validation is off
        ? "ab".repeat(64)
        : await createSignedEvent(unsigned, privateKey).then((e) => e.sig); // Fallback to generate a real one if needed

      baseEvent = {
        ...unsigned,
        id,
        sig,
      };
    });

    // Test for 'id'
    describe("event.id validation", () => {
      it("should pass with a valid lowercase hex id", async () => {
        const event = { ...baseEvent, id: "a1".repeat(32) }; // ensure lowercase
        await expect(
          validateEvent(event, {
            validateSignatures: false,
            validateIds: false,
          }),
        ).resolves.toBe(true);
      });

      it("should throw NostrValidationError for an uppercase hex id", async () => {
        const event = { ...baseEvent, id: "A1".repeat(32) };
        await expect(
          validateEvent(event, {
            validateSignatures: false,
            validateIds: false,
          }),
        ).rejects.toThrow(
          new NostrValidationError(
            "Invalid event ID: must be lowercase hex",
            "id",
          ),
        );
      });
    });

    // Test for 'pubkey'
    describe("event.pubkey validation", () => {
      it("should pass with a valid lowercase hex pubkey", async () => {
        const event = { ...baseEvent, pubkey: "b2".repeat(32) }; // ensure lowercase
        await expect(
          validateEvent(event, {
            validateSignatures: false,
            validateIds: false,
          }),
        ).resolves.toBe(true);
      });

      it("should throw NostrValidationError for an uppercase hex pubkey", async () => {
        const event = { ...baseEvent, pubkey: "B2".repeat(32) };
        await expect(
          validateEvent(event, {
            validateSignatures: false,
            validateIds: false,
          }),
        ).rejects.toThrow(
          new NostrValidationError(
            "Invalid pubkey: must be a 64-character lowercase hex string",
            "pubkey",
          ),
        );
      });
    });

    // Test for 'sig'
    describe("event.sig validation", () => {
      it("should pass with a valid lowercase hex sig", async () => {
        const event = { ...baseEvent, sig: "c3".repeat(64) }; // ensure lowercase
        await expect(
          validateEvent(event, {
            validateSignatures: false,
            validateIds: false,
          }),
        ).resolves.toBe(true);
      });

      it("should throw NostrValidationError for an uppercase hex sig", async () => {
        const event = { ...baseEvent, sig: "C3".repeat(64) };
        await expect(
          validateEvent(event, {
            validateSignatures: false,
            validateIds: false,
          }),
        ).rejects.toThrow(
          new NostrValidationError(
            "Invalid signature: must be lowercase hex",
            "sig",
          ),
        );
      });
    });

    // Optional: Test that other basic validations still work
    it("should still throw for other invalid fields like missing kind", async () => {
      const event = { ...baseEvent, kind: undefined } as unknown as NostrEvent;
      await expect(validateEvent(event)).rejects.toThrow(
        new NostrValidationError("Kind must be a number", "kind"), // Or whatever the actual error for undefined kind is
      );
    });
  });
});
