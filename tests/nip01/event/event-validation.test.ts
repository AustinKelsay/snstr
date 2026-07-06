import {
  createSignedEvent,
  createTextNote,
  validateEvent,
  NostrValidationError,
} from "../../../src/nip01/event";
import {
  sanitizeNostrEvent,
  validateSignedNostrEvent,
  verifySignedNostrEvent,
} from "../../../src/nip01/validation";
import { NostrEvent } from "../../../src/types/nostr";
import { getPublicKey } from "../../../src/utils/crypto";

describe("Nostr Event validation module", () => {
  const privateKey =
    "1111111111111111111111111111111111111111111111111111111111111111";
  const publicKey = getPublicKey(privateKey);

  async function signedTextNote(content = "central validation") {
    return createSignedEvent(createTextNote(content, privateKey), privateKey);
  }

  it("sanitizes unknown input into a Nostr Event", async () => {
    const signed = await signedTextNote();
    const sanitized = sanitizeNostrEvent({ ...signed });

    expect(sanitized).toEqual(signed);
  });

  it("rejects malformed event shape before signature verification", () => {
    expect(() =>
      sanitizeNostrEvent({
        id: "a".repeat(64),
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: "missing pubkey",
        sig: "b".repeat(128),
      }),
    ).toThrow(
      new NostrValidationError(
        "Invalid or missing pubkey: must be a string",
        "pubkey",
      ),
    );
  });

  it("verifies a valid signed Nostr Event", async () => {
    const signed = await signedTextNote();

    await expect(validateSignedNostrEvent(signed)).resolves.toEqual(signed);
    await expect(verifySignedNostrEvent(signed)).resolves.toBe(true);
  });

  it("rejects an event whose id does not match its content", async () => {
    const signed = await signedTextNote();
    const tampered: NostrEvent = {
      ...signed,
      content: "different content",
    };

    await expect(validateSignedNostrEvent(tampered)).rejects.toThrow(
      new NostrValidationError("Event ID does not match content hash", "id"),
    );
    await expect(verifySignedNostrEvent(tampered)).resolves.toBe(false);
  });

  it("rejects an event with an invalid signature", async () => {
    const signed = await signedTextNote();
    const tampered: NostrEvent = {
      ...signed,
      sig: "0".repeat(128),
    };

    await expect(validateSignedNostrEvent(tampered)).rejects.toThrow(
      new NostrValidationError("Invalid signature", "sig"),
    );
    await expect(verifySignedNostrEvent(tampered)).resolves.toBe(false);
  });

  it("can explicitly skip id and signature checks for encrypted NIP-46 Relay ingress", async () => {
    const encryptedRequest: NostrEvent = {
      id: "a".repeat(64),
      pubkey: publicKey,
      created_at: Math.floor(Date.now() / 1000),
      kind: 24133,
      tags: [["p", publicKey]],
      content: "encrypted request",
      sig: "b".repeat(128),
    };

    await expect(
      validateSignedNostrEvent(encryptedRequest, {
        skipIdAndSignatureValidationForKinds: [24133],
      }),
    ).resolves.toEqual(encryptedRequest);
    await expect(validateSignedNostrEvent(encryptedRequest)).rejects.toThrow(
      NostrValidationError,
    );
  });

  it("keeps the existing public validateEvent interface compatible", async () => {
    const signed = await signedTextNote("public compatibility");

    await expect(validateEvent(signed)).resolves.toBe(true);
  });

  it("keeps disabled id and signature checks compatible with existing shape validation", async () => {
    const signed = await signedTextNote("shape compatibility");
    const eventWithOpaqueIdAndSig: NostrEvent = {
      ...signed,
      id: "g".repeat(64),
      sig: "z".repeat(128),
    };

    await expect(
      validateEvent(eventWithOpaqueIdAndSig, {
        validateIds: false,
        validateSignatures: false,
      }),
    ).resolves.toBe(true);
  });
});
