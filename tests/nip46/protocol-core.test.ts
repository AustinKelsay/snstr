import { getPublicKey } from "../../src/utils/crypto";
import { NIP46RequestCorrelator } from "../../src/nip46/internal/request-correlator";
import { NIP46Wire } from "../../src/nip46/internal/wire";
import {
  NIP46Method,
  NIP46Request,
  NIP46Response,
} from "../../src/nip46/types";

async function captureRejection(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
    return new Error("Expected promise to reject");
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
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
});
