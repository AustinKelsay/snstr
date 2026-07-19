import type { Nostr } from "../nip01/nostr";
import type { Relay } from "../nip01/relay";
import type { RelayRegistry } from "../nip01/relayRegistry";
import type { NostrRemoteSignerBunker } from "../nip46/bunker";
import type { NIP46ClientEngine } from "../nip46/internal/client-engine";
import type { NIP46RateLimiter } from "../nip46/utils/rate-limiter";
import type { NIP46Request, NIP46Response } from "../nip46/types";
import type { NostrWalletConnectClient } from "../nip47/client";
import type { NostrWalletService } from "../nip47/service";
import type {
  NIP47EncryptionScheme,
  NIP47Request,
  NIP47Response,
} from "../nip47/types";
import type {
  NostrEvent,
  PublishOptions,
  PublishResponse,
} from "../types/nostr";

/** Minimal socket surface used when a test must drive Relay transport behavior. */
export interface RelayTestSocket {
  readyState: number;
  onopen?: ((event: unknown) => void) | null;
  onclose?: ((event: unknown) => void) | null;
  onerror?: ((event: unknown) => void) | null;
  onmessage?: ((event: { data: unknown }) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  terminate?: () => void;
}

/** Deliver one decoded relay frame through the production message handler. */
export function dispatchRelayMessage(relay: Relay, message: unknown[]): void {
  (
    relay as unknown as {
      handleMessage(value: unknown[]): void;
    }
  ).handleMessage(message);
}

/** Wait until validation work triggered by a delivered EVENT frame has settled. */
export async function waitForRelayValidation(
  relay: Relay,
  subscriptionId: string,
  timeoutMs = 1000,
): Promise<void> {
  const pending = (
    relay as unknown as {
      pendingValidationCounts: Map<string, number>;
    }
  ).pendingValidationCounts;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((pending.get(subscriptionId) ?? 0) === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error(
    `Timed out waiting for inbound EVENT validation for ${subscriptionId}`,
  );
}

/** Replace the inbound validator to hold or fail one lifecycle-sensitive test. */
export function replaceRelayInboundValidator(
  relay: Relay,
  validator: (event: unknown) => Promise<NostrEvent>,
): () => void {
  const target = relay as unknown as {
    validateInboundEvent(event: unknown): Promise<NostrEvent>;
  };
  const original = target.validateInboundEvent;
  target.validateInboundEvent = validator;
  return () => {
    target.validateInboundEvent = original;
  };
}

/** Install a deterministic socket and connection flag, returning a restore hook. */
export function installRelaySocket(
  relay: Relay,
  socket: RelayTestSocket | null,
  connected = socket?.readyState === 1,
): () => void {
  const target = relay as unknown as {
    ws: RelayTestSocket | null;
    connected: boolean;
  };
  const originalSocket = target.ws;
  const originalConnected = target.connected;
  target.ws = socket;
  target.connected = connected;
  return () => {
    target.ws = originalSocket;
    target.connected = originalConnected;
  };
}

/** Return the active socket only for tests that exercise the wire peer directly. */
export function getRelaySocket(relay: Relay): RelayTestSocket | null {
  return (relay as unknown as { ws: RelayTestSocket | null }).ws;
}

/** Trigger scheduling without exposing Relay's other private methods. */
export function scheduleRelayReconnect(relay: Relay): void {
  (relay as unknown as { scheduleReconnect(): void }).scheduleReconnect();
}

/** Invoke only the bunker connect handler for auth-challenge protocol tests. */
export function invokeNip46BunkerConnect(
  bunker: NostrRemoteSignerBunker,
  request: NIP46Request,
  clientPubkey: string,
): Promise<NIP46Response> {
  return (
    bunker as unknown as {
      handleConnect(
        value: NIP46Request,
        requester: string,
      ): Promise<NIP46Response>;
    }
  ).handleConnect(request, clientPubkey);
}

export interface NIP46ClientEngineLifecycleHooks {
  prepareConnection?: () => Promise<void>;
  setupSubscription?: () => Promise<void>;
  cleanup?: () => Promise<void>;
}

/** Install lifecycle gates without exposing the engine's other private state. */
export function installNip46ClientEngineLifecycleHooks(
  engine: NIP46ClientEngine,
  hooks: NIP46ClientEngineLifecycleHooks,
): () => void {
  const target = engine as unknown as {
    prepareConnection(): Promise<void>;
    setupSubscription(): Promise<void>;
    cleanup(): Promise<void>;
  };
  const originals = {
    prepareConnection: target.prepareConnection,
    setupSubscription: target.setupSubscription,
    cleanup: target.cleanup,
  };
  if (hooks.prepareConnection)
    target.prepareConnection = hooks.prepareConnection;
  if (hooks.setupSubscription)
    target.setupSubscription = hooks.setupSubscription;
  if (hooks.cleanup) target.cleanup = hooks.cleanup;
  return () => {
    target.prepareConnection = originals.prepareConnection;
    target.setupSubscription = originals.setupSubscription;
    target.cleanup = originals.cleanup;
  };
}

/** Replace only the rate-limiter teardown fault used by bunker stop tests. */
export function replaceNip46RateLimiterDestroy(
  bunker: NostrRemoteSignerBunker,
  destroy: () => void,
): () => void {
  const limiter = (
    bunker as unknown as {
      rateLimiter: NIP46RateLimiter;
    }
  ).rateLimiter;
  const original = limiter.destroy;
  limiter.destroy = destroy;
  return () => {
    limiter.destroy = original;
  };
}

export interface NIP47ClientInitializationTransport {
  connectToRelays(): Promise<void>;
  subscribe(
    filters: unknown[],
    callback: (event: NostrEvent, relay: string) => void,
  ): string[];
  unsubscribe(ids: string[]): void;
  disconnectFromRelays(): void;
}

export interface NIP47ClientInitializationHooks {
  transport: NIP47ClientInitializationTransport;
  waitForCapabilityDiscovery(): Promise<void>;
  sendRequest(
    request: NIP47Request,
    expiration?: number,
    allowDuringInitialization?: boolean,
  ): Promise<NIP47Response>;
  handleNotification?(event: NostrEvent): Promise<void>;
}

/** Install only the collaborators needed to exercise client initialization. */
export function installNip47ClientInitializationHooks(
  client: NostrWalletConnectClient,
  hooks: NIP47ClientInitializationHooks,
): () => void {
  const target = client as unknown as {
    client: NIP47ClientInitializationTransport;
    waitForCapabilityDiscovery(): Promise<void>;
    sendRequest(
      request: NIP47Request,
      expiration?: number,
      allowDuringInitialization?: boolean,
    ): Promise<NIP47Response>;
    handleNotification(event: NostrEvent): Promise<void>;
  };
  const originals = {
    client: target.client,
    waitForCapabilityDiscovery: target.waitForCapabilityDiscovery,
    sendRequest: target.sendRequest,
    handleNotification: target.handleNotification,
  };
  target.client = hooks.transport;
  target.waitForCapabilityDiscovery = () => hooks.waitForCapabilityDiscovery();
  target.sendRequest = (request, expiration, allowDuringInitialization) =>
    hooks.sendRequest(request, expiration, allowDuringInitialization);
  target.handleNotification = (event) =>
    hooks.handleNotification?.(event) ?? Promise.resolve();
  return () => {
    target.client = originals.client;
    target.waitForCapabilityDiscovery = originals.waitForCapabilityDiscovery;
    target.sendRequest = originals.sendRequest;
    target.handleNotification = originals.handleNotification;
  };
}

/** Deliver one correlated response through the production NIP-47 response path. */
export async function dispatchNip47ClientResponse(
  client: NostrWalletConnectClient,
  requestId: string,
  encryptionScheme: NIP47EncryptionScheme,
  event: NostrEvent,
): Promise<void> {
  const target = client as unknown as {
    pendingRequests: Map<
      string,
      {
        encryptionScheme: NIP47EncryptionScheme;
        resolve: (response: NIP47Response) => void;
      }
    >;
    handleResponse(value: NostrEvent): Promise<void>;
  };
  target.pendingRequests.set(requestId, {
    encryptionScheme,
    resolve: () => undefined,
  });
  await target.handleResponse(event);
}

/** Process one service request and report whether correlation state leaked. */
export async function processNip47ServiceRequest(
  service: NostrWalletService,
  event: NostrEvent,
): Promise<{ encryptionRetained: boolean }> {
  const target = service as unknown as {
    requestEncryption: { has(id: string): boolean };
    handleEvent(value: NostrEvent): Promise<void>;
  };
  await target.handleEvent(event);
  return { encryptionRetained: target.requestEncryption.has(event.id) };
}

export interface NostrTestRelay {
  publish?(
    event: NostrEvent,
    options?: PublishOptions,
  ): Promise<PublishResponse>;
  connect?(): Promise<unknown>;
  disconnect?(): unknown;
  on?(...args: unknown[]): unknown;
  off?(...args: unknown[]): unknown;
  subscribe?(...args: unknown[]): string;
  unsubscribe?(subscriptionId: string): void;
  authenticate?(
    event: NostrEvent,
    options?: PublishOptions,
  ): Promise<PublishResponse>;
  getLatestReplaceableEvent?(
    pubkey: string,
    kind: number,
  ): NostrEvent | undefined;
  getLatestAddressableEvent?(
    kind: number,
    pubkey: string,
    dTagValue: string,
  ): NostrEvent | undefined;
  getAddressableEventsByPubkey?(pubkey: string): NostrEvent[];
  getAddressableEventsByKind?(kind: number): NostrEvent[];
}

/** Install one deterministic relay double into Nostr's owned registry. */
export function installNostrTestRelay(
  nostr: Nostr,
  url: string,
  relay: NostrTestRelay,
): void {
  const registry = (nostr as unknown as { relays: RelayRegistry }).relays;
  registry.set(url, relay as unknown as Relay);
}
