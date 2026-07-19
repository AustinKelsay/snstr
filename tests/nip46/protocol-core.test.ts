import { getPublicKey } from "../../src/utils/crypto";
import { NIP46RequestCorrelator } from "../../src/nip46/internal/request-correlator";
import { NIP46ClientEngine } from "../../src/nip46/internal/client-engine";
import { NIP46Wire } from "../../src/nip46/internal/wire";
import { NIP46DiagnosticLogger } from "../../src/nip46/utils/diagnostics";
import {
  NIP46ConnectionError,
  NIP46Method,
  NIP46Request,
  NIP46Response,
  NIP46TimeoutError,
} from "../../src/nip46/types";

async function captureRejection(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
    return new Error("Expected promise to reject");
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

function createTestClientEngine(): NIP46ClientEngine {
  const logger = new NIP46DiagnosticLogger({
    error: () => undefined,
    warn: () => undefined,
    info: () => undefined,
    debug: () => undefined,
    trace: () => undefined,
  });
  return new NIP46ClientEngine({
    relays: [],
    timeout: 1000,
    logger,
    relayStrategy: "add",
    parseBeforeInitialConnect: true,
    regenerateKeysOnConnect: false,
    filterResponsesBySigner: true,
    rejectProtocolErrors: false,
    requireConnectedForRequests: true,
    inspectPublishResult: false,
    connectDelayMs: 0,
    disconnectDelayMs: 0,
    buildConnectParams: () => [],
    timeoutError: () => new NIP46TimeoutError("timeout"),
    disconnectError: () => new NIP46ConnectionError("disconnected"),
    wrapPublishError: () => new NIP46ConnectionError("publish failed"),
  });
}

describe("NIP-46 protocol core", () => {
  const sender = {
    privateKey: "11".repeat(32),
    publicKey: getPublicKey("11".repeat(32)),
  };
  const recipient = {
    privateKey: "22".repeat(32),
    publicKey: getPublicKey("22".repeat(32)),
  };

  test("rejects duplicate pending request IDs without replacing the owner", async () => {
    const correlator = new NIP46RequestCorrelator();
    const first = correlator.register("duplicate", 1000, () => new Error());
    const firstOutcome = captureRejection(first);

    const duplicateError = await captureRejection(
      correlator.register("duplicate", 1000, () => new Error()),
    );
    expect(duplicateError.message).toContain("already pending");
    expect(correlator.pending.size).toBe(1);

    correlator.reject("duplicate", new Error("cleanup"));
    expect((await firstOutcome).message).toBe("cleanup");
    expect(correlator.pending.size).toBe(0);
  });

  test("removes a pending request when its timeout settles", async () => {
    const correlator = new NIP46RequestCorrelator();
    const request = correlator.register(
      "timeout",
      5,
      () => new Error("expected timeout"),
    );

    expect((await captureRejection(request)).message).toBe("expected timeout");
    expect(correlator.pending.size).toBe(0);
  });

  test("settles and removes a matching pending request", async () => {
    const correlator = new NIP46RequestCorrelator();
    const response: NIP46Response = {
      id: "settle-me",
      result: "ok",
    };
    const request = correlator.register("settle-me", 1000, () => new Error());

    expect(correlator.settle(response)).toBe(true);
    await expect(request).resolves.toEqual(response);
    expect(correlator.pending.size).toBe(0);
  });

  test("cancels and removes every pending request", async () => {
    const correlator = new NIP46RequestCorrelator();
    const first = correlator.register("first", 1000, () => new Error());
    const second = correlator.register("second", 1000, () => new Error());
    const outcomes = [captureRejection(first), captureRejection(second)];

    correlator.cancelAll(new Error("expected cancellation"));
    for (const error of await Promise.all(outcomes)) {
      expect(error.message).toBe("expected cancellation");
    }
    expect(correlator.pending.size).toBe(0);
  });

  test("accepts well-shaped extension methods and rejects malformed envelopes", async () => {
    const extensionRequest: NIP46Request = {
      id: "extension-request",
      method: "future_method" as NIP46Method,
      params: [],
    };
    const requestEvent = await NIP46Wire.createRequestEvent(
      extensionRequest,
      sender,
      recipient.publicKey,
    );
    expect(
      NIP46Wire.decryptRequest(requestEvent, recipient.privateKey),
    ).toEqual(extensionRequest);

    const malformedRequestEvent = await NIP46Wire.createRequestEvent(
      null as unknown as NIP46Request,
      sender,
      recipient.publicKey,
    );
    expect(() =>
      NIP46Wire.decryptRequest(malformedRequestEvent, recipient.privateKey),
    ).toThrow("Invalid NIP-46 request");

    const malformedResponseEvent = await NIP46Wire.createResponseEvent(
      "not-an-envelope" as unknown as NIP46Response,
      sender,
      recipient.publicKey,
    );
    expect(() =>
      NIP46Wire.decryptResponse(malformedResponseEvent, recipient.privateKey),
    ).toThrow("Invalid NIP-46 response");
  });

  test("serializes client connect and disconnect transitions", async () => {
    const events: string[] = [];
    const engine = createTestClientEngine();
    const engineInternals = engine as unknown as {
      clientKeypair: typeof sender;
      prepareConnection: () => Promise<void>;
      setupSubscription: () => Promise<void>;
      cleanup: () => Promise<void>;
    };
    engineInternals.clientKeypair = sender;

    let releaseConnection!: () => void;
    const connectionGate = new Promise<void>((resolve) => {
      releaseConnection = resolve;
    });
    let connectionEntered!: () => void;
    const entered = new Promise<void>((resolve) => {
      connectionEntered = resolve;
    });
    engineInternals.prepareConnection = jest.fn(async () => {
      events.push("connect-start");
      connectionEntered();
      await connectionGate;
    });
    engineInternals.setupSubscription = jest.fn(async () => undefined);
    engineInternals.cleanup = jest.fn(async () => {
      events.push("cleanup");
    });
    jest.spyOn(engine, "request").mockImplementation(async (method) => {
      events.push(method);
      return { id: method, result: "ack" };
    });

    const connecting = engine.connect(`bunker://${recipient.publicKey}`);
    await entered;
    const disconnecting = engine.disconnect();
    await Promise.resolve();
    const eventsBeforeRelease = [...events];
    releaseConnection();
    await Promise.all([connecting, disconnecting]);

    expect(eventsBeforeRelease).toEqual(["connect-start"]);
    expect(events).toEqual([
      "connect-start",
      NIP46Method.CONNECT,
      NIP46Method.DISCONNECT,
      "cleanup",
    ]);
  });

  test("finishes failed-connect cleanup before a queued disconnect", async () => {
    const events: string[] = [];
    const engine = createTestClientEngine();
    const engineInternals = engine as unknown as {
      clientKeypair: typeof sender;
      prepareConnection: () => Promise<void>;
      cleanup: () => Promise<void>;
    };
    engineInternals.clientKeypair = sender;
    engineInternals.prepareConnection = jest.fn(async () => {
      events.push("connect-failed");
      throw new Error("expected connect failure");
    });

    let releaseCleanup!: () => void;
    const cleanupGate = new Promise<void>((resolve) => {
      releaseCleanup = resolve;
    });
    let firstCleanupEntered!: () => void;
    const cleanupEntered = new Promise<void>((resolve) => {
      firstCleanupEntered = resolve;
    });
    let cleanupCalls = 0;
    engineInternals.cleanup = jest.fn(async () => {
      cleanupCalls += 1;
      events.push(`cleanup-${cleanupCalls}-start`);
      if (cleanupCalls === 1) {
        firstCleanupEntered();
        await cleanupGate;
      }
      events.push(`cleanup-${cleanupCalls}-end`);
    });

    const connecting = captureRejection(
      engine.connect(`bunker://${recipient.publicKey}`),
    );
    await cleanupEntered;
    let disconnectSettled = false;
    const disconnecting = engine.disconnect().then(() => {
      disconnectSettled = true;
    });
    await Promise.resolve();

    expect(disconnectSettled).toBe(false);
    expect(events).toEqual(["connect-failed", "cleanup-1-start"]);

    releaseCleanup();
    expect((await connecting).message).toBe("expected connect failure");
    await disconnecting;
    expect(events).toEqual([
      "connect-failed",
      "cleanup-1-start",
      "cleanup-1-end",
      "cleanup-2-start",
      "cleanup-2-end",
    ]);
  });
});
