import { NostrEvent } from "../types/nostr";
import { LogLevel } from "../utils/logger";
import { NIP46DiagnosticLogger } from "./utils/diagnostics";
import { generateRequestId } from "./utils/request-response";
import { NIP46ClientEngine } from "./internal/client-engine";
import { PendingNIP46Request } from "./internal/request-correlator";
import {
  NIP46ClientOptions,
  NIP46ConnectionError,
  NIP46DecryptionError,
  NIP46EncryptionError,
  NIP46Error,
  NIP46Method,
  NIP46SigningError,
  NIP46TimeoutError,
  NIP46UnsignedEventData,
} from "./types";

const DEFAULT_TIMEOUT = 30000;

/** Full-featured public facade over the canonical NIP-46 client engine. */
export class NostrRemoteSignerClient {
  private readonly options: NIP46ClientOptions;
  private readonly logger: NIP46DiagnosticLogger;
  private readonly engine: NIP46ClientEngine;

  constructor(options: NIP46ClientOptions = {}) {
    this.options = {
      timeout: DEFAULT_TIMEOUT,
      relays: [],
      secret: "",
      permissions: [],
      name: "",
      url: "",
      image: "",
      ...options,
    };
    this.logger = NIP46DiagnosticLogger.create(options.logger, {
      level: options.debug ? LogLevel.DEBUG : LogLevel.INFO,
      prefix: "NIP46-CLIENT",
      includeTimestamp: true,
      silent:
        typeof process !== "undefined" && process.env?.NODE_ENV === "test",
    });
    this.engine = new NIP46ClientEngine({
      relays: this.options.relays || [],
      timeout: this.options.timeout || DEFAULT_TIMEOUT,
      logger: this.logger,
      relayStrategy: "replace",
      parseBeforeInitialConnect: false,
      regenerateKeysOnConnect: false,
      filterResponsesBySigner: true,
      rejectProtocolErrors: false,
      requireConnectedForRequests: true,
      inspectPublishResult: false,
      connectDelayMs: 0,
      disconnectDelayMs: 0,
      buildConnectParams: (info) => {
        const params = [info.pubkey];
        if (info.secret) params.push(info.secret);
        if (info.permissions?.length) params.push(info.permissions.join(","));
        return params;
      },
      timeoutError: (_method, requestId) =>
        new NIP46TimeoutError(`Request ${requestId} timed out`),
      disconnectError: () => new NIP46ConnectionError("Client disconnected"),
      wrapPublishError: (error) =>
        new NIP46ConnectionError(
          `Failed to send request: ${this.errorMessage(error)}`,
        ),
    });
  }

  // Runtime-compatible private seams retained for the existing test contract.
  private get connected(): boolean {
    return this.engine.connected;
  }

  private get pendingRequests(): Map<string, PendingNIP46Request> {
    return this.engine.pendingRequests;
  }

  /** Connect and retain the advanced facade's `ack`/secret return contract. */
  public async connect(connectionString: string): Promise<string> {
    this.logger.info("Connecting to signer", { connectionString });
    try {
      const { response } = await this.engine.connect(connectionString);
      if (response.error) {
        throw new NIP46ConnectionError(`Connection failed: ${response.error}`);
      }
      return response.result || "ack";
    } catch (error) {
      await this.engine.disconnect();
      if (error instanceof NIP46Error) throw error;
      throw new NIP46ConnectionError(
        `Failed to connect: ${this.errorMessage(error)}`,
      );
    }
  }

  public async disconnect(): Promise<void> {
    await this.engine.disconnect();
  }

  async signEvent(eventData: NIP46UnsignedEventData): Promise<NostrEvent> {
    this.assertConnected();
    const response = await this.engine.request(NIP46Method.SIGN_EVENT, [
      JSON.stringify(eventData),
    ]);
    if (response.error) {
      throw new NIP46SigningError(`Event signing failed: ${response.error}`);
    }
    return JSON.parse(response.result!) as NostrEvent;
  }

