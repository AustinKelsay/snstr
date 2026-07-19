import { Relay } from "../../src/nip01/relay";
import { createEvent, createSignedEvent } from "../../src/nip01/event";
import { NostrEvent, RelayEvent } from "../../src/types/nostr";
import { getRelaySocket, NostrRelay } from "../../src/testing";
import { getPublicKey } from "../../src/utils/crypto";

const PRIVATE_KEY = "1".repeat(64);

async function createRelayEvent(content: string): Promise<NostrEvent> {
  return createSignedEvent(
    createEvent(
      {
        kind: 1,
        tags: [],
        content,
        created_at: Math.floor(Date.now() / 1000),
      },
      getPublicKey(PRIVATE_KEY),
    ),
    PRIVATE_KEY,
  );
}

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timeout = setTimeout(() => reject(new Error(message)), 1000);
      timeout.unref?.();
    }),
  ]);
}

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

  test("routes successful REQ, EOSE, EVENT, and CLOSE messages", async () => {
    const server = new NostrRelay(0);
    let publisher: Relay | null = null;
    let subscriber: Relay | null = null;

    try {
      await server.start();
      publisher = new Relay(server.url, {
        autoReconnect: false,
        connectionTimeout: 1000,
      });
      subscriber = new Relay(server.url, {
        autoReconnect: false,
        connectionTimeout: 1000,
      });
      expect(await publisher.connect()).toBe(true);
      expect(await subscriber.connect()).toBe(true);

      let resolveEvent!: (event: NostrEvent) => void;
      let resolveEose!: () => void;
      const receivedEvent = new Promise<NostrEvent>((resolve) => {
        resolveEvent = resolve;
      });
      const receivedEose = new Promise<void>((resolve) => {
        resolveEose = resolve;
      });
      const subscriptionId = subscriber.subscribe(
        [{ kinds: [1] }],
        resolveEvent,
        resolveEose,
      );

      await withTimeout(receivedEose, "Timed out waiting for EOSE");
      const event = await createRelayEvent("session owner happy path");
      await expect(
        publisher.publish(event, { timeout: 1000 }),
      ).resolves.toMatchObject({ success: true });
      await expect(
        withTimeout(receivedEvent, "Timed out waiting for EVENT"),
      ).resolves.toMatchObject({ id: event.id });

      subscriber.unsubscribe(subscriptionId);
    } finally {
      publisher?.disconnect();
      subscriber?.disconnect();
      await server.close();
    }
  });
});
