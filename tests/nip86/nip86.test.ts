import { sha256Hex } from "../../src/utils/crypto";
import type { Signer } from "../../src/signer";
import {
  HTTP_AUTH_KIND,
  RelayManagementClient,
  RelayManagementError,
  createHttpAuthEventTemplate,
  toRelayManagementHttpUrl,
  useRelayManagementFetchImplementation,
} from "../../src/nip86";

describe("NIP-86 relay management helpers", () => {
  const originalFetch = global.fetch;
  let mockFetch: jest.Mock;

  const signer: Signer = {
    getPublicKey: jest.fn().mockResolvedValue("pubkey"),
    signEvent: jest.fn().mockImplementation(async (event) => ({
      ...event,
      created_at: event.created_at ?? 123,
      id: "auth-id",
      pubkey: "pubkey",
      sig: "sig",
      tags: event.tags || [],
    })),
  };

  beforeEach(() => {
    mockFetch = jest.fn();
    useRelayManagementFetchImplementation(mockFetch as unknown as typeof fetch);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
    useRelayManagementFetchImplementation(originalFetch);
  });

  test("createHttpAuthEventTemplate follows NIP-98 tag requirements", () => {
    const body = JSON.stringify({ method: "supportedmethods", params: [] });
    const template = createHttpAuthEventTemplate(
      "https://relay.example.com/admin",
      "post",
      body,
    );

    expect(template).toEqual({
      kind: HTTP_AUTH_KIND,
      content: "",
      tags: [
        ["u", "https://relay.example.com/admin"],
        ["method", "POST"],
        ["payload", sha256Hex(body)],
      ],
    });
  });

  test("RelayManagementClient sends POST requests with NIP-98 auth", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: ["supportedmethods", "banpubkey"] }),
    });

    const client = new RelayManagementClient("wss://relay.example.com", {
      signer,
    });

    await expect(client.supportedMethods()).resolves.toEqual([
      "supportedmethods",
      "banpubkey",
    ]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0] as [
      string,
      {
        method: string;
        headers: Record<string, string>;
        body: string;
      },
    ];

    expect(url).toBe("https://relay.example.com/");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe(
      "application/nostr+json+rpc",
    );
    expect(options.headers.Authorization).toMatch(/^Nostr /);

    const encodedEvent = options.headers.Authorization.slice("Nostr ".length);
    const decodedEvent = JSON.parse(
      Buffer.from(encodedEvent, "base64").toString("utf8"),
    );
    expect(decodedEvent.kind).toBe(HTTP_AUTH_KIND);
    expect(decodedEvent.tags).toEqual(
      expect.arrayContaining([
        ["u", "https://relay.example.com/"],
        ["method", "POST"],
        ["payload", sha256Hex(options.body)],
      ]),
    );
  });

  test("RelayManagementClient throws relay errors", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "unauthorized" }),
    });

    const client = new RelayManagementClient("wss://relay.example.com");

    await expect(client.listBannedPubkeys()).rejects.toEqual(
      expect.objectContaining<Partial<RelayManagementError>>({
        name: "RelayManagementError",
        message: "unauthorized",
        status: 401,
      }),
    );
  });

  test("RelayManagementClient throws on missing successful results", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    const client = new RelayManagementClient("wss://relay.example.com");

    await expect(client.listBannedPubkeys()).rejects.toEqual(
      expect.objectContaining<Partial<RelayManagementError>>({
        name: "RelayManagementError",
        message: "Relay management response missing result",
        status: 200,
      }),
    );
  });

  test("RelayManagementClient wraps fetch rejections", async () => {
    mockFetch.mockRejectedValue(new Error("network"));

    const client = new RelayManagementClient("wss://relay.example.com");

    await expect(client.listBannedPubkeys()).rejects.toEqual(
      expect.objectContaining<Partial<RelayManagementError>>({
        name: "RelayManagementError",
        message: "Relay management request failed: network",
        status: undefined,
      }),
    );
  });

  test("RelayManagementClient releases its timeout after fetch rejects", async () => {
    jest.useFakeTimers();
    mockFetch.mockRejectedValue(new Error("network"));

    const client = new RelayManagementClient("wss://relay.example.com");

    await expect(client.listBannedPubkeys()).rejects.toMatchObject({
      name: "RelayManagementError",
      message: "Relay management request failed: network",
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  test("RelayManagementClient releases its timeout after a successful response", async () => {
    jest.useFakeTimers();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: [{ pubkey: "allowed" }] }),
    });

    const client = new RelayManagementClient("wss://relay.example.com");

    await expect(client.listAllowedPubkeys()).resolves.toEqual([
      { pubkey: "allowed" },
    ]);
    expect(jest.getTimerCount()).toBe(0);
  });

  test("RelayManagementClient releases its timeout after a non-OK response", async () => {
    jest.useFakeTimers();
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    });

    const client = new RelayManagementClient("wss://relay.example.com");

    await expect(client.supportedMethods()).rejects.toMatchObject({
      name: "RelayManagementError",
      message: "Relay management request failed with 503",
      status: 503,
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  test("RelayManagementClient releases its timeout after a protocol error", async () => {
    jest.useFakeTimers();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ error: "unsupported method" }),
    });

    const client = new RelayManagementClient("wss://relay.example.com");

    await expect(client.supportedMethods()).rejects.toMatchObject({
      name: "RelayManagementError",
      message: "unsupported method",
      status: 200,
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  test("RelayManagementClient releases its timeout after invalid JSON", async () => {
    jest.useFakeTimers();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    });

    const client = new RelayManagementClient("wss://relay.example.com");

    await expect(client.supportedMethods()).rejects.toMatchObject({
      name: "RelayManagementError",
      message: "Relay management endpoint returned invalid JSON",
      status: 200,
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  test("RelayManagementClient aborts a stalled fetch once and releases its timeout", async () => {
    jest.useFakeTimers();
    let abortCount = 0;
    mockFetch.mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => {
              abortCount += 1;
              const abortError = new Error("The operation was aborted");
              abortError.name = "AbortError";
              reject(abortError);
            },
            { once: true },
          );
        }),
    );

    const client = new RelayManagementClient("wss://relay.example.com", {
      timeoutMs: 1,
    });

    const request = expect(client.supportedMethods()).rejects.toMatchObject({
      name: "RelayManagementError",
      message:
        "Relay management request aborted/timed out: The operation was aborted",
    });
    await jest.advanceTimersByTimeAsync(1);

    await request;
    expect(abortCount).toBe(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  test("RelayManagementClient rejects non-serializable circular params", async () => {
    const client = new RelayManagementClient("wss://relay.example.com");
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    await expect(client.call("testmethod", [circular])).rejects.toEqual(
      expect.objectContaining<Partial<RelayManagementError>>({
        name: "RelayManagementError",
        message: "Relay management params contain circular references",
      }),
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("RelayManagementClient rejects invalid numeric params before fetch", async () => {
    const client = new RelayManagementClient("wss://relay.example.com");

    await expect(client.call("testmethod", [Infinity])).rejects.toEqual(
      expect.objectContaining<Partial<RelayManagementError>>({
        name: "RelayManagementError",
        message: expect.stringContaining("Relay management params are invalid"),
      }),
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("RelayManagementClient aborts a stalled response body once and releases its timeout", async () => {
    jest.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    let abortCount = 0;
    mockFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined;

      return {
        ok: true,
        status: 200,
        json: async () =>
          new Promise((_, reject) => {
            capturedSignal?.addEventListener(
              "abort",
              () => {
                abortCount += 1;
                const abortError = new Error("The operation was aborted");
                abortError.name = "AbortError";
                reject(abortError);
              },
              { once: true },
            );
          }),
      };
    });

    const client = new RelayManagementClient("wss://relay.example.com", {
      timeoutMs: 1,
    });

    const request = expect(client.listBannedPubkeys()).rejects.toMatchObject({
      name: "RelayManagementError",
      message:
        "Relay management request aborted/timed out: The operation was aborted",
      status: 200,
    });
    await jest.advanceTimersByTimeAsync(1);

    await request;
    expect(abortCount).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  test("toRelayManagementHttpUrl converts websocket URLs", () => {
    expect(toRelayManagementHttpUrl("ws://relay.example.com/admin")).toBe(
      "http://relay.example.com/admin",
    );
    expect(toRelayManagementHttpUrl("wss://relay.example.com")).toBe(
      "https://relay.example.com/",
    );
    expect(toRelayManagementHttpUrl("Relay.Example.com/admin")).toBe(
      "https://relay.example.com/admin",
    );
  });
});
