import {
  isValidPrivateKey,
  isValidPublicKeyFormat,
  isValidPublicKeyPoint,
} from "../../src/utils/key-validation";
import {
  isHexOfLength,
  isLowercaseHexOfLength,
  utf8ByteLength,
} from "../../src/utils/wire-validation";
import { generateKeypair } from "../../src/utils/crypto";

describe("canonical key validation", () => {
  test("validates case-insensitive fixed-width wire hex", () => {
    expect(isHexOfLength("aA", 2)).toBe(true);
    expect(isHexOfLength("aa", 3)).toBe(false);
    expect(isHexOfLength("ag", 2)).toBe(false);
    expect(isHexOfLength(null, 2)).toBe(false);
  });

  test("validates lowercase-only NIP-01 wire hex", () => {
    expect(isLowercaseHexOfLength("af", 2)).toBe(true);
    expect(isLowercaseHexOfLength("aF", 2)).toBe(false);
    expect(isLowercaseHexOfLength("af", 3)).toBe(false);
  });

  test("measures resource limits in UTF-8 bytes", () => {
    expect(utf8ByteLength("nostr")).toBe(5);
    expect(utf8ByteLength("⚡")).toBe(3);
    expect(utf8ByteLength("😀")).toBe(4);
  });

  test("owns generic secp256k1 key format and curve validation", async () => {
    const keypair = await generateKeypair();
    const fieldPrime =
      "fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f";
    const curveOrder =
      "fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141";
    const inRangeOffCurveX = "5".padStart(64, "0");

    expect(isValidPrivateKey(keypair.privateKey)).toBe(true);
    expect(isValidPublicKeyFormat(keypair.publicKey)).toBe(true);
    expect(isValidPublicKeyPoint(keypair.publicKey)).toBe(true);
    expect(isValidPublicKeyFormat(fieldPrime)).toBe(false);
    expect(isValidPublicKeyFormat(inRangeOffCurveX)).toBe(true);
    expect(isValidPublicKeyPoint(inRangeOffCurveX)).toBe(false);
    expect(isValidPrivateKey(curveOrder)).toBe(false);
    expect(isValidPrivateKey("0".repeat(64))).toBe(false);
    expect(isValidPublicKeyFormat("0".repeat(64))).toBe(false);
    expect(isValidPublicKeyPoint("f".repeat(64))).toBe(false);
    expect(isValidPrivateKey("1".repeat(63))).toBe(false);
    expect(isValidPrivateKey("g".repeat(64))).toBe(false);
    expect(isValidPublicKeyFormat("1".repeat(65))).toBe(false);
    expect(isValidPublicKeyFormat("z".repeat(64))).toBe(false);
    expect(isValidPublicKeyFormat("A".repeat(64))).toBe(true);
  });
});
