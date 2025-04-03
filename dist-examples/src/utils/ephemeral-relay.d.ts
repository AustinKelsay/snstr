import { WebSocket, WebSocketServer } from 'ws';
interface EventFilter {
    ids?: string[];
    authors?: string[];
    kinds?: number[];
    since?: number;
    until?: number;
    limit?: number;
    [key: string]: any | undefined;
}
interface SignedEvent {
    content: string;
    created_at: number;
    id: string;
    kind: number;
    pubkey: string;
    sig: string;
    tags: string[][];
}
interface Subscription {
    filters: EventFilter[];
    instance: ClientSession;
    sub_id: string;
}
export declare class NostrRelay {
    private readonly _emitter;
    private readonly _port;
    private readonly _purge;
    private readonly _subs;
    private _wss;
    private _cache;
    conn: number;
    constructor(port: number, purge_ival?: number);
    get cache(): SignedEvent[];
    get subs(): Map<string, Subscription>;
    get url(): string;
    get wss(): WebSocketServer;
    start(): Promise<unknown>;
    onconnect(cb: () => void): void;
    close(): Promise<void>;
    store(event: SignedEvent): void;
}
declare class ClientSession {
    private readonly _sid;
    private readonly _relay;
    private readonly _socket;
    private readonly _subs;
    constructor(relay: NostrRelay, socket: WebSocket);
    get sid(): string;
    get relay(): NostrRelay;
    get socket(): WebSocket;
    _cleanup(code: number): void;
    _handler(message: string): void;
    _onclose(sub_id: string): void;
    _onerr(err: Error): void;
    _onevent(event: SignedEvent | any): void;
    _onreq(sub_id: string, filters: EventFilter[]): void;
    get log(): {
        client: (...msg: any[]) => false | void;
        debug: (...msg: any[]) => false | void;
        info: (...msg: any[]) => false | void;
        raw: (...msg: any[]) => false | void;
    };
    addSub(sub_id: string, ...filters: EventFilter[]): void;
    remSub(subId: string): void;
    send(message: any[]): this;
}
export {};
