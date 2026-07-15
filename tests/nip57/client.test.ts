import {
  Filter,
  createEvent,
  createZapRequest,
  getPublicKey,
  Nostr,
  NostrEvent,
  NostrZapClient,
  SubscriptionOptions,
  ZapClient,
} from "../../src";
import { createSignedEvent } from "../../src/nip01/event";
import { NostrRelay } from "../../src/utils/ephemeral-relay";
import type { DiagnosticLogger } from "../../src/utils/logger";

function createDiagnosticLogger(): DiagnosticLogger & {
  error: jest.Mock;
  warn: jest.Mock;
} {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
  };
}

class ScriptedNostr extends Nostr {
  public returnedSubscriptionIds: unknown = ["relay-one", "relay-two"];
  public readonly activeSubscriptionIds = new Set<string>();
  public readonly releasedSubscriptionIds: string[][] = [];
  public subscribeError: Error | null = null;
  public readonly unsubscribeErrors = new Map<string, Error>();
  public reachesEoseSynchronously = false;

  private eventCallback: ((event: NostrEvent, relay: string) => void) | null =
    null;
  private eoseCallback: (() => void) | null = null;

  override subscribe(
    _filters: Filter[],
    onEvent: (event: NostrEvent, relay: string) => void,
    onEOSE?: () => void,
    _options: SubscriptionOptions = {},
  ): string[] {
    if (this.subscribeError) throw this.subscribeError;

    this.eventCallback = onEvent;
    this.eoseCallback = onEOSE ?? null;
    if (Array.isArray(this.returnedSubscriptionIds)) {
      for (const subscriptionId of this.returnedSubscriptionIds) {
        if (typeof subscriptionId === "string") {
          this.activeSubscriptionIds.add(subscriptionId);
        }
      }
    }
    if (this.reachesEoseSynchronously) this.eoseCallback?.();

    return this.returnedSubscriptionIds as string[];
  }

  override unsubscribe(subscriptionIds: string[]): void {
    this.releasedSubscriptionIds.push([...subscriptionIds]);
    for (const subscriptionId of subscriptionIds) {
      const error = this.unsubscribeErrors.get(subscriptionId);
      if (error) throw error;
      this.activeSubscriptionIds.delete(subscriptionId);
    }
  }

  emitEvent(event: NostrEvent): void {
    this.eventCallback?.(event, "wss://scripted-relay.test");
  }

  emitEOSE(): void {
    this.eoseCallback?.();
  }
}

const RECEIPT: NostrEvent = {
  id: "1".repeat(64),
  pubkey: "2".repeat(64),
  created_at: 1,
  kind: 9735,
  tags: [],
  content: "",
  sig: "3".repeat(128),
};

async function advanceFakeTimersByTime(milliseconds: number): Promise<void> {
  await Promise.resolve();
  jest.advanceTimersByTime(milliseconds);
  await Promise.resolve();
}

