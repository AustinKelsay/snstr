import { Nostr } from "../../nip01/nostr";
import { NostrEvent, NostrFilter } from "../../types/nostr";
import { generateKeypair } from "../../utils/crypto";
import { NIP46DiagnosticLogger } from "../utils/diagnostics";
import { parseConnectionString } from "../utils/connection";
import { generateRequestId } from "../utils/request-response";
import {
  NIP46ConnectionError,
  NIP46ConnectionInfo,
  NIP46Error,
  NIP46KeyPair,
  NIP46Method,
  NIP46Request,
  NIP46Response,
  NIP46TimeoutError,
} from "../types";
import { NIP46RequestCorrelator } from "./request-correlator";
import { NIP46_EVENT_KIND, NIP46Wire } from "./wire";

type RelayStrategy = "add" | "replace";

export interface NIP46ClientEngineProfile {
  relays: string[];
  timeout: number;
  logger: NIP46DiagnosticLogger;
  relayStrategy: RelayStrategy;
  parseBeforeInitialConnect: boolean;
  regenerateKeysOnConnect: boolean;
  filterResponsesBySigner: boolean;
  rejectProtocolErrors: boolean;
  requireConnectedForRequests: boolean;
  inspectPublishResult: boolean;
  connectDelayMs: number;
  disconnectDelayMs: number;
  buildConnectParams(info: NIP46ConnectionInfo): string[];
  timeoutError(method: NIP46Method, requestId: string): NIP46TimeoutError;
  disconnectError(): Error;
  wrapPublishError(error: unknown): Error;
  onCleanup?: () => void;
}

export interface NIP46ClientConnectResult {
  info: NIP46ConnectionInfo;
  response: NIP46Response;
}

/** Canonical client-side NIP-46 transport, correlation, and lifecycle owner. */
export class NIP46ClientEngine {
  private nostr: Nostr;
  private readonly profile: NIP46ClientEngineProfile;
  private readonly correlator = new NIP46RequestCorrelator();
  private clientKeypair: NIP46KeyPair = { publicKey: "", privateKey: "" };
  private signerPubkey: string | null = null;
  private userPubkey: string | null = null;
  private subId: string | null = null;
  private lifecycleQueue: Promise<void> = Promise.resolve();
  private isConnected = false;

  constructor(profile: NIP46ClientEngineProfile) {
    this.profile = profile;
    this.nostr = new Nostr(profile.relays);
  }

  get clientKeys(): NIP46KeyPair {
    return this.clientKeypair;
  }

  get connected(): boolean {
    return this.isConnected;
  }

  get pendingRequests(): NIP46RequestCorrelator["pending"] {
    return this.correlator.pending;
  }

  get cachedUserPubkey(): string | null {
    return this.userPubkey;
  }

  set cachedUserPubkey(pubkey: string | null) {
    this.userPubkey = pubkey;
  }

  async connect(connectionString: string): Promise<NIP46ClientConnectResult> {
    return this.enqueueLifecycle(async () => {
      try {
        let info: NIP46ConnectionInfo;

        if (this.profile.parseBeforeInitialConnect) {
          info = parseConnectionString(connectionString);
          await this.prepareConnection(info);
        } else {
          await this.ensureClientKeys();
          await this.nostr.connectToRelays();
          info = parseConnectionString(connectionString);
          await this.applyConnectionRelays(info);
        }

        this.signerPubkey = info.pubkey;
        await this.setupSubscription();

        const response = await this.request(
          NIP46Method.CONNECT,
          this.profile.buildConnectParams(info),
        );
        if (!response.error) this.isConnected = true;

        return { info, response };
      } catch (error) {
        await this.cleanup();
        throw error;
      }
    });
  }

  async disconnect(): Promise<void> {
    return this.enqueueLifecycle(async () => {
      try {
        if (this.canSendDisconnect()) {
          await this.request(NIP46Method.DISCONNECT, []);
        }
      } catch (error) {
        this.profile.logger.warn("Failed to send disconnect request", {
          error,
        });
      } finally {
        await this.cleanup();
        await this.delay(this.profile.disconnectDelayMs);
      }
    });
  }

  async request(method: NIP46Method, params: string[]): Promise<NIP46Response> {
    this.assertCanRequest(method);

    const request: NIP46Request = {
      id: generateRequestId(),
      method,
      params,
    };
    this.profile.logger.debug("Sending NIP-46 request", {
      requestId: request.id,
      method,
      params,
    });
    const responsePromise = this.correlator.register(
      request.id,
      this.profile.timeout,
      () => this.profile.timeoutError(method, request.id),
    );

    try {
      const event = await NIP46Wire.createRequestEvent(
        request,
        this.clientKeypair,
        this.signerPubkey!,
      );
      const result = await this.nostr.publishEvent(event, {
        timeout: this.profile.timeout,
      });
      if (this.profile.inspectPublishResult && !result.success) {
        throw new NIP46ConnectionError(
          `Relay rejected event: ${this.firstRelayFailure(result.relayResults)}`,
        );
      }
    } catch (error) {
      this.correlator.reject(request.id, this.profile.wrapPublishError(error));
    }

    const response = await responsePromise;
    if (this.profile.rejectProtocolErrors && response.error) {
      throw new NIP46Error(response.error);
    }
    return response;
  }

