"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Nostr = void 0;
const relay_1 = require("./relay");
const crypto_1 = require("../utils/crypto");
const nip04_1 = require("../nip04");
const event_1 = require("../utils/event");
class Nostr {
    constructor(relayUrls = []) {
        this.relays = new Map();
        relayUrls.forEach((url) => this.addRelay(url));
    }
    addRelay(url) {
        if (this.relays.has(url)) {
            return this.relays.get(url);
        }
        const relay = new relay_1.Relay(url);
        this.relays.set(url, relay);
        return relay;
    }
    removeRelay(url) {
        const relay = this.relays.get(url);
        if (relay) {
            relay.disconnect();
            this.relays.delete(url);
        }
    }
    async connectToRelays() {
        const connectPromises = Array.from(this.relays.values()).map((relay) => relay.connect());
        await Promise.all(connectPromises);
    }
    disconnectFromRelays() {
        this.relays.forEach((relay) => relay.disconnect());
    }
    setPrivateKey(privateKey) {
        this.privateKey = privateKey;
        this.publicKey = (0, crypto_1.getPublicKey)(privateKey);
    }
    async generateKeys() {
        const keypair = await (0, crypto_1.generateKeypair)();
        this.privateKey = keypair.privateKey;
        this.publicKey = keypair.publicKey;
        return keypair;
    }
    getPublicKey() {
        return this.publicKey;
    }
    async publishEvent(event) {
        try {
            const publishPromises = Array.from(this.relays.values()).map((relay) => relay.publish(event));
            await Promise.all(publishPromises);
            return event;
        }
        catch (error) {
            console.error('Failed to publish event:', error);
            return null;
        }
    }
    async publishTextNote(content, tags = []) {
        if (!this.privateKey || !this.publicKey) {
            throw new Error('Private key is not set');
        }
        const noteTemplate = (0, event_1.createTextNote)(content, tags);
        noteTemplate.pubkey = this.publicKey;
        const signedEvent = await (0, event_1.createSignedEvent)(noteTemplate, this.privateKey);
        await this.publishEvent(signedEvent);
        return signedEvent;
    }
    async publishDirectMessage(content, recipientPubkey, tags = []) {
        if (!this.privateKey || !this.publicKey) {
            throw new Error('Private key is not set');
        }
        const dmTemplate = (0, event_1.createDirectMessage)(content, recipientPubkey, this.privateKey, tags);
        dmTemplate.pubkey = this.publicKey;
        const signedEvent = await (0, event_1.createSignedEvent)(dmTemplate, this.privateKey);
        await this.publishEvent(signedEvent);
        return signedEvent;
    }
    /**
     * Decrypt a direct message received from another user
     *
     * Uses NIP-04 encryption which is the standard for kind:4 direct messages
     */
    decryptDirectMessage(event) {
        if (!this.privateKey) {
            throw new Error('Private key is not set');
        }
        if (event.kind !== 4) {
            throw new Error('Event is not a direct message (kind 4)');
        }
        // In a direct message:
        // - The sender's pubkey is in event.pubkey
        // - The recipient's pubkey is in the 'p' tag
        // We need to use our private key and the sender's pubkey to decrypt
        const senderPubkey = event.pubkey;
        // Double-check that the message was intended for us
        const pTag = event.tags.find(tag => tag[0] === 'p');
        if (!pTag || !pTag[1]) {
            throw new Error('Direct message is missing recipient pubkey in p tag');
        }
        const recipientPubkey = pTag[1];
        // If we're not the intended recipient, we shouldn't be able to decrypt this
        if (this.publicKey && recipientPubkey !== this.publicKey) {
            console.warn('This message was not intended for this user');
        }
        // Decrypt the message using our private key and the sender's pubkey
        try {
            return (0, nip04_1.decrypt)(event.content, this.privateKey, senderPubkey);
        }
        catch (error) {
            console.error('Failed to decrypt message:', error);
            throw new Error('Failed to decrypt message. Make sure you are the intended recipient.');
        }
    }
    async publishMetadata(metadata) {
        if (!this.privateKey || !this.publicKey) {
            throw new Error('Private key is not set');
        }
        const metadataTemplate = (0, event_1.createMetadataEvent)(metadata, this.privateKey);
        const signedEvent = await (0, event_1.createSignedEvent)(metadataTemplate, this.privateKey);
        await this.publishEvent(signedEvent);
        return signedEvent;
    }
    subscribe(filters, onEvent, onEOSE) {
        const subscriptionIds = [];
        this.relays.forEach((relay, url) => {
            const id = relay.subscribe(filters, (event) => onEvent(event, url), onEOSE);
            subscriptionIds.push(id);
        });
        return subscriptionIds;
    }
    unsubscribe(subscriptionIds) {
        this.relays.forEach((relay) => {
            subscriptionIds.forEach((id) => relay.unsubscribe(id));
        });
    }
    unsubscribeAll() {
        // Clear all subscriptions on all relays
        this.relays.forEach((relay) => {
            // The Relay class handles clearing its internal subscription map
            relay.disconnect();
        });
    }
    on(event, callback) {
        this.relays.forEach((relay) => {
            relay.on(event, callback);
        });
    }
}
exports.Nostr = Nostr;
