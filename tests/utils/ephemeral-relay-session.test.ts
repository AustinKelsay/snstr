import { Relay } from "../../src/nip01/relay";
import { RelayEvent } from "../../src/types/nostr";
import { getRelaySocket, NostrRelay } from "../../src/testing";

function sendAndReceiveNotice(relay: Relay, message: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Timed out waiting for Relay NOTICE")),
      1000,
    );
    const handler = (_relayUrl: string, notice: string) => {
      clearTimeout(timeout);
      relay.off(RelayEvent.Notice, handler);
      resolve(notice);
    };
    relay.on(RelayEvent.Notice, handler);

    const socket = getRelaySocket(relay);
    if (!socket) {
      clearTimeout(timeout);
      relay.off(RelayEvent.Notice, handler);
      reject(new Error("Relay socket is not connected"));
      return;
    }
    socket.send(message);
  });
}

describe("ephemeral Relay client session", () => {
  test("keeps malformed protocol handling compatible", async () => {
    const server = new NostrRelay(0);
    let client: Relay | null = null;

    try {
      await server.start();
      client = new Relay(server.url, {
        autoReconnect: false,
        connectionTimeout: 1000,
      });
      expect(await client.connect()).toBe(true);

      await expect(
        sendAndReceiveNotice(client, JSON.stringify(["EVENT"])),
      ).resolves.toBe("invalid: EVENT message missing params");
      await expect(
        sendAndReceiveNotice(client, JSON.stringify(["CLOSE"])),
      ).resolves.toBe("invalid: CLOSE message missing params");
      await expect(sendAndReceiveNotice(client, "not-json")).resolves.toBe(
        "Unable to parse message",
      );
    } finally {
      client?.disconnect();
      await server.close();
    }
  });
});
