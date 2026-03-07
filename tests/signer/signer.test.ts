import { verifySignature, generateKeypair } from "../../src/utils/crypto";
import {
  LocalKeySigner,
  Nip07Signer,
  Nip46Signer,
  getSignerCapabilities,
} from "../../src/signer";

describe("Signer utilities", () => {
  const globalWithWindow = global as typeof globalThis & { window?: unknown };
  const originalWindow = globalWithWindow.window;

  afterEach(() => {
    globalWithWindow.window = originalWindow;
  });

  test("LocalKeySigner signs events and exposes NIP-04/NIP-44 support", async () => {
    const alice = await generateKeypair();
    const bob = await generateKeypair();
    const signer = new LocalKeySigner(alice.privateKey);

    const signedEvent = await signer.signEvent({
      kind: 1,
      content: "hello",
      tags: [["t", "flotilla"]],
    });

    expect(signedEvent.pubkey).toBe(alice.publicKey);
    await expect(
      verifySignature(signedEvent.id, signedEvent.sig, signedEvent.pubkey),
    ).resolves.toBe(true);
    expect(getSignerCapabilities(signer)).toEqual({
      supportsNip04: true,
      supportsNip44: true,
    });

    const ciphertext04 = await signer.nip04.encrypt(bob.publicKey, "secret");
    const bobSigner = new LocalKeySigner(bob.privateKey);
    await expect(bobSigner.nip04.decrypt(alice.publicKey, ciphertext04)).resolves
      .toBe("secret");

    const ciphertext44 = await signer.nip44.encrypt(bob.publicKey, "secret-44");
    await expect(bobSigner.nip44.decrypt(alice.publicKey, ciphertext44)).resolves
      .toBe("secret-44");
  });

  test("Nip07Signer uses the extension surface and detects capabilities", async () => {
    globalWithWindow.window = {
      nostr: {
        getPublicKey: jest.fn().mockResolvedValue("pubkey-from-extension"),
        signEvent: jest.fn().mockImplementation(async (event) => ({
          ...event,
          id: "event-id",
          pubkey: "pubkey-from-extension",
          sig: "signature",
          tags: event.tags || [],
        })),
        nip04: {
          encrypt: jest.fn().mockResolvedValue("nip04-ciphertext"),
          decrypt: jest.fn().mockResolvedValue("nip04-plaintext"),
        },
      },
    } as unknown as Window & typeof globalThis;

    const signer = new Nip07Signer();

    await expect(signer.getPublicKey()).resolves.toBe("pubkey-from-extension");
    await expect(
      signer.signEvent({
        kind: 1,
        content: "hello from extension",
      }),
    ).resolves.toMatchObject({
      pubkey: "pubkey-from-extension",
      content: "hello from extension",
    });

    expect(getSignerCapabilities(signer)).toEqual({
      supportsNip04: true,
      supportsNip44: false,
    });
  });

  test("Nip46Signer reflects remote signer capabilities", async () => {
    const signer = new Nip46Signer({
      getPublicKey: jest.fn().mockResolvedValue("remote-pubkey"),
      signEvent: jest.fn().mockImplementation(async (event) => ({
        ...event,
        id: "remote-id",
        pubkey: "remote-pubkey",
        sig: "remote-sig",
        tags: event.tags || [],
      })),
      nip44Encrypt: jest.fn().mockResolvedValue("ciphertext"),
      nip44Decrypt: jest.fn().mockResolvedValue("plaintext"),
    });

    expect(getSignerCapabilities(signer)).toEqual({
      supportsNip04: false,
      supportsNip44: true,
    });

    await expect(signer.getPublicKey()).resolves.toBe("remote-pubkey");
    await expect(
      signer.signEvent({
        kind: 1,
        content: "remote note",
      }),
    ).resolves.toMatchObject({
      pubkey: "remote-pubkey",
      content: "remote note",
    });
  });
});
