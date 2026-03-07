import { createEvent, createSignedEvent } from "../nip01/event";
import { decrypt as decryptNIP44, encrypt as encryptNIP44 } from "../nip44";
import { getPublicKey } from "../utils/crypto";
import type { EventTemplate, NostrEvent } from "../types/nostr";
import type { SignerEncryption } from "./types";

interface Nip04Implementation {
  encrypt(
    privateKey: string,
    pubkey: string,
    plaintext: string,
  ): string | Promise<string>;
  decrypt(
    privateKey: string,
    pubkey: string,
    ciphertext: string,
  ): string | Promise<string>;
}

export class LocalKeySignerBase {
  private readonly publicKey: string;

  readonly nip04: SignerEncryption;
  readonly nip44: SignerEncryption;

  constructor(
    private readonly privateKey: string,
    nip04Implementation: Nip04Implementation,
  ) {
    this.publicKey = getPublicKey(privateKey);

    this.nip04 = {
      encrypt: async (pubkey, plaintext) =>
        nip04Implementation.encrypt(this.privateKey, pubkey, plaintext),
      decrypt: async (pubkey, ciphertext) =>
        nip04Implementation.decrypt(this.privateKey, pubkey, ciphertext),
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
