import type { EventTemplate } from "../types/nostr";
import { sha256Hex } from "../utils/crypto";
import type { Signer } from "../signer";
import { normalizeRelayUrl } from "../utils/relayUrl";
import {
  sanitizeString,
  validateNumber,
} from "../utils/security-validator";

export const RELAY_MANAGEMENT_CONTENT_TYPE = "application/nostr+json+rpc";
export const HTTP_AUTH_KIND = 27235;

export interface RelayManagementRequest {
  method: string;
  params: unknown[];
}

export interface RelayManagementResponse<T = unknown> {
  result?: T;
  error?: string;
}

export interface RelayManagementPubkeyEntry {
  pubkey: string;
  reason?: string;
}

export interface RelayManagementEventEntry {
  id: string;
  reason?: string;
}

export interface RelayManagementBlockedIpEntry {
  ip: string;
  reason?: string;
}

export interface RelayManagementClientOptions {
  signer?: Signer;
  timeoutMs?: number;
}

export class RelayManagementError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly response?: unknown,
  ) {
    super(message);
    this.name = "RelayManagementError";
  }
}

function isAbortLikeError(error: unknown): boolean {
  return (typeof DOMException !== "undefined" && error instanceof DOMException)
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

/**
 * Global fetch implementation used by all `RelayManagementClient` instances in
 * the current runtime. Set this once at process/app startup in non-standard
 * environments, or save/restore the previous value if tests temporarily swap it.
 */
let fetchImplementation = globalThis.fetch;

/**
 * Replaces the shared fetch implementation for all `RelayManagementClient`
 * consumers in the current runtime. This is global singleton state, so callers
 * should typically configure it once at startup rather than per-request.
 */
export function useRelayManagementFetchImplementation(fetchImpl: typeof fetch) {
  fetchImplementation = fetchImpl;
}

function encodeBase64(value: string): string {
  if (typeof globalThis?.btoa === "function") {
    return globalThis.btoa(value);
  }

  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf8").toString("base64");
  }

  throw new Error("No base64 implementation available");
}

