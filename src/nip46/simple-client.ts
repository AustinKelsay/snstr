import { NostrEvent } from "../types/nostr";
import { LogLevel } from "../utils/logger";
import { NIP46ClientEngine } from "./internal/client-engine";
import { NIP46DiagnosticLogger } from "./utils/diagnostics";
import {
  NIP46ConnectionError,
  NIP46DecryptionError,
  NIP46EncryptionError,
  NIP46Error,
  NIP46KeyPair,
  NIP46Method,
  NIP46SigningError,
  NIP46TimeoutError,
  NIP46UnsignedEventData,
  SimpleNIP46ClientOptions,
} from "./types";

/** Lightweight public facade over the canonical NIP-46 client engine. */
export class SimpleNIP46Client {
  private readonly logger: NIP46DiagnosticLogger;
  private readonly engine: NIP46ClientEngine;

  constructor(relays: string[], options: SimpleNIP46ClientOptions = {}) {
    const timeout = options.timeout || 30000;
    const debug = options.debug || false;
    const logLevel =
      options.logLevel || (debug ? LogLevel.DEBUG : LogLevel.INFO);

    this.logger = NIP46DiagnosticLogger.create(options.logger, {
      prefix: "Client",
      level: logLevel,
      silent: process.env.NODE_ENV === "test",
    });
    this.engine = new NIP46ClientEngine({
      relays,
      timeout,
      logger: this.logger,
      relayStrategy: "add",
      parseBeforeInitialConnect: true,
      regenerateKeysOnConnect: true,
      filterResponsesBySigner: true,
      rejectProtocolErrors: true,
      requireConnectedForRequests: false,
      inspectPublishResult: true,
      connectDelayMs: 1000,
      disconnectDelayMs: 500,
      buildConnectParams: (info) => [
        info.pubkey,
        info.secret || "",
        (info.permissions || []).join(","),
      ],
      timeoutError: (method) =>
        new NIP46TimeoutError(`Request timed out: ${method}`),
      disconnectError: () => new NIP46Error("Client disconnected"),
      wrapPublishError: (error) =>
        new NIP46ConnectionError(
          `Failed to sign or publish event: ${this.errorMessage(error)}`,
        ),
    });
  }

  // Runtime-compatible private seam retained for the existing test contract.
  private get clientKeys(): NIP46KeyPair {
    return this.engine.clientKeys;
  }

  /** Connect and retain the simple facade's user-pubkey return contract. */
  async connect(connectionString: string): Promise<string> {
    this.logger.info("Connecting to signer", { connectionString });
    try {
      const { info, response } = await this.engine.connect(connectionString);
      if (response.error) {
        throw new NIP46ConnectionError(`Connection failed: ${response.error}`);
      }
      if (
        response.result !== "ack" &&
        (!info.secret || info.secret !== response.result)
      ) {
        throw new NIP46ConnectionError("Invalid or missing required secret");
      }
      if (response.result !== "ack") {
        this.logger.debug("Connect response requires secret", {
          hasSecret: true,
        });
      }

      try {
        const userPubkey = await this.getPublicKey();
        this.engine.cachedUserPubkey = userPubkey;
        return userPubkey;
      } catch {
        throw new NIP46ConnectionError(
          "Failed to get user public key after connect",
        );
      }
    } catch (error) {
      await this.engine.disconnect();
      if (error instanceof NIP46Error) throw error;
      throw new NIP46ConnectionError(
        `Connection failed: ${this.errorMessage(error)}`,
      );
    }
  }

  async getPublicKey(): Promise<string> {
    const response = await this.engine.request(NIP46Method.GET_PUBLIC_KEY, []);
    return response.result!;
  }

  async ping(): Promise<boolean> {
    try {
      if (!this.engine.connected) return false;
      const response = await this.engine.request(NIP46Method.PING, []);
      return response.result === "pong";
    } catch {
      return false;
    }
  }

  async signEvent(eventData: NIP46UnsignedEventData): Promise<NostrEvent> {
    const response = await this.engine.request(NIP46Method.SIGN_EVENT, [
      JSON.stringify(eventData),
    ]);
    if (response.error) throw new NIP46SigningError(response.error);
    return JSON.parse(response.result!) as NostrEvent;
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

  async getRelays(): Promise<string[]> {
    const response = await this.engine.request(NIP46Method.GET_RELAYS, []);
    return JSON.parse(response.result!) as string[];
  }

  async disconnect(): Promise<void> {
    await this.engine.disconnect();
  }

  setLogLevel(level: LogLevel): void {
    this.logger.setLevel(level);
  }

  private async encryptionRequest(
    method: NIP46Method,
    pubkey: string,
    plaintext: string,
    label: string,
  ): Promise<string> {
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
    const response = await this.engine.request(method, [pubkey, ciphertext]);
    if (response.error) {
      throw new NIP46DecryptionError(
        `${label} decryption failed: ${response.error}`,
      );
    }
    return response.result!;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
