import { Nostr } from "../../src/nip01/nostr";
import { createTextNote, createDirectMessage, createAddressableEvent } from "../../src/nip01/event";
import { generateKeypair } from "../../src/utils/crypto";
import { validateEventContent, MAX_CONTENT_SIZE as NIP46_MAX_CONTENT_SIZE } from "../../src/nip46/utils/validator";
import { SECURITY_LIMITS } from "../../src/utils/security-validator";

describe("UTF-8 Byte Length Validation", () => {
  let nostr: Nostr;
  let keypair: { privateKey: string; publicKey: string };

  beforeEach(async () => {
    nostr = new Nostr();
    keypair = await generateKeypair();
    nostr.setPrivateKey(keypair.privateKey);
  });

  describe("Content size validation with UTF-8 characters", () => {
    test("ASCII characters count as 1 byte each", async () => {
      // Create content that is exactly at the limit with ASCII characters
      const asciiContent = "a".repeat(SECURITY_LIMITS.MAX_CONTENT_SIZE);
      
      // This should succeed as it's exactly at the limit
      const event = await nostr.publishTextNote(asciiContent);
      expect(event).toBeNull(); // No relays connected, but validation should pass
    });

    test("Multi-byte UTF-8 characters are counted correctly", async () => {
      // Test with 2-byte characters (e.g., ñ, é, ü)
      const twoByteChar = "ñ"; // 2 bytes in UTF-8
      const twoByteContent = twoByteChar.repeat(SECURITY_LIMITS.MAX_CONTENT_SIZE / 2);
      
      // This should succeed as it's exactly at the limit (50,000 chars * 2 bytes = 100,000 bytes)
      const event1 = await nostr.publishTextNote(twoByteContent);
      expect(event1).toBeNull(); // No relays connected, but validation should pass

      // This should fail as it exceeds the limit
      const tooLongContent = twoByteChar.repeat(SECURITY_LIMITS.MAX_CONTENT_SIZE / 2 + 1);
      await expect(nostr.publishTextNote(tooLongContent)).rejects.toThrow(
        /Content too large: \d+ bytes \(max 100000\)/
      );
    });

    test("3-byte UTF-8 characters (e.g., Chinese, Japanese) are counted correctly", async () => {
      // Test with 3-byte characters
      const threeByteChar = "中"; // 3 bytes in UTF-8
      const maxChars = Math.floor(SECURITY_LIMITS.MAX_CONTENT_SIZE / 3);
      const threeByteContent = threeByteChar.repeat(maxChars);
      
      // This should succeed
      const event = await nostr.publishTextNote(threeByteContent);
      expect(event).toBeNull(); // No relays connected, but validation should pass

      // This should fail as it exceeds the limit
      const tooLongContent = threeByteChar.repeat(maxChars + 1);
      await expect(nostr.publishTextNote(tooLongContent)).rejects.toThrow(
        /Content too large: \d+ bytes \(max 100000\)/
      );
    });

    test("4-byte UTF-8 characters (e.g., emojis) are counted correctly", async () => {
      // Test with 4-byte characters
      const fourByteChar = "🚀"; // 4 bytes in UTF-8
      const maxChars = Math.floor(SECURITY_LIMITS.MAX_CONTENT_SIZE / 4);
      const fourByteContent = fourByteChar.repeat(maxChars);
      
      // This should succeed
      const event = await nostr.publishTextNote(fourByteContent);
      expect(event).toBeNull(); // No relays connected, but validation should pass

      // This should fail as it exceeds the limit
      const tooLongContent = fourByteChar.repeat(maxChars + 1);
      await expect(nostr.publishTextNote(tooLongContent)).rejects.toThrow(
        /Content too large: \d+ bytes \(max 100000\)/
      );
    });

    test("Mixed UTF-8 content is validated correctly", async () => {
      // Create content with mixed character types
      const mixedContent = 
        "Hello " +                    // 6 bytes (ASCII)
        "世界 " +                      // 7 bytes (2 Chinese chars + space)
        "🌍 " +                       // 5 bytes (emoji + space)
        "Ñoño";                       // 6 bytes (with tildes)
      // Total: 24 bytes

      // Calculate how many times we can repeat this to stay under limit
      const repeatCount = Math.floor(SECURITY_LIMITS.MAX_CONTENT_SIZE / 24);
      const validContent = mixedContent.repeat(repeatCount);
      
      const event = await nostr.publishTextNote(validContent);
      expect(event).toBeNull(); // No relays connected, but validation should pass

      // Test content that exceeds limit
      const tooLongContent = mixedContent.repeat(repeatCount + 1);
      await expect(nostr.publishTextNote(tooLongContent)).rejects.toThrow(
        /Content too large: \d+ bytes \(max 100000\)/
      );
    });

    test("String length vs byte length discrepancy", async () => {
      // Create content where string.length is under limit but byte length exceeds it
      const emoji = "🚀"; // 2 characters in string.length (surrogate pair), but 4 bytes
      const repeatCount = 30000; // Repeat count
      const content = emoji.repeat(repeatCount);
      
      // String length is 60,000 (2 chars per emoji) but byte length is 120,000
      expect(content.length).toBe(60000);
      expect(new TextEncoder().encode(content).length).toBe(120000);

      // This should fail due to byte length exceeding limit
      await expect(nostr.publishTextNote(content)).rejects.toThrow(
        /Content too large: 120000 bytes \(max 100000\)/
      );
    });
  });

  describe("Event creation functions validate UTF-8 byte length", () => {
    test("createTextNote validates UTF-8 byte length", () => {
      const emoji = "🚀";
      const tooLongContent = emoji.repeat(30000); // 120,000 bytes

      expect(() => createTextNote(tooLongContent, keypair.privateKey)).toThrow(
        /Content too large: 120000 bytes \(max 100000\)/
      );
    });

    test("createDirectMessage validates UTF-8 byte length", async () => {
      const recipientKeypair = await generateKeypair();
      const emoji = "🚀";
      const tooLongContent = emoji.repeat(30000); // 120,000 bytes

      await expect(
        createDirectMessage(tooLongContent, recipientKeypair.publicKey, keypair.privateKey)
      ).rejects.toThrow(/Content too large: 120000 bytes \(max 100000\)/);
    });

    test("createAddressableEvent validates UTF-8 byte length", () => {
      const emoji = "🚀";
      const tooLongContent = emoji.repeat(30000); // 120,000 bytes

      expect(() => 
        createAddressableEvent(30000, "test", tooLongContent, keypair.privateKey)
      ).toThrow(/Content too large: 120000 bytes \(max 100000\)/);
    });
  });

  describe("NIP-46 validateEventContent with UTF-8", () => {
    test("validates UTF-8 byte length correctly", () => {
      // Create JSON content with UTF-8 characters
      // We need to account for the JSON wrapper overhead
      const smallEvent = {
        kind: 1,
        content: "Hello", // Small content
        created_at: Math.floor(Date.now() / 1000),
        tags: [] // Include tags array as it's expected
      };
      
      const jsonWrapper = JSON.stringify(smallEvent);
      const wrapperOverhead = new TextEncoder().encode(jsonWrapper).length - 
                             new TextEncoder().encode("Hello").length;
      
      // Calculate how many emojis we can fit considering JSON overhead
      // NIP-46 has a different limit than the general security limits
      const maxContentBytes = NIP46_MAX_CONTENT_SIZE - wrapperOverhead;
      const emojisToFit = Math.floor(maxContentBytes / 4);
      
      const event = {
        kind: 1,
        content: "🚀".repeat(emojisToFit),
        created_at: Math.floor(Date.now() / 1000),
        tags: [] // Include tags array as it's expected
      };
      
      const jsonContent = JSON.stringify(event);
      
      // Should return true for content at or under the limit
      expect(validateEventContent(jsonContent)).toBe(true);

      // Create content that exceeds limit
      const largeEvent = {
        kind: 1,
        content: "🚀".repeat(emojisToFit + 10), // Add more emojis to exceed limit
        created_at: Math.floor(Date.now() / 1000),
        tags: [] // Include tags array as it's expected
      };
      
      const tooLargeContent = JSON.stringify(largeEvent);
      
      // Should return false for content exceeding limit
      expect(validateEventContent(tooLargeContent)).toBe(false);
    });
  });

  describe("Real-world UTF-8 scenarios", () => {
    test("Japanese text content", async () => {
      const japaneseText = "こんにちは世界！"; // "Hello World!" in Japanese
      const bytesPerPhrase = new TextEncoder().encode(japaneseText).length; // 25 bytes
      
      const repeatCount = Math.floor(SECURITY_LIMITS.MAX_CONTENT_SIZE / bytesPerPhrase);
      const validContent = japaneseText.repeat(repeatCount);
      
      const event = await nostr.publishTextNote(validContent);
      expect(event).toBeNull(); // No relays connected, but validation should pass
    });

    test("Arabic text content", async () => {
      const arabicText = "مرحبا بالعالم"; // "Hello World" in Arabic
      const bytesPerPhrase = new TextEncoder().encode(arabicText).length; // 24 bytes
      
      const repeatCount = Math.floor(SECURITY_LIMITS.MAX_CONTENT_SIZE / bytesPerPhrase);
      const validContent = arabicText.repeat(repeatCount);
      
      const event = await nostr.publishTextNote(validContent);
      expect(event).toBeNull(); // No relays connected, but validation should pass
    });

    test("Mixed emoji and text content", async () => {
      const socialMediaPost = "Great news! 🎉🎊 Check this out: 👀✨ #nostr #decentralized 🚀🌍";
      const bytesPerPost = new TextEncoder().encode(socialMediaPost).length;
      
      const repeatCount = Math.floor(SECURITY_LIMITS.MAX_CONTENT_SIZE / bytesPerPost);
      const validContent = socialMediaPost.repeat(repeatCount);
      
      const event = await nostr.publishTextNote(validContent);
      expect(event).toBeNull(); // No relays connected, but validation should pass
    });
  });
});