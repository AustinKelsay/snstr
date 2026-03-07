import {
  decrypt as decryptNIP04,
  encrypt as encryptNIP04,
} from "../nip04/web";
import type { EventTemplate, NostrEvent } from "../types/nostr";
import { LocalKeySignerBase } from "./local-base";

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
  private readonly base: LocalKeySignerBase;

  readonly nip04;
  readonly nip44;

  constructor(privateKey: string) {
    this.base = new LocalKeySignerBase(privateKey, {
      encrypt: encryptNIP04,
      decrypt: decryptNIP04,
    });
    this.nip04 = this.base.nip04;
    this.nip44 = this.base.nip44;
  }

  async getPublicKey(): Promise<string> {
    return this.base.getPublicKey();
  }

  async signEvent(event: EventTemplate): Promise<NostrEvent> {
    return this.base.signEvent(event);
  }
}
