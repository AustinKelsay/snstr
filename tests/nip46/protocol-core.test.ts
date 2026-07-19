import { generateKeypair } from "../../src";
import { NIP46RequestCorrelator } from "../../src/nip46/internal/request-correlator";
import { NIP46Wire } from "../../src/nip46/internal/wire";
import {
  NIP46Method,
  NIP46Request,
  NIP46Response,
} from "../../src/nip46/types";

describe("NIP-46 protocol core", () => {
  test("rejects duplicate pending request IDs without replacing the owner", async () => {
    const correlator = new NIP46RequestCorrelator();
    const first = correlator.register("duplicate", 1000, () => new Error());
    const firstOutcome = expect(first).rejects.toThrow("cleanup");

    await expect(
      correlator.register("duplicate", 1000, () => new Error()),
    ).rejects.toThrow("already pending");
    expect(correlator.pending.size).toBe(1);

    correlator.reject("duplicate", new Error("cleanup"));
    await firstOutcome;
    expect(correlator.pending.size).toBe(0);
  });

  test("accepts well-shaped extension methods and rejects malformed envelopes", async () => {
    const sender = await generateKeypair();
    const recipient = await generateKeypair();
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
