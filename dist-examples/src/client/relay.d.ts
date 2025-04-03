import 'websocket-polyfill';
import { NostrEvent, Filter, RelayEvent, RelayEventHandler } from '../types/nostr';
export declare class Relay {
    private url;
    private ws;
    private connected;
    private subscriptions;
    private eventHandlers;
    private connectionPromise;
    constructor(url: string);
    connect(): Promise<boolean>;
    disconnect(): void;
    on<T extends RelayEvent>(event: T, callback: RelayEventHandler[T]): void;
    publish(event: NostrEvent): Promise<boolean>;
    subscribe(filters: Filter[], onEvent: (event: NostrEvent) => void, onEOSE?: () => void): string;
    unsubscribe(id: string): void;
    private handleMessage;
    private triggerEvent;
}
