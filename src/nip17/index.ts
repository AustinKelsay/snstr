/**
 * NIP-17: Direct Messaging with Gift Wrap
 *
 * Minimal implementation of the NIP-17 direct messaging scheme
 * using NIP-44 encryption and NIP-59 wrapping.
 *
 * @see https://github.com/nostr-protocol/nips/blob/master/17.md
 */
import { NostrEvent } from "../types/nostr";
import type { UnsignedEvent } from "../nip01/event";
import { encrypt as encryptNIP44, decrypt as decryptNIP44 } from "../nip44";
import {
  generateKeypair,
  getPublicKey,
  verifySignature,
} from "../utils/crypto";
import { createSignedEvent } from "../nip01/event";

// Cache for the dynamically imported crypto module
let nodeCryptoModule: {
  randomInt: (min: number, max: number) => number;
} | null = null;
let cryptoInitialized = false;

/**
 * Initialize crypto module for ESM environments
 * This should be called once during application startup if using ESM
 */
export async function initializeCrypto(): Promise<void> {
  if (
    typeof process !== "undefined" &&
    process.versions &&
    process.versions.node &&
    !cryptoInitialized
  ) {
    try {
      nodeCryptoModule = await import("crypto");
      cryptoInitialized = true;
    } catch (error) {
      // Ignore error - will fall back to globalThis.crypto
    }
  }
}

/**
 * Generate a timestamp up to two days in the past.
 * Used to obscure creation time as recommended by the spec.
 */
function randomTimestampInPast(): number {
  const twoDays = 2 * 24 * 60 * 60 * 1000;
  // Use secure random for gift wrap timing (security critical)
  const secureRandomValue = (() => {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const array = new Uint32Array(1);
      crypto.getRandomValues(array);
      return array[0] / (0xffffffff + 1);
    } else if (
      typeof process !== "undefined" &&
      process.versions &&
      process.versions.node
    ) {
      // Try to use pre-imported crypto module first
      if (nodeCryptoModule) {
        return nodeCryptoModule.randomInt(0, 0x100000000) / 0x100000000;
      }
      // Fallback to require for CommonJS environments
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const nodeCrypto = require("crypto");
        return nodeCrypto.randomInt(0, 0x100000000) / 0x100000000;
      } catch (requireError) {
        // If require fails in ESM, throw informative error
        throw new Error(
          "No secure random source available for gift wrap timing. In ESM environments, call initializeCrypto() before using NIP-17 functions.",
        );
      }
    }
    throw new Error("No secure random source available for gift wrap timing");
  })();
  const offset = Math.floor(secureRandomValue * twoDays);
  return Math.floor((Date.now() - offset) / 1000);
}

/** Constant for text message kind */
export const DM_KIND = 14;
/** Constant for file message kind */
export const FILE_KIND = 15;
/** Kind for seal events */
export const SEAL_KIND = 13;
/** Kind for gift wrap events */
export const GIFT_WRAP_KIND = 1059;

/**
 * Create a gift wrapped direct message event for a single receiver.
 *
 * The returned event is a kind 1059 event containing a sealed kind 13 event,
 * which in turn wraps the unsigned kind 14 rumor.
 */
export async function createDirectMessage(
  message: string,
  senderPrivateKey: string,
  receiverPublicKey: string,
): Promise<NostrEvent> {
  const senderPub = getPublicKey(senderPrivateKey);

  const rumor: UnsignedEvent = {
    pubkey: senderPub,
    created_at: randomTimestampInPast(),
    kind: DM_KIND,
    tags: [["p", receiverPublicKey]],
    content: message,
  };

  const sealedContent = encryptNIP44(
    JSON.stringify(rumor),
    senderPrivateKey,
    receiverPublicKey,
  );

  const seal: UnsignedEvent = {
    pubkey: senderPub,
    created_at: randomTimestampInPast(),
    kind: SEAL_KIND,
    content: sealedContent,
    tags: [],
  };

  const signedSeal = await createSignedEvent(seal, senderPrivateKey);

  const ephemeral = await generateKeypair();

  const wrappedContent = encryptNIP44(
    JSON.stringify(signedSeal),
    ephemeral.privateKey,
    receiverPublicKey,
  );

  const wrap: UnsignedEvent = {
    pubkey: ephemeral.publicKey,
    created_at: randomTimestampInPast(),
    kind: GIFT_WRAP_KIND,
    content: wrappedContent,
    tags: [["p", receiverPublicKey]],
  };

  const signedWrap = await createSignedEvent(wrap, ephemeral.privateKey);

  return signedWrap;
}

/**
 * Decrypt a gift wrapped direct message.
 *
 * Returns the inner kind 14 rumor event.
 */
export function decryptDirectMessage(
  giftWrap: NostrEvent,
  receiverPrivateKey: string,
): UnsignedEvent {
  if (giftWrap.kind !== GIFT_WRAP_KIND) {
    throw new Error("Invalid gift wrap kind");
  }

  const sealJson = decryptNIP44(
    giftWrap.content,
    receiverPrivateKey,
    giftWrap.pubkey,
  );
  const seal: NostrEvent = JSON.parse(sealJson);
  if (seal.kind !== SEAL_KIND) {
    throw new Error("Invalid seal kind");
  }
  const validSeal = verifySignature(seal.id, seal.sig, seal.pubkey);
  if (!validSeal) {
    throw new Error("Invalid seal signature");
  }

  const rumorJson = decryptNIP44(seal.content, receiverPrivateKey, seal.pubkey);
  const rumor: UnsignedEvent = JSON.parse(rumorJson);
  if (rumor.pubkey !== seal.pubkey) {
    throw new Error("Sender mismatch between seal and rumor");
  }
  if (rumor.kind !== DM_KIND && rumor.kind !== FILE_KIND) {
    throw new Error("Invalid rumor kind");
  }

  return rumor;
}