export function toRelayManagementHttpUrl(relayUrl: string): string {
  const trimmedRelayUrl = relayUrl.trim();
  const isWebsocketLike =
    !/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmedRelayUrl) ||
    /^wss?:\/\//i.test(trimmedRelayUrl);
  const normalizedInput = isWebsocketLike
    ? normalizeRelayUrl(trimmedRelayUrl)
    : trimmedRelayUrl;
  const url = new URL(normalizedInput);

  if (url.protocol === "ws:") {
    url.protocol = "http:";
  } else if (url.protocol === "wss:") {
    url.protocol = "https:";
  } else if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported relay management URL: ${relayUrl}`);
  }

  return url.toString();
}

export function createHttpAuthEventTemplate(
  url: string,
  method: string,
  body?: string,
): EventTemplate {
  const tags: string[][] = [
    ["u", new URL(url).toString()],
    ["method", method.toUpperCase()],
  ];

  if (body !== undefined) {
    tags.push(["payload", sha256Hex(body)]);
  }

  return {
    kind: HTTP_AUTH_KIND,
    content: "",
    tags,
  };
}

export async function createHttpAuthHeader(
  signer: Signer,
  url: string,
  method: string,
  body?: string,
): Promise<string> {
  const event = await signer.signEvent(
    createHttpAuthEventTemplate(url, method, body),
  );

  return `Nostr ${encodeBase64(JSON.stringify(event))}`;
}

async function parseManagementResponse<T>(
  response: Response,
): Promise<RelayManagementResponse<T>> {
  try {
    return (await response.json()) as RelayManagementResponse<T>;
  } catch (error) {
    if (isAbortLikeError(error)) {
      const detail =
        error instanceof Error && error.message ? `: ${error.message}` : "";
      throw new RelayManagementError(
        `Relay management request aborted/timed out${detail}`,
        response.status,
      );
    }

    throw new RelayManagementError(
      "Relay management endpoint returned invalid JSON",
      response.status,
    );
  }
}

export class RelayManagementClient {
  private readonly relayUrl: string;
  private readonly timeoutMs: number;
  private signer?: Signer;

  constructor(relayUrl: string, options: RelayManagementClientOptions = {}) {
    const validatedRelayUrl = sanitizeString(relayUrl);
    this.relayUrl = toRelayManagementHttpUrl(validatedRelayUrl);
    this.signer = options.signer;
    this.timeoutMs =
      options.timeoutMs === undefined
        ? 5000
        : validateNumber(options.timeoutMs, 1, 300000, "timeoutMs");
  }

  setSigner(signer?: Signer): void {
    this.signer = signer;
  }

  async call<T = unknown>(
    method: string,
    params: unknown[] = [],
  ): Promise<T> {
    if (!fetchImplementation) {
      throw new Error("Fetch implementation is not available");
    }

    const request: RelayManagementRequest = {
      method: sanitizeString(method),
      params,
    };
    const body = JSON.stringify(request);
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": RELAY_MANAGEMENT_CONTENT_TYPE,
    };

    if (this.signer) {
      headers.Authorization = await createHttpAuthHeader(
        this.signer,
        this.relayUrl,
        "POST",
        body,
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetchImplementation(this.relayUrl, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });
    } catch (error) {
      if (isAbortLikeError(error)) {
        const detail =
          error instanceof Error && error.message ? `: ${error.message}` : "";
        throw new RelayManagementError(
          `Relay management request aborted/timed out${detail}`,
        );
      }

      throw new RelayManagementError(
        `Relay management request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    let payload: RelayManagementResponse<T>;
    try {
      payload = await parseManagementResponse<T>(response);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new RelayManagementError(
        payload.error || `Relay management request failed with ${response.status}`,
        response.status,
        payload,
      );
    }

    if (payload.error) {
      throw new RelayManagementError(payload.error, response.status, payload);
    }

    if (payload.result === undefined || payload.result === null) {
      throw new RelayManagementError(
        "Relay management response missing result",
        response.status,
        payload,
      );
    }

    return payload.result;
  }

  supportedMethods(): Promise<string[]> {
    return this.call("supportedmethods");
  }

  banPubkey(pubkey: string, reason?: string): Promise<boolean> {
    return this.call("banpubkey", reason ? [pubkey, reason] : [pubkey]);
  }

  unbanPubkey(pubkey: string, reason?: string): Promise<boolean> {
    return this.call("unbanpubkey", reason ? [pubkey, reason] : [pubkey]);
  }

  listBannedPubkeys(): Promise<RelayManagementPubkeyEntry[]> {
    return this.call("listbannedpubkeys");
  }

  allowPubkey(pubkey: string, reason?: string): Promise<boolean> {
    return this.call("allowpubkey", reason ? [pubkey, reason] : [pubkey]);
  }

  unallowPubkey(pubkey: string, reason?: string): Promise<boolean> {
    return this.call("unallowpubkey", reason ? [pubkey, reason] : [pubkey]);
  }

  listAllowedPubkeys(): Promise<RelayManagementPubkeyEntry[]> {
    return this.call("listallowedpubkeys");
  }

  listEventsNeedingModeration(): Promise<RelayManagementEventEntry[]> {
    return this.call("listeventsneedingmoderation");
  }

  allowEvent(id: string, reason?: string): Promise<boolean> {
    return this.call("allowevent", reason ? [id, reason] : [id]);
  }

  banEvent(id: string, reason?: string): Promise<boolean> {
    return this.call("banevent", reason ? [id, reason] : [id]);
  }

  listBannedEvents(): Promise<RelayManagementEventEntry[]> {
    return this.call("listbannedevents");
  }

  changeRelayName(name: string): Promise<boolean> {
    return this.call("changerelayname", [name]);
  }

  changeRelayDescription(description: string): Promise<boolean> {
    return this.call("changerelaydescription", [description]);
  }

  changeRelayIcon(iconUrl: string): Promise<boolean> {
    return this.call("changerelayicon", [iconUrl]);
  }

  allowKind(kind: number): Promise<boolean> {
    return this.call("allowkind", [kind]);
  }

  disallowKind(kind: number): Promise<boolean> {
    return this.call("disallowkind", [kind]);
  }

  listAllowedKinds(): Promise<number[]> {
    return this.call("listallowedkinds");
  }

  blockIp(ip: string, reason?: string): Promise<boolean> {
    return this.call("blockip", reason ? [ip, reason] : [ip]);
  }

  unblockIp(ip: string): Promise<boolean> {
    return this.call("unblockip", [ip]);
  }

  listBlockedIps(): Promise<RelayManagementBlockedIpEntry[]> {
    return this.call("listblockedips");
  }
}
