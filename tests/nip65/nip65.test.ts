import {
  createRelayListEvent,
  parseRelayList,
  getReadRelays,
  getWriteRelays,
  RelayListEvent,
} from "../../src/nip65";
import { generateKeypair } from "../../src/utils/crypto";
import { createSignedEvent } from "../../src/nip01/event";

describe("NIP-65", () => {
  test("createRelayListEvent builds correct tags", () => {
    const template = createRelayListEvent([
      { url: "wss://a", read: true, write: true },
      { url: "wss://b", read: false, write: true },
      { url: "wss://c", read: true, write: false },
    ]);

    expect(template.kind).toBe(10002);
    expect(template.tags).toEqual([
      ["r", "wss://a"],
      ["r", "wss://b", "write"],
      ["r", "wss://c", "read"],
    ]);
  });

  test("parseRelayList and helper getters", async () => {
    const entries = [
      { url: "wss://a", read: true, write: true },
      { url: "wss://b", read: false, write: true },
      { url: "wss://c", read: true, write: false },
    ];
    const keys = await generateKeypair();
    const unsigned = {
      ...createRelayListEvent(entries),
      pubkey: keys.publicKey,
    };
    const event = (await createSignedEvent(
      unsigned,
      keys.privateKey,
    )) as RelayListEvent;

    const parsed = parseRelayList(event);
    expect(parsed).toEqual(entries);
    expect(getWriteRelays(parsed)).toEqual(["wss://a", "wss://b"]);
    expect(getReadRelays(parsed)).toEqual(["wss://a", "wss://c"]);
  });
});