  private async prepareConnection(info: NIP46ConnectionInfo): Promise<void> {
    this.signerPubkey = info.pubkey;
    await this.ensureClientKeys();
    await this.applyConnectionRelays(info);
    await this.nostr.connectToRelays();
    await this.delay(this.profile.connectDelayMs);
  }

  private async ensureClientKeys(): Promise<void> {
    if (
      this.profile.regenerateKeysOnConnect ||
      !this.clientKeypair.privateKey
    ) {
      this.clientKeypair = await generateKeypair();
    }
  }

  private async applyConnectionRelays(
    info: NIP46ConnectionInfo,
  ): Promise<void> {
    if (!info.relays.length) return;

    if (this.profile.relayStrategy === "add") {
      for (const relay of info.relays) {
        try {
          this.nostr.addRelay(relay);
        } catch (error) {
          this.profile.logger.warn("Failed to add connection relay", {
            relay,
            error,
          });
        }
      }
      return;
    }

    await this.removeSubscription();
    await this.nostr.unsubscribeAll();
    await this.nostr.disconnectFromRelays();
    const relays = Array.from(
      new Set([...this.profile.relays, ...info.relays]),
    );
    this.nostr = new Nostr(relays);
    await this.nostr.connectToRelays();
  }

  private async setupSubscription(): Promise<void> {
    await this.removeSubscription();

    const filter: NostrFilter = {
      kinds: [NIP46_EVENT_KIND],
      "#p": [this.clientKeypair.publicKey],
    };
    if (this.profile.filterResponsesBySigner && this.signerPubkey) {
      filter.authors = [this.signerPubkey];
    }

    this.subId = this.nostr.subscribe([filter], (event) => {
      this.handleResponse(event);
    })[0];
  }

  private handleResponse(event: NostrEvent): void {
    if (
      this.profile.filterResponsesBySigner &&
      this.signerPubkey &&
      event.pubkey !== this.signerPubkey
    ) {
      return;
    }

    try {
      const response = NIP46Wire.decryptResponse(
        event,
        this.clientKeypair.privateKey,
      );
      this.profile.logger.debug("Received NIP-46 response", {
        requestId: response.id,
      });
      if (!this.correlator.settle(response)) {
        this.profile.logger.warn("Received response for unknown request", {
          requestId: response.id,
        });
      }
    } catch (error) {
      this.profile.logger.error("Failed to process response", { error });
    }
  }

  private assertCanRequest(method: NIP46Method): void {
    if (!this.clientKeypair.privateKey) {
      throw new NIP46ConnectionError("Client private key not set");
    }
    if (!this.signerPubkey) {
      throw new NIP46ConnectionError("Signer public key not set");
    }
    if (
      this.profile.requireConnectedForRequests &&
      !this.isConnected &&
      method !== NIP46Method.CONNECT
    ) {
      throw new NIP46ConnectionError("Client is not connected");
    }
  }

  private canSendDisconnect(): boolean {
    if (!this.clientKeypair.privateKey || !this.signerPubkey) return false;
    return !this.profile.requireConnectedForRequests || this.isConnected;
  }

  private async cleanup(): Promise<void> {
    this.isConnected = false;
    this.correlator.cancelAll(this.profile.disconnectError());
    this.profile.onCleanup?.();
    await this.removeSubscription();

    try {
      await this.nostr.disconnectFromRelays();
    } catch (error) {
      this.profile.logger.warn("Relay disconnection failed", { error });
    }

    this.signerPubkey = null;
    this.userPubkey = null;
  }

  private async removeSubscription(): Promise<void> {
    if (!this.subId) return;
    try {
      await this.nostr.unsubscribe([this.subId]);
    } catch (error) {
      this.profile.logger.warn("Unsubscription failed", { error });
    } finally {
      this.subId = null;
    }
  }

  // Serialize session transitions only. Ordinary requests remain concurrent,
  // and disconnect cleanup deliberately cancels them through the correlator.
  private enqueueLifecycle<T>(transition: () => Promise<T>): Promise<T> {
    const result = this.lifecycleQueue.then(transition, transition);
    this.lifecycleQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private firstRelayFailure(
    relayResults: Map<string, { success: boolean; reason?: string }>,
  ): string {
    for (const result of relayResults.values()) {
      if (!result.success && result.reason) return result.reason;
    }
    return "unknown reason";
  }

  private async delay(ms: number): Promise<void> {
    if (ms <= 0) return;
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, ms);
      if (typeof timeout === "object" && "unref" in timeout) timeout.unref();
    });
  }
}
