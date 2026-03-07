import { createEvent, createSignedEvent } from "../nip01/event";
import {
  decrypt as decryptNIP04,
  encrypt as encryptNIP04,
} from "../nip04/web";
import { decrypt as decryptNIP44, encrypt as encryptNIP44 } from "../nip44";
import { getPublicKey } from "../utils/crypto";
import type { EventTemplate, NostrEvent } from "../types/nostr";
import type { SignerEncryption } from "./types";

export type {
  Signer,
  SignerCapabilities,
  SignerEncryption,
  RemoteSigner,
} from "./types";
export {
  getSignerCapabilities,
  Nip07Signer,
  Nip46Signer,
} from "./shared";

export class LocalKeySigner {
  private readonly publicKey: string;

  readonly nip04: SignerEncryption;
  readonly nip44: SignerEncryption;

  constructor(private readonly privateKey: string) {
    this.publicKey = getPublicKey(privateKey);

    this.nip04 = {
      encrypt: async (pubkey, plaintext) =>
        encryptNIP04(this.privateKey, pubkey, plaintext),
      decrypt: async (pubkey, ciphertext) =>
        decryptNIP04(this.privateKey, pubkey, ciphertext),
    };

    this.nip44 = {
      encrypt: async (pubkey, plaintext) =>
        encryptNIP44(plaintext, this.privateKey, pubkey),
      decrypt: async (pubkey, ciphertext) =>
        decryptNIP44(ciphertext, this.privateKey, pubkey),
    };
  }

  async getPublicKey(): Promise<string> {
    return this.publicKey;
  }

  async signEvent(event: EventTemplate): Promise<NostrEvent> {
    const unsignedEvent = createEvent(event, this.publicKey);
    return createSignedEvent(unsignedEvent, this.privateKey);
  }
}
