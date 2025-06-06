import { encodePublicKey, Prefix } from "../../src/nip19";
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
    expect(() => encodeNostrURI("nsec1deadbeef" as any)).toThrow(/nsec/);
  });

  test("decodeNostrURI rejects invalid prefix", () => {
    expect(() => decodeNostrURI("http://example.com")).toThrow(/nostr URI/);
  });
});
