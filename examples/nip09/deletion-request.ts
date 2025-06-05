/**
 * NIP-09 Deletion Request Example
 *
 * Demonstrates creating a deletion request for a note and
 * verifying the relationship.
 */

import { generateKeypair } from "../../src";
import { createTextNote, createSignedEvent } from "../../src/nip01/event";
import {
  createDeletionRequest,
  parseDeletionTargets,
  isDeletionRequestForEvent,
} from "../../src/nip09";

async function main() {
  const keys = await generateKeypair();

  const noteTemplate = createTextNote("Hello, world", keys.privateKey);
  const note = await createSignedEvent(noteTemplate, keys.privateKey);

  const delTemplate = createDeletionRequest(
    { ids: [note.id], kinds: [note.kind], content: "posted by mistake" },
    keys.publicKey,
  );
  const delEvent = await createSignedEvent(delTemplate, keys.privateKey);

  console.log("Deletion event:", delEvent);

  const targets = parseDeletionTargets(delEvent);
  console.log("Parsed targets:", targets);

  console.log("Applies to note:", isDeletionRequestForEvent(delEvent, note));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
