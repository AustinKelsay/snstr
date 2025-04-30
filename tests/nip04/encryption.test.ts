import {
  generateKeypair,
  encryptNIP04,
  decryptNIP04,
  getNIP04SharedSecret,
} from "../../src";

describe("NIP-04 Encryption", () => {
  it("should encrypt and decrypt a message correctly", async () => {
    // Generate keypairs for testing
    const aliceKeypair = await generateKeypair();
    const bobKeypair = await generateKeypair();

    // Original message
    const originalMessage =
      "Hello, this is a test message for NIP-04 encryption!";

    // Alice encrypts for Bob
    const encrypted = encryptNIP04(
      originalMessage,
      aliceKeypair.privateKey,
      bobKeypair.publicKey,
    );

    // Bob decrypts
    const decrypted = decryptNIP04(
      encrypted,
      bobKeypair.privateKey,
      aliceKeypair.publicKey,
    );

    // Check that we get back the original message
    expect(decrypted).toBe(originalMessage);
  });

  it("should generate identical shared secrets in both directions", async () => {
    // Generate keypairs for testing
    const aliceKeypair = await generateKeypair();
    const bobKeypair = await generateKeypair();

    // Get shared secrets
    const aliceSecret = getNIP04SharedSecret(
      aliceKeypair.privateKey,
      bobKeypair.publicKey,
    );
    const bobSecret = getNIP04SharedSecret(
      bobKeypair.privateKey,
      aliceKeypair.publicKey,
    );

    // Convert to hex for comparison
    const aliceHex = Buffer.from(aliceSecret).toString("hex");
    const bobHex = Buffer.from(bobSecret).toString("hex");

    // They should be identical
    expect(aliceHex).toBe(bobHex);
  });

  it("should follow the NIP-04 format with ?iv= parameter", async () => {
    // Generate keypairs for testing
    const aliceKeypair = await generateKeypair();
    const bobKeypair = await generateKeypair();

    // Encrypt a message
    const message = "Test message";
    const encrypted = encryptNIP04(
      message,
      aliceKeypair.privateKey,
      bobKeypair.publicKey,
    );

    // Verify the format matches NIP-04 spec: <encrypted_text>?iv=<initialization_vector>
    expect(encrypted).toContain("?iv=");

    // Split to verify parts
    const parts = encrypted.split("?iv=");
    expect(parts.length).toBe(2);

    // Both parts should be non-empty
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
  });
});
