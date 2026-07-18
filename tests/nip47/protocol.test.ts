import {
  generateNWCURL,
  parseNIP47Request,
  parseNIP47Response,
  parseNWCURL,
  validateNIP47Response,
} from "../../src/nip47/protocol";

describe("NIP-47 protocol codecs", () => {
  test("round-trips encoded relay URLs without losing repeats", () => {
    const options = {
      pubkey: "wallet",
      secret: "secret",
      relays: ["wss://one.example/path", "wss://two.example"],
    };

    expect(parseNWCURL(generateNWCURL(options))).toEqual(options);
  });

  test("keeps the caller's protocol error type", () => {
    class ProtocolError extends Error {}

    expect(() =>
      validateNIP47Response({}, (message) => new ProtocolError(message)),
    ).toThrow(ProtocolError);
    expect(() =>
      parseNIP47Response("{", (message) => new ProtocolError(message)),
    ).toThrow(ProtocolError);
  });

  test("normalizes an omitted success error field", () => {
    expect(
      validateNIP47Response(
        { result_type: "get_balance", result: 1 },
        (message) => new Error(message),
      ),
    ).toEqual({ result_type: "get_balance", result: 1, error: null });
  });

  test("parses request envelopes and rejects missing params", () => {
    expect(parseNIP47Request('{"method":"get_balance","params":{}}')).toEqual({
      method: "get_balance",
      params: {},
    });
    expect(() => parseNIP47Request('{"method":"get_balance"}')).toThrow(
      "Invalid request: missing or invalid params",
    );
    expect(() =>
      parseNIP47Request('{"method":"get_balance","params":[]}'),
    ).toThrow("Invalid request: missing or invalid params");
  });
});