describe("NIP-57 public clients", () => {
  describe("NostrZapClient", () => {
    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    test("releases every Relay subscription when receipt collection times out", async () => {
      jest.useFakeTimers();
      const relayUrls = ["ws://127.0.0.1:45101", "ws://127.0.0.1:45102"];
      const nostr = new Nostr(relayUrls, {
        relayOptions: { autoReconnect: false },
      });
      const client = new NostrZapClient({ client: nostr });

      const collection = client.fetchZapReceipts();

      expect(
        relayUrls.map(
          (relayUrl) => nostr.getRelay(relayUrl)?.getSubscriptionIds().size,
        ),
      ).toEqual([1, 1]);

      await advanceFakeTimersByTime(10000);

      await expect(collection).resolves.toEqual([]);
      expect(
        relayUrls.map(
          (relayUrl) => nostr.getRelay(relayUrl)?.getSubscriptionIds().size,
        ),
      ).toEqual([0, 0]);
      expect(jest.getTimerCount()).toBe(0);
    });

    test("releases its timeout when a Relay reaches end of stored events", async () => {
      const globals = globalThis as typeof globalThis & { Bun?: unknown };
      const isBun = typeof globals.Bun !== "undefined";
      const hadBun = Object.prototype.hasOwnProperty.call(globals, "Bun");
      const previousBun = globals.Bun;
      if (!isBun) globals.Bun = {};
      const relay = new NostrRelay(0);
      await relay.start();
      const nostr = new Nostr([relay.url], {
        relayOptions: { autoReconnect: false },
      });

      try {
        await nostr.connectToRelays();
        jest.useFakeTimers();
        const client = new NostrZapClient({ client: nostr });

        const collection = client.fetchZapReceipts();
        await advanceFakeTimersByTime(0);

        await expect(collection).resolves.toEqual([]);
        expect(nostr.getRelay(relay.url)?.getSubscriptionIds().size).toBe(0);
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        jest.useRealTimers();
        nostr.disconnectFromRelays();
        await relay.close();
        if (!isBun) {
          if (hadBun) globals.Bun = previousBun;
          else delete globals.Bun;
        }
      }
    });

    test("collects stored receipts through every public receipt query", async () => {
      const globals = globalThis as typeof globalThis & { Bun?: unknown };
      const isBun = typeof globals.Bun !== "undefined";
      const hadBun = Object.prototype.hasOwnProperty.call(globals, "Bun");
      const previousBun = globals.Bun;
      if (!isBun) globals.Bun = {};
      const relay = new NostrRelay(0);
      await relay.start();
      const nostr = new Nostr([relay.url], {
        relayOptions: { autoReconnect: false },
      });
      const privateKey = "1".repeat(64);
      const recipient = "5".repeat(64);
      const zappedEventId = "6".repeat(64);
      const sender = "7".repeat(64);
      const receipt = await createSignedEvent(
        createEvent(
          {
            kind: 9735,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
              ["p", recipient],
              ["e", zappedEventId],
              ["description", JSON.stringify({ pubkey: sender })],
            ],
            content: "",
          },
          getPublicKey(privateKey),
        ),
        privateKey,
      );

      try {
        await nostr.connectToRelays();
        await expect(
          nostr.publishEvent(receipt, { timeout: 1000 }),
        ).resolves.toMatchObject({ success: true });
        const client = new NostrZapClient({ client: nostr });

        await expect(client.fetchUserReceivedZaps(recipient)).resolves.toEqual([
          receipt,
        ]);
        await expect(client.fetchEventZaps(zappedEventId)).resolves.toEqual([
          receipt,
        ]);
        await expect(
          client.fetchZapReceipts({
            authors: [receipt.pubkey],
            events: [zappedEventId],
          }),
        ).resolves.toEqual([receipt]);
        await expect(client.fetchUserSentZaps(sender)).resolves.toEqual([
          receipt,
        ]);
        expect(nostr.getRelay(relay.url)?.getSubscriptionIds().size).toBe(0);
      } finally {
        nostr.disconnectFromRelays();
        await relay.close();
        if (!isBun) {
          if (hadBun) globals.Bun = previousBun;
          else delete globals.Bun;
        }
      }
    });

    test("releases IDs returned after a synchronous end-of-stored-events callback", async () => {
      jest.useFakeTimers();
      const nostr = new ScriptedNostr();
      nostr.reachesEoseSynchronously = true;
      const client = new NostrZapClient({ client: nostr });

      await expect(client.fetchZapReceipts()).resolves.toEqual([]);

      expect(nostr.activeSubscriptionIds.size).toBe(0);
      expect(nostr.releasedSubscriptionIds).toEqual([
        ["relay-one"],
        ["relay-two"],
      ]);
      expect(jest.getTimerCount()).toBe(0);
    });

    test("ignores late events and duplicate terminal signals after settling once", async () => {
      jest.useFakeTimers();
      const nostr = new ScriptedNostr();
      const client = new NostrZapClient({ client: nostr });

      const collection = client.fetchZapReceipts();
      nostr.emitEvent(RECEIPT);
      nostr.emitEOSE();
      nostr.emitEOSE();
      await expect(collection).resolves.toEqual([RECEIPT]);

      nostr.emitEvent({ ...RECEIPT, id: "4".repeat(64) });
      await advanceFakeTimersByTime(10000);

      await expect(collection).resolves.toEqual([RECEIPT]);
      expect(nostr.releasedSubscriptionIds).toEqual([
        ["relay-one"],
        ["relay-two"],
      ]);
      expect(nostr.activeSubscriptionIds.size).toBe(0);
      expect(jest.getTimerCount()).toBe(0);
    });

    test("rejects a subscribe error without creating a timeout", async () => {
      jest.useFakeTimers();
      const nostr = new ScriptedNostr();
      nostr.subscribeError = new Error("Relay subscription failed");
      const client = new NostrZapClient({ client: nostr });

      await expect(client.fetchZapReceipts()).rejects.toThrow(
        "Relay subscription failed",
      );
      expect(nostr.activeSubscriptionIds.size).toBe(0);
      expect(nostr.releasedSubscriptionIds).toEqual([]);
      expect(jest.getTimerCount()).toBe(0);
    });

    test("settles and attempts every ID when one Relay cleanup throws", async () => {
      jest.useFakeTimers();
      const logger = createDiagnosticLogger();
      const nostr = new ScriptedNostr();
      const cleanupError = new Error("malformed CLOSE transport");
      nostr.unsubscribeErrors.set("relay-one", cleanupError);
      const client = new NostrZapClient({ client: nostr, logger });
      const collection = client.fetchZapReceipts();

      expect(() => nostr.emitEOSE()).not.toThrow();
      await expect(collection).resolves.toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        "Failed to release NIP-57 Relay subscriptions",
        {
          error: cleanupError,
          subscriptionIds: ["relay-one"],
        },
      );
      expect(nostr.releasedSubscriptionIds).toEqual([
        ["relay-one"],
        ["relay-two"],
      ]);
      expect(nostr.activeSubscriptionIds).toEqual(new Set(["relay-one"]));
      expect(jest.getTimerCount()).toBe(0);
    });

    test("rejects malformed subscription IDs without leaving a timeout", async () => {
      jest.useFakeTimers();
      const nostr = new ScriptedNostr();
      nostr.returnedSubscriptionIds = ["relay-one", null, "relay-two"];
      const client = new NostrZapClient({ client: nostr });

      await expect(client.fetchZapReceipts()).rejects.toThrow(TypeError);
      expect(nostr.activeSubscriptionIds.size).toBe(0);
      expect(nostr.releasedSubscriptionIds).toEqual([
        ["relay-one"],
        ["relay-two"],
      ]);
      expect(jest.getTimerCount()).toBe(0);
    });

    test("keeps malformed invoice validation quiet or routes it to the injected logger", async () => {
      const privateKey = "b".repeat(64);
      const recipient = "c".repeat(64);
      const provider = "d".repeat(64);
      const requestTemplate = createZapRequest(
        {
          recipientPubkey: recipient,
          relays: ["wss://relay.test"],
          amount: 1_000,
        },
        getPublicKey(privateKey),
      );
      const request = await createSignedEvent(
        {
          ...requestTemplate,
          pubkey: getPublicKey(privateKey),
          created_at: 1,
          tags: requestTemplate.tags ?? [],
        },
        privateKey,
      );
      const malformedReceipt: NostrEvent = {
        ...RECEIPT,
        pubkey: provider,
        tags: [
          ["bolt11", "not-an-invoice"],
          ["description", JSON.stringify(request)],
          ["p", recipient],
        ],
      };
      const consoleError = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(
        new NostrZapClient({ client: new Nostr() }).validateZapReceipt(
          malformedReceipt,
          provider,
        ),
      ).toMatchObject({ valid: false });
      expect(consoleError).not.toHaveBeenCalled();

      const logger = createDiagnosticLogger();
      const diagnosticNostrClient = new NostrZapClient({
        client: new Nostr(),
        logger,
      });
      const diagnosticZapClient = new ZapClient({
        nostrClient: new Nostr(),
        logger,
      });
      expect(
        diagnosticNostrClient.validateZapReceipt(malformedReceipt, provider),
      ).toMatchObject({ valid: false });
      expect(
        diagnosticZapClient.validateZapReceipt(malformedReceipt, provider),
      ).toMatchObject({ valid: false });
      expect(logger.error).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to parse bolt11 invoice",
        { error: expect.anything() },
      );
    });
  });

  describe("ZapClient", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    test("is quiet by default and routes LNURL failures to an injected diagnostic logger", async () => {
      const fetchError = new Error("LNURL endpoint unavailable");
      jest.spyOn(globalThis, "fetch").mockRejectedValue(fetchError);
      const consoleError = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const nostr = new Nostr();

      const quietClient = new ZapClient({ nostrClient: nostr });
      await expect(
        quietClient.canReceiveZaps("quiet-user", "https://lnurl.test/quiet"),
      ).resolves.toBe(false);
      expect(consoleError).not.toHaveBeenCalled();

      const logger = createDiagnosticLogger();
      const diagnosticClient = new ZapClient({ nostrClient: nostr, logger });
      await expect(
        diagnosticClient.canReceiveZaps(
          "diagnostic-user",
          "https://lnurl.test/diagnostic",
        ),
      ).resolves.toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to fetch LNURL metadata",
        { error: fetchError },
      );
    });

    test("preserves fallback behavior when an injected diagnostic logger throws", async () => {
      jest
        .spyOn(globalThis, "fetch")
        .mockRejectedValue(new Error("LNURL endpoint unavailable"));
      const logger = createDiagnosticLogger();
      logger.error.mockImplementation(() => {
        throw new Error("logger unavailable");
      });
      const client = new ZapClient({ nostrClient: new Nostr(), logger });

      await expect(
        client.canReceiveZaps("quiet-user", "https://lnurl.test/quiet"),
      ).resolves.toBe(false);
    });

    test("returns an invoice error and diagnostic when the LNURL callback fails", async () => {
      const callbackError = new Error("invoice callback unavailable");
      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          json: jest.fn().mockResolvedValue({
            callback: "https://lnurl.test/callback",
            maxSendable: 10_000,
            minSendable: 1,
            metadata: "[]",
            tag: "payRequest",
            allowsNostr: true,
            nostrPubkey: "8".repeat(64),
          }),
        } as unknown as Response)
        .mockRejectedValueOnce(callbackError);
      const privateKey = "9".repeat(64);
      const nostr = new Nostr();
      nostr.setPrivateKey(privateKey);
      const logger = createDiagnosticLogger();
      const client = new ZapClient({ nostrClient: nostr, logger });

      await expect(
        client.getZapInvoice(
          {
            recipientPubkey: "a".repeat(64),
            lnurl: "https://lnurl.test/metadata",
            amount: 1_000,
          },
          privateKey,
        ),
      ).resolves.toMatchObject({
        invoice: "",
        error: "Error: invoice callback unavailable",
      });
      expect(logger.error).toHaveBeenCalledWith("Failed to get zap invoice", {
        error: callbackError,
      });
    });
  });
});
