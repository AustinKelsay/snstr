import { dispatchNIP47Request } from "../../src/nip47/requestDispatcher";
import {
  NIP47EncryptionScheme,
  NIP47ErrorCode,
  NIP47Method,
  WalletImplementation,
} from "../../src/nip47/types";

function wallet(): jest.Mocked<WalletImplementation> {
  return {
    getInfo: jest.fn(async () => ({ methods: ["get_info"] })),
    getBalance: jest.fn(async () => 42),
    payInvoice: jest.fn(),
    makeInvoice: jest.fn(),
    lookupInvoice: jest.fn(),
    listTransactions: jest.fn(async () => []),
    signMessage: jest.fn(),
  };
}

describe("NIP-47 request dispatcher", () => {
  const supportedEncryption = [NIP47EncryptionScheme.NIP44_V2];

  test("validates parameters before invoking the wallet", async () => {
    const implementation = wallet();
    const response = await dispatchNIP47Request(
      {
        method: NIP47Method.PAY_INVOICE,
        params: { invoice: 1 } as never,
      },
      {
        wallet: implementation,
        supportedMethods: [NIP47Method.PAY_INVOICE],
        supportedEncryption,
      },
    );

    expect(implementation.payInvoice).not.toHaveBeenCalled();
    expect(response.error?.code).toBe(NIP47ErrorCode.INVALID_REQUEST);
    expect(response.error?.message).toBe(
      "Invalid parameters for pay_invoice method",
    );
  });

  test("dispatches supported methods and preserves result envelopes", async () => {
    const implementation = wallet();
    const response = await dispatchNIP47Request(
      { method: NIP47Method.GET_BALANCE, params: {} },
      {
        wallet: implementation,
        supportedMethods: [NIP47Method.GET_BALANCE],
        supportedEncryption,
      },
    );

    expect(response).toEqual({
      result_type: NIP47Method.GET_BALANCE,
      result: 42,
      error: null,
    });
  });

  test("reports unsupported methods without touching the wallet", async () => {
    const implementation = wallet();
    const response = await dispatchNIP47Request(
      { method: NIP47Method.GET_BALANCE, params: {} },
      { wallet: implementation, supportedMethods: [], supportedEncryption },
    );

    expect(implementation.getBalance).not.toHaveBeenCalled();
    expect(response.error?.message).toBe("Method get_balance not supported");
  });

  test("keeps lookup not-found compatibility context", async () => {
    const implementation = wallet();
    implementation.lookupInvoice.mockRejectedValue({
      code: NIP47ErrorCode.NOT_FOUND,
    });
    const response = await dispatchNIP47Request(
      {
        method: NIP47Method.LOOKUP_INVOICE,
        params: { payment_hash: "missing" },
      },
      {
        wallet: implementation,
        supportedMethods: [NIP47Method.LOOKUP_INVOICE],
        supportedEncryption,
      },
    );

    expect(response.error?.code).toBe(NIP47ErrorCode.NOT_FOUND);
    expect(response.error?.message).toContain("payment_hash: missing");
  });
});
