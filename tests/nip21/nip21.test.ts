import { encodePublicKey, Prefix, encodePrivateKey } from "../../src/nip19";
import { encodeNostrURI, decodeNostrURI } from "../../src/nip21";

describe("NIP-21: nostr URI scheme", () => {
  test("encodeNostrURI builds the correct URI", () => {
    const pubkey =
      "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d";
    const npub = encodePublicKey(pubkey);
    const uri = encodeNostrURI(npub);
    expect(uri).toBe(`nostr:${npub}`);
  });

  test("decodeNostrURI parses and decodes", () => {
    const pubkey =
      "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d";
    const npub = encodePublicKey(pubkey);
    const decoded = decodeNostrURI(`nostr:${npub}`);
    expect(decoded.type).toBe(Prefix.PublicKey);
    expect(decoded.data).toBe(pubkey);
  });

  test("encodeNostrURI rejects nsec", () => {
    // Create a proper nsec using a valid private key to test rejection
    const privateKey =
      "d55f1f2d59c62fb6fa5b1d88adf3e9aad291d63f9d0fcef6b5c8139a400f3dd6";
    const nsec = encodePrivateKey(privateKey);
    expect(() => encodeNostrURI(nsec)).toThrow(/nsec/);
  });

  test("decodeNostrURI rejects invalid prefix", () => {
    expect(() => decodeNostrURI("http://example.com")).toThrow(/nostr URI/);
  });
});
