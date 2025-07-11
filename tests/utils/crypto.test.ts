import {
  generateKeypair,
  getPublicKey,
  signEvent,
  verifySignature,
  sha256Hex,
} from "../../src/utils/crypto";
import {
  encrypt as encryptNIP04,
  decrypt as decryptNIP04,
  getSharedSecret as getNIP04SharedSecret,
  NIP04DecryptionError,
} from "../../src/nip04";

describe("Crypto Utilities", () => {
  describe("sha256", () => {
    it("should hash strings correctly", () => {
      const input = "test message";
      const hash = sha256Hex(input);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("should hash Uint8Array correctly", () => {
      const input = new TextEncoder().encode("test message");
      const hash = sha256Hex(input);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("Key Generation and Management", () => {
    it("should generate valid keypair", async () => {
      const keypair = await generateKeypair();
      expect(keypair.privateKey).toMatch(/^[0-9a-f]{64}$/);
      expect(keypair.publicKey).toMatch(/^[0-9a-f]{64}$/);
    });

    it("should generate private keys within the valid secp256k1 curve range", async () => {
      // The secp256k1 curve order
      const curveOrder = BigInt(
        "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141",
      );

      // Test multiple generated keys to ensure they're all valid
      for (let i = 0; i < 5; i++) {
        const keypair = await generateKeypair();
        const privateKeyBigInt = BigInt(`0x${keypair.privateKey}`);

        // Valid private keys must be: 0 < privateKey < curve order
        expect(privateKeyBigInt).toBeGreaterThan(BigInt(0));
        expect(privateKeyBigInt).toBeLessThan(curveOrder);
      }
    });

    it("should derive correct public key from private key", () => {
      const privateKey =
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      const publicKey = getPublicKey(privateKey);
      expect(publicKey).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("Event Signing and Verification", () => {
    const privateKey =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const publicKey = getPublicKey(privateKey);
    const eventId =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    it("should sign event and verify signature", async () => {
      const signature = await signEvent(eventId, privateKey);
      expect(signature).toMatch(/^[0-9a-f]{128}$/);

      const isValid = await verifySignature(eventId, signature, publicKey);
      expect(isValid).toBe(true);
    });

    it("should reject invalid signatures", async () => {
      const signature = await signEvent(eventId, privateKey);
      const wrongEventId =
        "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

      const isValid = await verifySignature(wrongEventId, signature, publicKey);
      expect(isValid).toBe(false);
    });

    it("should reject signatures with wrong public key", async () => {
      const signature = await signEvent(eventId, privateKey);
      const wrongPublicKey =
        "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

      const isValid = await verifySignature(eventId, signature, wrongPublicKey);
      expect(isValid).toBe(false);
    });
  });

  describe("NIP-04 Encryption", () => {
    let alicePrivateKey: string;
    let alicePublicKey: string;
    let bobPrivateKey: string;
    let bobPublicKey: string;

    beforeEach(async () => {
      const aliceKeypair = await generateKeypair();
      alicePrivateKey = aliceKeypair.privateKey;
      alicePublicKey = aliceKeypair.publicKey;

      const bobKeypair = await generateKeypair();
      bobPrivateKey = bobKeypair.privateKey;
      bobPublicKey = bobKeypair.publicKey;
    });

    test("getNIP04SharedSecret should create identical secrets for both parties", () => {
      const aliceSharedSecret = getNIP04SharedSecret(
        alicePrivateKey,
        bobPublicKey,
      );
      const bobSharedSecret = getNIP04SharedSecret(
        bobPrivateKey,
        alicePublicKey,
      );

      // Convert Uint8Array to hex for comparison
      const aliceSecretHex = Buffer.from(aliceSharedSecret).toString("hex");
      const bobSecretHex = Buffer.from(bobSharedSecret).toString("hex");

      expect(aliceSecretHex).toEqual(bobSecretHex);
    });

    test("encryptNIP04 and decryptNIP04 should work together", () => {
      const originalMessage = "This is a secret message!";

      // Alice encrypts message for Bob
      const encrypted = encryptNIP04(
        alicePrivateKey,
        bobPublicKey,
        originalMessage,
      );

      // Check encrypted format
      expect(encrypted).toContain("?iv=");

      // Bob decrypts message from Alice
      const decrypted = decryptNIP04(bobPrivateKey, alicePublicKey, encrypted);

      expect(decrypted).toEqual(originalMessage);
    });

    test("decryption should fail with wrong keys", async () => {
      const originalMessage = "This is a secret message!";
      const encrypted = encryptNIP04(
        alicePrivateKey,
        bobPublicKey,
        originalMessage,
      );

      // Generate an unrelated keypair
      const eveKeypair = await generateKeypair();
      const evePrivateKey = eveKeypair.privateKey;

      // Eve tries to decrypt with her key
      expect(() =>
        decryptNIP04(evePrivateKey, alicePublicKey, encrypted),
      ).toThrow(NIP04DecryptionError);
    });

    test("should produce different ciphertexts for the same message to different recipients", async () => {
      // Create Charlie as a third party
      const charlieKeypair = await generateKeypair();
      const charliePrivateKey = charlieKeypair.privateKey;
      const charliePublicKey = charlieKeypair.publicKey;

      const message = "This is a confidential message";

      // Alice encrypts for Bob
      const encryptedForBob = encryptNIP04(
        alicePrivateKey,
        bobPublicKey,
        message,
      );

      // Alice encrypts same message for Charlie
      const encryptedForCharlie = encryptNIP04(
        alicePrivateKey,
        charliePublicKey,
        message,
      );

      // The two encrypted messages should be different
      expect(encryptedForBob).not.toBe(encryptedForCharlie);

      // But both should decrypt to the original message by their intended recipient
      expect(decryptNIP04(bobPrivateKey, alicePublicKey, encryptedForBob)).toBe(
        message,
      );
      expect(
        decryptNIP04(charliePrivateKey, alicePublicKey, encryptedForCharlie),
      ).toBe(message);
    });

    test("should handle various message types including special characters", () => {
      const testMessages = [
        "Hello, world!",
        "Special chars: !@#$%^&*()_+{}|:\"<>?~`-=[]\\;',./Æ©®",
        "Unicode: 你好，世界！こんにちは！",
        "Emoji: 👋🌍🔐🔑",
        "Very long message: " + "X".repeat(1000),
        JSON.stringify({ hello: "world", nested: { data: [1, 2, 3] } }),
        "", // Empty message
      ];

      testMessages.forEach((message) => {
        const encrypted = encryptNIP04(alicePrivateKey, bobPublicKey, message);
        const decrypted = decryptNIP04(
          bobPrivateKey,
          alicePublicKey,
          encrypted,
        );
        expect(decrypted).toBe(message);
      });
    });

    test("decryption should fail on tampered messages", () => {
      const message = "This is a secure message";
      const encrypted = encryptNIP04(alicePrivateKey, bobPublicKey, message);

      // Tamper with the message by changing a character in the encrypted part
      const parts = encrypted.split("?iv=");
      const tampered =
        parts[0].substring(0, parts[0].length - 1) + "X" + "?iv=" + parts[1];

      // Decryption should throw an error
      expect(() =>
        decryptNIP04(bobPrivateKey, alicePublicKey, tampered),
      ).toThrow(NIP04DecryptionError);
    });
  });
});
