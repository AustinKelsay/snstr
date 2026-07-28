import { NostrRelay } from "../../src/testing";

let relay: NostrRelay | null = null;

export async function startEphemeralRelay(port = 0): Promise<string> {
  relay = new NostrRelay(port);
  await relay.start();
  return relay.url;
}

export async function stopEphemeralRelay(): Promise<void> {
  const activeRelay = relay;
  relay = null;
  await activeRelay?.close();
}
