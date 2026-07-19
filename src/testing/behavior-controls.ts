import type { Nostr } from "../nip01/nostr";
import type { Relay } from "../nip01/relay";
import type { RelayRegistry } from "../nip01/relayRegistry";
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
