"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Nip07Nostr = void 0;
const nostr_1 = require("../client/nostr");
const nip07 = __importStar(require("./index"));
/**
 * NIP-07 enabled Nostr client that uses browser extension for signing
 * and key management instead of keeping keys in memory
 */
class Nip07Nostr extends nostr_1.Nostr {
    /**
     * Creates a new Nostr client that uses NIP-07 browser extension
     * @param relayUrls Array of relay URLs to connect to
     * @throws Error if NIP-07 extension is not available
     */
    constructor(relayUrls = []) {
        // Initialize with default constructor
        super(relayUrls);
        if (!nip07.hasNip07Support()) {
            throw new Error('NIP-07 extension not available in this browser');
        }
    }
    /**
     * Initialize the client with the public key from the NIP-07 extension
     * @returns The initialized public key
     */
    async initializeWithNip07() {
        try {
            this.nip07PublicKey = await nip07.getPublicKey();
            // Store the public key but don't set an empty private key
            // as that would cause issues with validation
            return this.nip07PublicKey;
        }
        catch (error) {
            throw new Error(`Failed to initialize with NIP-07 extension: ${error}`);
        }
    }
    /**
     * Override getPublicKey to use the NIP-07 public key
     * @returns The public key from NIP-07 extension
     */
    getPublicKey() {
        return this.nip07PublicKey;
    }
    /**
     * Override setPrivateKey to prevent setting private key directly
     * @throws Error as private key can't be set manually with NIP-07
     */
    setPrivateKey(_privateKey) {
        throw new Error('Cannot set private key directly when using NIP-07 extension');
    }
    /**
     * Override generateKeys to use NIP-07 extension
     * @returns Object with publicKey (privateKey is empty string)
     */
    async generateKeys() {
        const publicKey = await this.initializeWithNip07();
        // Return object with empty privateKey as it's managed by extension
        return { publicKey, privateKey: '' };
    }
    /**
     * Publishes a text note using the NIP-07 extension for signing
     * @param content Content of the note
     * @param tags Optional tags to add to the note
     * @returns The published event or null if failed
     */
    async publishTextNote(content, tags = []) {
        // Ensure we have the public key
        if (!this.nip07PublicKey) {
            await this.initializeWithNip07();
        }
        const event = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags,
            content
        };
        try {
            const signedEvent = await nip07.signEvent(event);
            await this.publishEvent(signedEvent);
            return signedEvent;
        }
        catch (error) {
            console.error('Failed to publish text note:', error);
            return null;
        }
    }
    /**
     * Publishes a direct message to a recipient using the NIP-07 extension
     * @param content Message content
     * @param recipientPubkey Recipient's public key
     * @param tags Additional tags
     * @returns The published event or null if failed
     */
    async publishDirectMessage(content, recipientPubkey, tags = []) {
        // Ensure we have the public key
        if (!this.nip07PublicKey) {
            await this.initializeWithNip07();
        }
        try {
            // Try to use NIP-44 encryption if available
            let encryptedContent;
            try {
                encryptedContent = await nip07.encryptNip44(recipientPubkey, content);
            }
            catch (e) {
                // Fall back to NIP-04 if NIP-44 is not available
                encryptedContent = await nip07.encryptNip04(recipientPubkey, content);
            }
            // Add recipient tag if not already included
            const recipientTag = ['p', recipientPubkey];
            const updatedTags = [...tags];
            if (!updatedTags.some(tag => tag[0] === 'p' && tag[1] === recipientPubkey)) {
                updatedTags.push(recipientTag);
            }
            const event = {
                kind: 4,
                created_at: Math.floor(Date.now() / 1000),
                tags: updatedTags,
                content: encryptedContent
            };
            const signedEvent = await nip07.signEvent(event);
            await this.publishEvent(signedEvent);
            return signedEvent;
        }
        catch (error) {
            console.error('Failed to publish direct message:', error);
            return null;
        }
    }
    /**
     * Decrypt a direct message using the NIP-07 extension
     * @param event The encrypted message event
     * @returns The decrypted content
     * @throws Error if decryption fails
     */
    decryptDirectMessage(event) {
        if (event.kind !== 4) {
            throw new Error('Event is not a direct message (kind 4)');
        }
        // Return a Promise.then pattern that resolves synchronously
        try {
            // In a direct message, we need to return a string, not a Promise
            // However, the NIP-07 extension functions are async
            // We'll throw an error instructing to use decryptDirectMessageAsync instead
            throw new Error('With NIP-07, use decryptDirectMessageAsync instead');
        }
        catch (error) {
            throw new Error(`Cannot decrypt synchronously with NIP-07. Use decryptDirectMessageAsync: ${error}`);
        }
    }
    /**
     * Async version of decryptDirectMessage that works with NIP-07
     * @param event The encrypted message event
     * @returns Promise resolving to the decrypted content
     */
    async decryptDirectMessageAsync(event) {
        if (event.kind !== 4) {
            throw new Error('Event is not a direct message (kind 4)');
        }
        const senderPubkey = event.pubkey;
        try {
            // Try NIP-44 first, fall back to NIP-04
            try {
                return await nip07.decryptNip44(senderPubkey, event.content);
            }
            catch (e) {
                return await nip07.decryptNip04(senderPubkey, event.content);
            }
        }
        catch (error) {
            throw new Error(`Failed to decrypt message: ${error}`);
        }
    }
}
exports.Nip07Nostr = Nip07Nostr;
