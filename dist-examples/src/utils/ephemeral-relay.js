"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NostrRelay = void 0;
const zod_1 = require("zod");
const secp256k1_1 = require("@noble/curves/secp256k1");
const sha256_1 = require("@noble/hashes/sha256");
const node_events_1 = require("node:events");
const ws_1 = require("ws");
/* ================ [ Configuration ] ================ */
const HOST = 'ws://localhost';
const DEBUG = process.env['DEBUG'] === 'true';
const VERBOSE = process.env['VERBOSE'] === 'true' || DEBUG;
console.log('output mode:', DEBUG ? 'debug' : VERBOSE ? 'verbose' : 'silent');
/* ================ [ Schema ] ================ */
const num = zod_1.z.number().max(Number.MAX_SAFE_INTEGER), str = zod_1.z.string(), stamp = num.min(500000000), hex = str.regex(/^[0-9a-fA-F]*$/).refine(e => e.length % 2 === 0), hash = hex.refine((e) => e.length === 64), sig = hex.refine((e) => e.length === 128), tags = str.array();
const event_schema = zod_1.z.object({
    content: str,
    created_at: stamp,
    id: hash,
    kind: num,
    pubkey: hash,
    sig: sig,
    tags: tags.array()
});
const filter_schema = zod_1.z.object({
    ids: hash.array().optional(),
    authors: hash.array().optional(),
    kinds: num.array().optional(),
    since: stamp.optional(),
    until: stamp.optional(),
    limit: num.optional(),
}).catchall(tags);
const sub_schema = zod_1.z.tuple([str]).rest(filter_schema);
/* ================ [ Server Class ] ================ */
class NostrRelay {
    constructor(port, purge_ival) {
        this._cache = [];
        this._emitter = new node_events_1.EventEmitter;
        this._port = port;
        this._purge = purge_ival ?? null;
        this._subs = new Map();
        this._wss = null;
        this.conn = 0;
    }
    get cache() {
        return this._cache;
    }
    get subs() {
        return this._subs;
    }
    get url() {
        return `${HOST}:${this._port}`;
    }
    get wss() {
        if (this._wss === null) {
            throw new Error('websocket server not initialized');
        }
        return this._wss;
    }
    async start() {
        this._wss = new ws_1.WebSocketServer({ port: this._port });
        DEBUG && console.log('[ relay ] running on port:', this._port);
        this.wss.on('connection', socket => {
            const instance = new ClientSession(this, socket);
            socket.on('message', msg => instance._handler(msg.toString()));
            socket.on('error', err => instance._onerr(err));
            socket.on('close', code => instance._cleanup(code));
            this.conn += 1;
        });
        return new Promise(res => {
            this.wss.on('listening', () => {
                if (this._purge !== null) {
                    DEBUG && console.log(`[ relay ] purging events every ${this._purge} seconds`);
                    setInterval(() => {
                        this._cache = [];
                    }, this._purge * 1000);
                }
                this._emitter.emit('connected');
                res(this);
            });
        });
    }
    onconnect(cb) {
        this._emitter.on('connected', cb);
    }
    close() {
        return new Promise(async (resolve) => {
            // Close all existing client connections
            if (this._wss) {
                // Close all client connections first
                if (this._wss.clients && this._wss.clients.size > 0) {
                    DEBUG && console.log(`[ relay ] closing ${this._wss.clients.size} active connections`);
                    const closePromises = [];
                    this._wss.clients.forEach(client => {
                        closePromises.push(new Promise((resolveClient) => {
                            try {
                                // Send close frame and terminate
                                client.close(1000, 'Server shutting down');
                                // Add backup termination after a short timeout
                                setTimeout(() => {
                                    if (client.readyState !== ws_1.WebSocket.CLOSED) {
                                        try {
                                            client.terminate();
                                        }
                                        catch (e) {
                                            // Ignore errors during termination
                                        }
                                    }
                                    resolveClient();
                                }, 200);
                            }
                            catch (e) {
                                // Ignore errors during client termination
                                resolveClient();
                            }
                        }));
                    });
                    // Wait for all clients to terminate with a timeout
                    await Promise.race([
                        Promise.all(closePromises),
                        new Promise(r => setTimeout(r, 1000)) // Fallback timeout
                    ]);
                }
                // Close the server and resolve when closed
                this._wss.close(() => {
                    this._wss = null;
                    // Clear subscriptions and cache
                    this._subs.clear();
                    this._cache = [];
                    DEBUG && console.log('[ relay ] closed and cleaned up');
                    // Ensure we release all event listeners
                    this._emitter.removeAllListeners();
                    // Add a small delay to ensure all resources are properly released
                    setTimeout(resolve, 300);
                });
            }
            else {
                // If server was never created, resolve immediately
                resolve();
            }
        });
    }
    store(event) {
        this._cache = this._cache.concat(event).sort((a, b) => a > b ? -1 : 1);
    }
}
exports.NostrRelay = NostrRelay;
/* ================ [ Instance Class ] ================ */
class ClientSession {
    constructor(relay, socket) {
        this._relay = relay;
        this._sid = Math.random().toString().slice(2, 8);
        this._socket = socket;
        this._subs = new Set();
        this.log.client('client connected');
    }
    get sid() {
        return this._sid;
    }
    get relay() {
        return this._relay;
    }
    get socket() {
        return this._socket;
    }
    _cleanup(code) {
        this.socket.close();
        for (const subId of this._subs) {
            this.remSub(subId);
        }
        this.relay.conn -= 1;
        this.log.client(`[ ${this._sid} ]`, 'client disconnected with code:', code);
    }
    _handler(message) {
        let parsed;
        try {
            parsed = JSON.parse(message);
            DEBUG && console.log(`[ ${this._sid} ]`, 'received:', parsed);
        }
        catch (e) {
            DEBUG && console.log(`[ ${this._sid} ]`, 'message is not JSON:', message);
            return this.socket.send(JSON.stringify(['NOTICE', 'invalid: message is not JSON']));
        }
        if (!Array.isArray(parsed) || parsed.length === 0) {
            DEBUG && console.log(`[ ${this._sid} ]`, 'message is not an array:', parsed);
            return this.socket.send(JSON.stringify(['NOTICE', 'invalid: message is not an array']));
        }
        switch (parsed[0]) {
            case 'EVENT': {
                if (parsed.length !== 2) {
                    DEBUG && console.log(`[ ${this._sid} ]`, 'EVENT message missing params:', parsed);
                    return this.socket.send(JSON.stringify(['NOTICE', 'invalid: EVENT message missing params']));
                }
                this._onevent(parsed[1]);
                return;
            }
            case 'REQ': {
                if (parsed.length < 2) {
                    DEBUG && console.log(`[ ${this._sid} ]`, 'REQ message missing params:', parsed);
                    return this.socket.send(JSON.stringify(['NOTICE', 'invalid: REQ message missing params']));
                }
                const sub_id = parsed[1];
                const filters = parsed.slice(2);
                this._onreq(sub_id, filters);
                return;
            }
            case 'CLOSE': {
                if (parsed.length !== 2) {
                    DEBUG && console.log(`[ ${this._sid} ]`, 'CLOSE message missing params:', parsed);
                    return this.socket.send(JSON.stringify(['NOTICE', 'invalid: CLOSE message missing params']));
                }
                const sub_id = parsed[1];
                this._onclose(sub_id);
                return;
            }
            // For NIP-46 we don't need to validate the structure, just broadcast the event
            default: {
                // Broadcast the event to all clients so NIP-46 can work
                this.relay.wss.clients.forEach(client => {
                    if (client !== this.socket && client.readyState === ws_1.WebSocket.OPEN) {
                        client.send(message);
                    }
                });
                return;
            }
        }
    }
    _onclose(sub_id) {
        this.log.info('closed subscription:', sub_id);
        this.remSub(sub_id);
    }
    _onerr(err) {
        this.log.info('socket encountered an error:\n\n', err);
    }
    _onevent(event) {
        try {
            // For NIP-46 events (kind 24133), skip validation and just store/broadcast
            if (event.kind === 24133) {
                this.relay.store(event);
                // Find subscriptions that match this event and notify them
                for (const [uid, sub] of this.relay.subs.entries()) {
                    const subFilters = sub.filters;
                    // Check if the subscription is interested in this event
                    for (const filter of subFilters) {
                        if (filter.kinds?.includes(24133)) {
                            // If subscription has a #p filter, make sure the event has that p tag
                            const pFilters = Object.entries(filter)
                                .filter(([key]) => key === '#p')
                                .map(([_, value]) => value)
                                .flat();
                            if (pFilters.length > 0) {
                                // Only send if the event has a matching p tag
                                const eventPTags = event.tags
                                    .filter((tag) => tag[0] === 'p')
                                    .map((tag) => tag[1]);
                                if (!pFilters.some(p => eventPTags.includes(p))) {
                                    continue;
                                }
                            }
                            // Send the event to this subscription
                            const [clientId, subId] = uid.split('/');
                            if (clientId === this.sid) {
                                this.send(['EVENT', subId, event]);
                            }
                            else {
                                // Find the client session and send
                                Array.from(this.relay.wss.clients)
                                    .forEach(client => {
                                    client.send(JSON.stringify(['EVENT', subId, event]));
                                });
                            }
                            DEBUG && this.log.debug(`Sent event to subscription ${uid}`);
                            break;
                        }
                    }
                }
                // Send OK message
                this.socket.send(JSON.stringify(['OK', event.id, true, '']));
                return;
            }
            // For regular events, validate as usual
            if (!verify_event(event)) {
                this.log.client('event has invalid signature');
                return;
            }
            VERBOSE && this.log.raw('received event:', event);
            // Do we already have this event?
            if (this.relay.cache.some(e => e.id === event.id)) {
                this.log.client('event already in cache');
                this.send(['OK', event.id, false, 'duplicate']);
                return;
            }
            // Store and broadcast event
            this.relay.store(event);
            this.send(['OK', event.id, true, '']);
        }
        catch (error) {
            console.error('Failed to process event:', error);
        }
    }
    _onreq(sub_id, filters) {
        if (filters.length === 0) {
            this.log.client('request has no filters');
            return;
        }
        // Add subscription
        this.addSub(sub_id, ...filters);
        // Send all matching events from the cache
        let count = 0;
        for (const event of this.relay.cache) {
            for (const filter of filters) {
                if (match_filter(event, filter)) {
                    count += 1;
                    this.send(['EVENT', sub_id, event]);
                }
            }
        }
        // Handle NIP-46 subscriptions (kind 24133)
        const has24133Filter = filters.some(f => f.kinds?.includes(24133));
        if (has24133Filter) {
            // Send NIP-46 specific message to confirm subscription
            this.send(['EOSE', sub_id]);
            return;
        }
        DEBUG && this.log.debug(`sent ${count} matching events from cache`);
        // Signal end of stored events
        if (count === 0 || filters.some(f => f.limit && f.limit !== 0)) {
            this.send(['EOSE', sub_id]);
        }
    }
    get log() {
        return {
            client: (...msg) => VERBOSE && console.log(`[ client ][ ${this._sid} ]`, ...msg),
            debug: (...msg) => DEBUG && console.log(`[ debug  ][ ${this._sid} ]`, ...msg),
            info: (...msg) => VERBOSE && console.log(`[ info   ][ ${this._sid} ]`, ...msg),
            raw: (...msg) => VERBOSE && console.log(`[ raw    ][ ${this._sid} ]`, ...msg),
        };
    }
    addSub(sub_id, ...filters) {
        const uid = `${this.sid}/${sub_id}`;
        this.relay.subs.set(uid, { filters, instance: this, sub_id });
        this._subs.add(sub_id);
    }
    remSub(subId) {
        this.relay.subs.delete(subId);
        this._subs.delete(subId);
    }
    send(message) {
        try {
            const json = JSON.stringify(message);
            DEBUG && this.log.debug('sending:', message);
            this.socket.send(json);
        }
        catch (error) {
            console.error(`Failed to send message to client ${this._sid}:`, error);
        }
        return this;
    }
}
/* ================ [ Methods ] ================ */
function assert(value) {
    if (value === false)
        throw new Error('assertion failed!');
}
function match_filter(event, filter = {}) {
    const { authors, ids, kinds, since, until, limit, ...rest } = filter;
    const tag_filters = Object.entries(rest)
        .filter(e => e[0].startsWith('#'))
        .map(e => [e[0].slice(1, 2), ...e[1]]);
    if (ids !== undefined && !ids.includes(event.id)) {
        return false;
    }
    else if (since !== undefined && event.created_at < since) {
        return false;
    }
    else if (until !== undefined && event.created_at > until) {
        return false;
    }
    else if (authors !== undefined && !authors.includes(event.pubkey)) {
        return false;
    }
    else if (kinds !== undefined && !kinds.includes(event.kind)) {
        return false;
    }
    else if (tag_filters.length > 0) {
        return match_tags(tag_filters, event.tags);
    }
    else {
        return true;
    }
}
function match_tags(filters, tags) {
    for (const [key, ...terms] of filters) {
        for (const [tag, ...params] of tags) {
            if (tag === key) {
                for (const term of terms) {
                    if (!params.includes(term)) {
                        return false;
                    }
                }
            }
        }
    }
    return true;
}
function verify_event(event) {
    const { content, created_at, id, kind, pubkey, sig, tags } = event;
    const pimg = JSON.stringify([0, pubkey, created_at, kind, tags, content]);
    const dig = Buffer.from((0, sha256_1.sha256)(pimg)).toString('hex');
    if (dig !== id)
        return false;
    return secp256k1_1.schnorr.verify(sig, id, pubkey);
}
