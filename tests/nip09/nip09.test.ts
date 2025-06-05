import { generateKeypair } from "../../src/utils/crypto";
import { createSignedEvent, createTextNote } from "../../src/nip01/event";
import {
  createDeletionRequest,
  parseDeletionTargets,
  isDeletionRequestForEvent,
} from "../../src/nip09";
import { NostrKind, NostrEvent } from "../../src/types/nostr";

describe("NIP-09", () => {
  let keypair: { privateKey: string; publicKey: string };
  let note: NostrEvent;

  beforeAll(async () => {
    keypair = await generateKeypair();
    const template = createTextNote("hello", keypair.privateKey);
    note = await createSignedEvent(template, keypair.privateKey);
  });

  test("createDeletionRequest builds correct tags", () => {
    const del = createDeletionRequest(
      {
        ids: [note.id],
        kinds: [note.kind],
        addresses: ["1:" + note.pubkey + ":d"],
      },
      keypair.publicKey,
    );
    expect(del.kind).toBe(NostrKind.Deletion);
    expect(del.tags).toContainEqual(["e", note.id]);
    expect(del.tags).toContainEqual(["a", "1:" + note.pubkey + ":d"]);
    expect(del.tags).toContainEqual(["k", note.kind.toString()]);
  });

  test("parseDeletionTargets extracts ids, addresses and kinds", () => {
    const del = createDeletionRequest(
      { ids: [note.id], addresses: ["1:" + note.pubkey + ":d"], kinds: [1] },
      keypair.publicKey,
    );
    const delEvent = { ...del, id: "x", sig: "y" } as NostrEvent;
    const parsed = parseDeletionTargets(delEvent);
    expect(parsed.ids).toEqual([note.id]);
    expect(parsed.addresses).toEqual(["1:" + note.pubkey + ":d"]);
    expect(parsed.kinds).toEqual([1]);
  });

  test("isDeletionRequestForEvent matches event correctly", async () => {
    const delTemplate = createDeletionRequest(
      { ids: [note.id] },
      keypair.publicKey,
    );
    const delEvent = await createSignedEvent(delTemplate, keypair.privateKey);
    expect(isDeletionRequestForEvent(delEvent, note)).toBe(true);

    const otherKey = await generateKeypair();
    const otherTemplate = createTextNote("no", otherKey.privateKey);
    const otherEvent = await createSignedEvent(
      otherTemplate,
      otherKey.privateKey,
    );
    expect(isDeletionRequestForEvent(delEvent, otherEvent)).toBe(false);
  });
});
