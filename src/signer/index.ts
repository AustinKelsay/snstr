import { decrypt as decryptNIP04, encrypt as encryptNIP04 } from "../nip04";
import type { EventTemplate, NostrEvent } from "../types/nostr";
import { LocalKeySignerBase } from "./local-base";
import type { SignerEncryption } from "./types";
import { validatePrivateKey } from "../utils/security-validator";

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

  readonly nip04: SignerEncryption;
  readonly nip44: SignerEncryption;

  constructor(privateKey: string) {
    const validatedPrivateKey = validatePrivateKey(privateKey);
    this.base = new LocalKeySignerBase(validatedPrivateKey, {
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
