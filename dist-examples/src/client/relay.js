"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Relay = void 0;
require("websocket-polyfill");
const nostr_1 = require("../types/nostr");
class Relay {
    constructor(url) {
        this.ws = null;
        this.connected = false;
        this.subscriptions = new Map();
        this.eventHandlers = {};
        this.connectionPromise = null;
        this.url = url;
    }
    async connect() {
        if (this.connected)
            return true;
        if (this.connectionPromise)
            return this.connectionPromise;
        this.connectionPromise = new Promise((resolve) => {
            this.ws = new WebSocket(this.url);
            this.ws.onopen = () => {
                this.connected = true;
                this.connectionPromise = null;
                this.triggerEvent(nostr_1.RelayEvent.Connect, this.url);
                resolve(true);
            };
            this.ws.onclose = () => {
                this.connected = false;
                this.triggerEvent(nostr_1.RelayEvent.Disconnect, this.url);
            };
            this.ws.onerror = (error) => {
                this.triggerEvent(nostr_1.RelayEvent.Error, this.url, error);
                if (!this.connected) {
                    this.connectionPromise = null;
                    resolve(false);
                }
            };
            this.ws.onmessage = (message) => {
                try {
                    const data = JSON.parse(message.data);
                    this.handleMessage(data);
                }
                catch (error) {
                    this.triggerEvent(nostr_1.RelayEvent.Error, this.url, error);
                }
            };
        });
        return this.connectionPromise;
    }
    disconnect() {
        if (!this.ws)
            return;
        try {
            // Clear all subscriptions to prevent further processing
            this.subscriptions.clear();
            // Close the WebSocket if it's open or connecting
            if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
                // First try to send CLOSE messages for any active subscriptions
                try {
                    this.ws.close();
                }
                catch (e) {
                    // Ignore close errors, the connection might already be closed or invalid
                }
                // Reset the connection promise if it exists
                this.connectionPromise = null;
            }
        }
        catch (error) {
            console.error(`Error closing WebSocket for ${this.url}:`, error);
        }
        finally {
            // Reset all state variables
            this.ws = null;
            this.connected = false;
            this.triggerEvent(nostr_1.RelayEvent.Disconnect, this.url);
        }
    }
    on(event, callback) {
        this.eventHandlers[event] = callback;
    }
    async publish(event) {
        if (!this.connected) {
            await this.connect();
        }
        if (!this.connected || !this.ws)
            return false;
        try {
            const message = JSON.stringify(['EVENT', event]);
            this.ws.send(message);
            return true;
        }
        catch (error) {
            this.triggerEvent(nostr_1.RelayEvent.Error, this.url, error);
            return false;
        }
    }
    subscribe(filters, onEvent, onEOSE) {
        const id = Math.random().toString(36).substring(2, 15);
        const subscription = {
            id,
            filters,
            onEvent,
            onEOSE,
        };
        this.subscriptions.set(id, subscription);
        if (this.connected && this.ws) {
            const message = JSON.stringify(['REQ', id, ...filters]);
            this.ws.send(message);
        }
        return id;
    }
    unsubscribe(id) {
        if (!this.subscriptions.has(id))
            return;
        this.subscriptions.delete(id);
        if (this.connected && this.ws) {
            const message = JSON.stringify(['CLOSE', id]);
            this.ws.send(message);
        }
    }
    handleMessage(data) {
        if (!Array.isArray(data))
            return;
        const [type, ...rest] = data;
        const debug = process.env.DEBUG?.includes('nostr:*') || false;
        if (debug) {
            console.log(`Relay(${this.url}): Received message type: ${type}`);
            console.log(`Relay(${this.url}): Message data:`, JSON.stringify(rest).substring(0, 200));
        }
        switch (type) {
            case 'EVENT': {
                const [subscriptionId, event] = rest;
                if (debug) {
                    console.log(`Relay(${this.url}): Event for subscription ${subscriptionId}, kind: ${event?.kind}, id: ${event?.id?.slice(0, 8)}...`);
                }
                const subscription = this.subscriptions.get(subscriptionId);
                if (subscription) {
                    if (debug)
                        console.log(`Relay(${this.url}): Found subscription, calling onEvent handler`);
                    subscription.onEvent(event);
                }
                else {
                    if (debug)
                        console.log(`Relay(${this.url}): No subscription found for id: ${subscriptionId}`);
                }
                break;
            }
            case 'EOSE': {
                const [subscriptionId] = rest;
                if (debug)
                    console.log(`Relay(${this.url}): End of stored events for subscription ${subscriptionId}`);
                const subscription = this.subscriptions.get(subscriptionId);
                if (subscription && subscription.onEOSE) {
                    subscription.onEOSE();
                }
                break;
            }
            case 'NOTICE': {
                const [notice] = rest;
                if (debug)
                    console.log(`Relay(${this.url}): Notice: ${notice}`);
                this.triggerEvent(nostr_1.RelayEvent.Notice, this.url, notice);
                break;
            }
            default:
                if (debug)
                    console.log(`Relay(${this.url}): Unhandled message type: ${type}`);
                break;
        }
    }
    triggerEvent(event, ...args) {
        const handler = this.eventHandlers[event];
        if (handler) {
            handler(this.url, ...args);
        }
    }
}
exports.Relay = Relay;