  public async getUserPublicKey(): Promise<string> {
    this.assertConnected();
    if (this.engine.cachedUserPubkey) return this.engine.cachedUserPubkey;

    const response = await this.engine.request(NIP46Method.GET_PUBLIC_KEY, []);
    if (response.error) {
      throw new NIP46ConnectionError(
        `Failed to get public key: ${response.error}`,
      );
    }
    this.engine.cachedUserPubkey = response.result!;
    return response.result!;
  }

  /** @deprecated Use getUserPublicKey() instead. */
  async getPublicKey(): Promise<string> {
    return this.getUserPublicKey();
  }

  async ping(): Promise<string> {
    this.assertConnected();
    const response = await this.engine.request(NIP46Method.PING, []);
    if (response.error) throw new NIP46Error(`Ping failed: ${response.error}`);
    return response.result!;
  }

  async nip44Encrypt(
    thirdPartyPubkey: string,
    plaintext: string,
  ): Promise<string> {
    return this.encryptionRequest(
      NIP46Method.NIP44_ENCRYPT,
      thirdPartyPubkey,
      plaintext,
      "NIP-44",
    );
  }

  async nip44Decrypt(
    thirdPartyPubkey: string,
    ciphertext: string,
  ): Promise<string> {
    return this.decryptionRequest(
      NIP46Method.NIP44_DECRYPT,
      thirdPartyPubkey,
      ciphertext,
      "NIP-44",
    );
  }

  async getRelays(): Promise<string[]> {
    this.assertConnected();
    const response = await this.engine.request(NIP46Method.GET_RELAYS, []);
    if (response.error) {
      throw new NIP46Error(`Get relays failed: ${response.error}`);
    }
    return JSON.parse(response.result!) as string[];
  }

  async nip04Encrypt(
    thirdPartyPubkey: string,
    plaintext: string,
  ): Promise<string> {
    return this.encryptionRequest(
      NIP46Method.NIP04_ENCRYPT,
      thirdPartyPubkey,
      plaintext,
      "NIP-04",
    );
  }

  async nip04Decrypt(
    thirdPartyPubkey: string,
    ciphertext: string,
  ): Promise<string> {
    return this.decryptionRequest(
      NIP46Method.NIP04_DECRYPT,
      thirdPartyPubkey,
      ciphertext,
      "NIP-04",
    );
  }

  private async encryptionRequest(
    method: NIP46Method,
    pubkey: string,
    plaintext: string,
    label: string,
  ): Promise<string> {
    this.assertConnected();
    const response = await this.engine.request(method, [pubkey, plaintext]);
    if (response.error) {
      throw new NIP46EncryptionError(
        `${label} encryption failed: ${response.error}`,
      );
    }
    return response.result!;
  }

  private async decryptionRequest(
    method: NIP46Method,
    pubkey: string,
    ciphertext: string,
    label: string,
  ): Promise<string> {
    this.assertConnected();
    const response = await this.engine.request(method, [pubkey, ciphertext]);
    if (response.error) {
      throw new NIP46DecryptionError(
        `${label} decryption failed: ${response.error}`,
      );
    }
    return response.result!;
  }

  private assertConnected(): void {
    if (!this.engine.connected) {
      throw new NIP46ConnectionError("Not connected to signer");
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  static generateConnectionString(
    clientPubkey: string,
    options: NIP46ClientOptions = {},
  ): string {
    if (!clientPubkey || clientPubkey.trim() === "") {
      throw new NIP46ConnectionError("Client pubkey cannot be empty");
    }

    const params = new URLSearchParams();
    options.relays?.forEach((relay) => params.append("relay", relay));
    params.append("secret", options.secret || generateRequestId());
    if (options.permissions?.length) {
      params.append("perms", options.permissions.join(","));
    }
    if (options.name) params.append("name", options.name);
    if (options.url) params.append("url", options.url);
    if (options.image) params.append("image", options.image);
    return `nostrconnect://${clientPubkey}?${params.toString()}`;
  }
}
