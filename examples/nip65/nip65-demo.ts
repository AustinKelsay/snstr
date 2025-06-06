import {
  createRelayListEvent,
  parseRelayList,
  getReadRelays,
  getWriteRelays,
  RelayListEvent,
} from "../../src/nip65";
import { generateKeypair } from "../../src/utils/crypto";
import { createSignedEvent } from "../../src/nip01/event";

async function main() {
  const keys = await generateKeypair();

  const template = createRelayListEvent([
    { url: "wss://relay1.example.com", read: true, write: true },
    { url: "wss://read.example.com", read: true, write: false },
    { url: "wss://write.example.com", read: false, write: true },
  ]);

  const unsigned = { ...template, pubkey: keys.publicKey };
  const event = (await createSignedEvent(
    unsigned,
    keys.privateKey,
  )) as RelayListEvent;

  console.log("Relay list event", event);
  const entries = parseRelayList(event);
  console.log("Read relays:", getReadRelays(entries));
  console.log("Write relays:", getWriteRelays(entries));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
