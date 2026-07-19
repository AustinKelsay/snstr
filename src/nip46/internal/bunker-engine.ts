import { Nostr } from "../../nip01/nostr";
import { NostrEvent, NostrFilter } from "../../types/nostr";
import { NIP46DiagnosticLogger } from "../utils/diagnostics";
import {
  NIP46KeyPair,
  NIP46Method,
  NIP46Request,
  NIP46Response,
} from "../types";
import { NIP46_EVENT_KIND, NIP46Wire } from "./wire";

export type NIP46RequestHandler = (
  request: NIP46Request,
  clientPubkey: string,
) => Promise<NIP46Response>;

export type NIP46DispatchGuardResult =
  | { action: "continue" }
  | { action: "drop" }
  | { action: "respond"; response: NIP46Response };

export interface NIP46BunkerEngineProfile {
  relays: string[];
  logger: NIP46DiagnosticLogger;
  signerKeys: () => NIP46KeyPair;
  validateStart: () => void;
  validateEnvelope: (event: NostrEvent) => void;
  beforeEvent?: (
    event: NostrEvent,
  ) => Promise<NIP46DispatchGuardResult> | NIP46DispatchGuardResult;
  beforeRequest?: (
    request: NIP46Request,
    clientPubkey: string,
  ) => Promise<NIP46DispatchGuardResult> | NIP46DispatchGuardResult;
  handlers: Partial<Record<NIP46Method, NIP46RequestHandler>>;
  unknownMethod: (request: NIP46Request) => NIP46Response;
  failureResponse?: (error: unknown) => NIP46Response;
  afterStart?: () => Promise<void> | void;
  beforeStop?: () => Promise<void> | void;
  afterStop?: () => Promise<void> | void;
}

/** Canonical bunker-side NIP-46 transport, dispatch, and lifecycle owner. */
export class NIP46BunkerEngine {
  private readonly nostr: Nostr;
  private readonly profile: NIP46BunkerEngineProfile;
  private subId: string | null = null;
  private lifecycleQueue: Promise<void> = Promise.resolve();
  private running = false;

  constructor(profile: NIP46BunkerEngineProfile) {
    this.profile = profile;
    this.nostr = new Nostr(profile.relays);
  }

  async start(): Promise<void> {
    return this.enqueueLifecycle(async () => {
      if (this.running) return;
      this.profile.validateStart();

      try {
        await this.nostr.connectToRelays();
        await this.removeSubscription();

        const filter: NostrFilter = {
          kinds: [NIP46_EVENT_KIND],
          "#p": [this.profile.signerKeys().publicKey],
        };
        this.subId = this.nostr.subscribe([filter], (event) => {
          this.handleEvent(event);
        })[0];
        await this.profile.afterStart?.();
        this.running = true;
      } catch (error) {
        await this.removeSubscription();
        try {
          await this.nostr.disconnectFromRelays();
        } catch {
          // Preserve the original start failure.
        }
        throw error;
      }
    });
  }

  async stop(): Promise<void> {
    return this.enqueueLifecycle(async () => {
      if (!this.running) return;
      await this.profile.beforeStop?.();
      await this.removeSubscription();
      try {
        await this.nostr.disconnectFromRelays();
      } catch (error) {
        this.profile.logger.warn("Failed to disconnect bunker relays", {
          error,
        });
      }
      await this.profile.afterStop?.();
      this.running = false;
    });
  }

  async publishEvent(event: NostrEvent): Promise<void> {
    await this.nostr.publishEvent(event);
  }

  private async handleEvent(event: NostrEvent): Promise<void> {
    try {
      this.profile.validateEnvelope(event);
      const eventGuard = await this.profile.beforeEvent?.(event);
      if (eventGuard && (await this.applyGuard(eventGuard, event.pubkey))) {
        return;
      }

      const request = NIP46Wire.decryptRequest(
        event,
        this.profile.signerKeys().privateKey,
      );
      if (!request.id || !request.method) {
        throw new Error("Invalid request structure");
      }

      this.profile.logger.debug("Dispatching NIP-46 request", {
        requestId: request.id,
        method: request.method,
        params: request.params,
      });

      const requestGuard = await this.profile.beforeRequest?.(
        request,
        event.pubkey,
      );
      if (requestGuard && (await this.applyGuard(requestGuard, event.pubkey))) {
        return;
      }

      const handler = this.profile.handlers[request.method];
      const response = handler
        ? await handler(request, event.pubkey)
        : this.profile.unknownMethod(request);
      await this.sendResponse(response, event.pubkey);
    } catch (error) {
      this.profile.logger.error("Failed to process NIP-46 request", {
        error,
      });
      const response = this.profile.failureResponse?.(error);
      if (response) await this.sendResponse(response, event.pubkey);
    }
  }

  private async applyGuard(
    guard: NIP46DispatchGuardResult,
    clientPubkey: string,
  ): Promise<boolean> {
    if (guard.action === "continue") return false;
    if (guard.action === "respond") {
      await this.sendResponse(guard.response, clientPubkey);
    }
    return true;
  }

  private async sendResponse(
    response: NIP46Response,
    clientPubkey: string,
  ): Promise<void> {
    try {
      this.profile.logger.debug("Sending NIP-46 response", {
        requestId: response.id,
        result: response.result,
        error: response.error,
        authUrl: response.auth_url,
      });
      const event = await NIP46Wire.createResponseEvent(
        response,
        this.profile.signerKeys(),
        clientPubkey,
      );
      await this.nostr.publishEvent(event);
    } catch (error) {
      this.profile.logger.error("Failed to send NIP-46 response", { error });
    }
  }

  private async removeSubscription(): Promise<void> {
    if (!this.subId) return;
    try {
      await this.nostr.unsubscribe([this.subId]);
    } catch (error) {
      this.profile.logger.warn("Failed to unsubscribe bunker", { error });
    } finally {
      this.subId = null;
    }
  }

  private enqueueLifecycle(transition: () => Promise<void>): Promise<void> {
    const result = this.lifecycleQueue.then(transition, transition);
    this.lifecycleQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
