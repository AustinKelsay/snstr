import {
  createDirectMessage,
  decryptDirectMessage,
  DM_KIND,
  GIFT_WRAP_KIND,
} from "../../src/nip17";
import { generateKeypair } from "../../src/utils/crypto";

/**
 * Tests for NIP-17 direct messaging
 */

describe("NIP-17 Gift Wrap", () => {
  test("should create and decrypt a direct message", async () => {
    const alice = await generateKeypair();
    const bob = await generateKeypair();

    const wrap = await createDirectMessage(
      "hello",
      alice.privateKey,
      bob.publicKey,
    );
    expect(wrap.kind).toBe(GIFT_WRAP_KIND);

    const rumor = decryptDirectMessage(wrap, bob.privateKey);
    expect(rumor.kind).toBe(DM_KIND);
    expect(rumor.content).toBe("hello");
    expect(rumor.tags).toContainEqual(["p", bob.publicKey]);
  });

  test("should fail to decrypt with wrong key", async () => {
    const alice = await generateKeypair();
    const bob = await generateKeypair();
    const eve = await generateKeypair();

    const wrap = await createDirectMessage(
      "secret",
      alice.privateKey,
      bob.publicKey,
    );
    expect(() => decryptDirectMessage(wrap, eve.privateKey)).toThrow();
  });
});
