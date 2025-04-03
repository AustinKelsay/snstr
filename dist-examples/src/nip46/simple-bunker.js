"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleNIP46Bunker = void 0;
const nostr_1 = require("../client/nostr");
const nip04_1 = require("../nip04");
const request_response_1 = require("./utils/request-response");
const logger_1 = require("./utils/logger");
const event_1 = require("../utils/event");
/**
 * Simple implementation of a NIP-46 bunker (remote signer)
 *
 * This class implements the signer-side of the NIP-46 Remote Signing protocol.
 * It is designed to be lightweight and easy to use.
 */
class SimpleNIP46Bunker {
    /**
     * Create a new SimpleNIP46Bunker
     *
     * @param relays - Array of relay URLs to connect to
     * @param userPubkey - The user's public key
     * @param signerPubkey - Optional separate signer public key (defaults to user pubkey)
     * @param options - Bunker options
     */
    constructor(relays, userPubkey, signerPubkey, options = {}) {
        this.relays = relays;
        this.nostr = new nostr_1.Nostr(relays);
        this.userKeys = { publicKey: userPubkey, privateKey: '' };
        this.signerKeys = { publicKey: signerPubkey || userPubkey, privateKey: '' };
        this.clients = new Map();
        this.defaultPermissions = new Set(options.defaultPermissions || []);
        this.subId = null;
        this.secret = options.secret;
        this.logger = new logger_1.Logger({
            prefix: 'Bunker',
            level: options.logLevel || logger_1.LogLevel.INFO
        });
    }
    /**
     * Start the bunker and listen for requests
     */
    async start() {
        // Validate keys
        if (!this.userKeys.publicKey) {
            throw new Error('User public key not set');
        }
        if (!this.signerKeys.publicKey) {
            throw new Error('Signer public key not set');
        }
        try {
            // Connect to relays
            await this.nostr.connectToRelays();
            // Subscribe to requests
            const filter = {
                kinds: [24133],
                '#p': [this.signerKeys.publicKey]
            };
            const subIds = this.nostr.subscribe([filter], (event) => this.handleRequest(event));
            this.subId = subIds[0];
            this.logger.info(`Bunker started for ${this.signerKeys.publicKey} on ${this.relays.length} relay(s)`);
            return;
        }
        catch (error) {
            this.logger.error(`Failed to start bunker:`, error.message);
            throw error;
        }
    }
    /**
     * Stop the bunker
     */
    async stop() {
        if (this.subId) {
            try {
                this.nostr.unsubscribe([this.subId]);
            }
            catch (e) {
                // Ignore unsubscribe errors
            }
            this.subId = null;
        }
        try {
            await this.nostr.disconnectFromRelays();
            this.logger.info(`Bunker stopped`);
        }
        catch (error) {
            this.logger.warn(`Error disconnecting from relays:`, error.message);
            // Continue despite errors
        }
        // Clear client sessions
        this.clients.clear();
    }
    /**
     * Get a connection string for clients
     */
    getConnectionString() {
        const relayParams = this.relays.map(relay => `relay=${encodeURIComponent(relay)}`).join('&');
        const secretParam = this.secret ? `&secret=${encodeURIComponent(this.secret)}` : '';
        return `bunker://${this.signerKeys.publicKey}?${relayParams}${secretParam}`;
    }
    /**
     * Set the user's private key
     */
    setUserPrivateKey(privateKey) {
        this.userKeys.privateKey = privateKey;
    }
    /**
     * Set the signer's private key
     */
    setSignerPrivateKey(privateKey) {
        this.signerKeys.privateKey = privateKey;
    }
    /**
     * Set default permissions for all clients
     */
    setDefaultPermissions(permissions) {
        this.defaultPermissions = new Set(permissions);
    }
    /**
     * Add a permission for a specific client
     */
    addClientPermission(clientPubkey, permission) {
        const client = this.clients.get(clientPubkey);
        if (client) {
            client.permissions.add(permission);
            return true;
        }
        return false;
    }
    /**
     * Remove a permission from a specific client
     */
    removeClientPermission(clientPubkey, permission) {
        const client = this.clients.get(clientPubkey);
        if (client) {
            return client.permissions.delete(permission);
        }
        return false;
    }
    /**
     * Handle an incoming request event
     */
    async handleRequest(event) {
        try {
            this.logger.info(`Received request from ${event.pubkey}`);
            // Check if we have the signer private key
            if (!this.signerKeys.privateKey) {
                this.logger.error(`Signer private key not set`);
                return;
            }
            // Decrypt with the signer's private key and client's public key
            try {
                const decrypted = (0, nip04_1.decrypt)(event.content, this.signerKeys.privateKey, event.pubkey);
                this.logger.debug(`Decrypted content: ${decrypted}`);
                // Parse the request
                const request = JSON.parse(decrypted);
                const clientPubkey = event.pubkey;
                this.logger.debug(`Processing request: ${request.method} (${request.id})`);
                // Handle the request based on method
                let response;
                switch (request.method) {
                    case 'connect':
                        response = await this.handleConnect(request, clientPubkey);
                        break;
                    case 'get_public_key':
                        if (!this.isClientAuthorized(clientPubkey)) {
                            response = (0, request_response_1.createErrorResponse)(request.id, 'Unauthorized');
                        }
                        else {
                            this.logger.debug(`Sending pubkey: ${this.userKeys.publicKey}`);
                            response = (0, request_response_1.createSuccessResponse)(request.id, this.userKeys.publicKey);
                        }
                        break;
                    case 'ping':
                        if (!this.isClientAuthorized(clientPubkey)) {
                            response = (0, request_response_1.createErrorResponse)(request.id, 'Unauthorized');
                        }
                        else {
                            this.logger.debug(`Ping-pong`);
                            response = (0, request_response_1.createSuccessResponse)(request.id, 'pong');
                        }
                        break;
                    case 'sign_event':
                        response = await this.handleSignEvent(request, clientPubkey);
                        break;
                    case 'nip04_encrypt':
                        response = await this.handleNIP04Encrypt(request, clientPubkey);
                        break;
                    case 'nip04_decrypt':
                        response = await this.handleNIP04Decrypt(request, clientPubkey);
                        break;
                    default:
                        response = (0, request_response_1.createErrorResponse)(request.id, `Unknown method: ${request.method}`);
                }
                // Send the response
                await this.sendResponse(response, clientPubkey);
            }
            catch (error) {
                this.logger.error(`Failed to process request:`, error.message);
            }
        }
        catch (error) {
            this.logger.error(`Error handling request:`, error.message);
        }
    }
    /**
     * Handle a connect request
     */
    async handleConnect(request, clientPubkey) {
        // Extract parameters
        const [signerPubkey, secret, permissionsParam] = request.params;
        // Verify the client is connecting to the correct signer
        if (signerPubkey !== this.signerKeys.publicKey) {
            return (0, request_response_1.createErrorResponse)(request.id, 'Invalid signer pubkey');
        }
        // Check secret if required
        if (this.secret && (!secret || this.secret !== secret)) {
            return (0, request_response_1.createErrorResponse)(request.id, 'Invalid secret');
        }
        // Create a new session for this client
        const session = {
            permissions: new Set(),
            lastSeen: Date.now()
        };
        // Add default permissions
        this.defaultPermissions.forEach(p => session.permissions.add(p));
        // Add client-requested permissions (optional)
        if (permissionsParam) {
            permissionsParam.split(',').forEach(p => {
                if (p.trim())
                    session.permissions.add(p.trim());
            });
        }
        // Store client session
        this.clients.set(clientPubkey, session);
        this.logger.info(`Client connected: ${clientPubkey}`);
        return (0, request_response_1.createSuccessResponse)(request.id, 'ack');
    }
    /**
     * Handle a sign_event request
     */
    async handleSignEvent(request, clientPubkey) {
        // Check authorization
        if (!this.isClientAuthorized(clientPubkey)) {
            return (0, request_response_1.createErrorResponse)(request.id, 'Unauthorized');
        }
        // Check if we have the user's private key
        if (!this.userKeys.privateKey) {
            return (0, request_response_1.createErrorResponse)(request.id, 'User private key not set');
        }
        // Get the event data
        if (!request.params[0]) {
            return (0, request_response_1.createErrorResponse)(request.id, 'Missing event data');
        }
        try {
            // Parse the event data
            const eventData = JSON.parse(request.params[0]);
            // Check if the client has permission to sign this kind of event
            const kindPermission = `sign_event:${eventData.kind}`;
            const client = this.clients.get(clientPubkey);
            if (!client || (!client.permissions.has('sign_event') && !client.permissions.has(kindPermission))) {
                return (0, request_response_1.createErrorResponse)(request.id, `Not authorized to sign kind ${eventData.kind} events`);
            }
            this.logger.debug(`Signing event kind: ${eventData.kind}`);
            // Create the unsigned event
            const unsignedEvent = {
                kind: eventData.kind,
                content: eventData.content,
                created_at: eventData.created_at,
                tags: eventData.tags || [],
                pubkey: this.userKeys.publicKey,
            };
            // Set the private key on the Nostr instance for signing
            this.nostr.setPrivateKey(this.userKeys.privateKey);
            // Create a signed event using createSignedEvent
            const signedEvent = await (0, event_1.createSignedEvent)(unsignedEvent, this.userKeys.privateKey);
            this.logger.debug(`Event signed successfully`);
            // Return the signed event
            return (0, request_response_1.createSuccessResponse)(request.id, JSON.stringify(signedEvent));
        }
        catch (error) {
            return (0, request_response_1.createErrorResponse)(request.id, `Failed to sign event: ${error.message}`);
        }
    }
    /**
     * Handle a nip04_encrypt request
     */
    async handleNIP04Encrypt(request, clientPubkey) {
        // Check authorization
        if (!this.isClientAuthorized(clientPubkey)) {
            return (0, request_response_1.createErrorResponse)(request.id, 'Unauthorized');
        }
        // Check if client has encryption permission
        const client = this.clients.get(clientPubkey);
        if (!client || !client.permissions.has('nip04_encrypt')) {
            return (0, request_response_1.createErrorResponse)(request.id, 'Not authorized for NIP-04 encryption');
        }
        // Check if we have the user's private key
        if (!this.userKeys.privateKey) {
            return (0, request_response_1.createErrorResponse)(request.id, 'User private key not set');
        }
        // Check parameters
        if (request.params.length < 2) {
            return (0, request_response_1.createErrorResponse)(request.id, 'Missing parameters');
        }
        const [recipient, plaintext] = request.params;
        try {
            // Encrypt the message
            const encrypted = (0, nip04_1.encrypt)(plaintext, this.userKeys.privateKey, recipient);
            this.logger.debug(`NIP-04 encryption successful`);
            return (0, request_response_1.createSuccessResponse)(request.id, encrypted);
        }
        catch (error) {
            return (0, request_response_1.createErrorResponse)(request.id, `NIP-04 encryption failed: ${error.message}`);
        }
    }
    /**
     * Handle a nip04_decrypt request
     */
    async handleNIP04Decrypt(request, clientPubkey) {
        // Check authorization
        if (!this.isClientAuthorized(clientPubkey)) {
            return (0, request_response_1.createErrorResponse)(request.id, 'Unauthorized');
        }
        // Check if client has decryption permission
        const client = this.clients.get(clientPubkey);
        if (!client || !client.permissions.has('nip04_decrypt')) {
            return (0, request_response_1.createErrorResponse)(request.id, 'Not authorized for NIP-04 decryption');
        }
        // Check parameters
        if (request.params.length < 2) {
            return (0, request_response_1.createErrorResponse)(request.id, 'Missing parameters');
        }
        const [sender, ciphertext] = request.params;
        try {
            // Decrypt the message
            const decrypted = (0, nip04_1.decrypt)(ciphertext, this.userKeys.privateKey, sender);
            this.logger.debug(`NIP-04 decryption successful`);
            return (0, request_response_1.createSuccessResponse)(request.id, decrypted);
        }
        catch (error) {
            return (0, request_response_1.createErrorResponse)(request.id, `NIP-04 decryption failed: ${error.message}`);
        }
    }
    /**
     * Send a response to a client
     */
    async sendResponse(response, clientPubkey) {
        try {
            this.logger.debug(`Sending response: ${response.id} to ${clientPubkey}`);
            this.logger.trace(`Response JSON: ${JSON.stringify(response)}`);
            // Check if we have the signer private key
            if (!this.signerKeys.privateKey) {
                this.logger.error(`Signer private key not set`);
                return;
            }
            // Encrypt the response with the signer's private key and client's public key
            const encrypted = (0, nip04_1.encrypt)(JSON.stringify(response), this.signerKeys.privateKey, clientPubkey);
            // Create and send the response event
            const event = {
                kind: 24133,
                pubkey: this.signerKeys.publicKey,
                created_at: Math.floor(Date.now() / 1000),
                tags: [['p', clientPubkey]],
                content: encrypted,
                id: '',
                sig: ''
            };
            // Use the Nostr class to sign and publish the event
            this.nostr.setPrivateKey(this.signerKeys.privateKey);
            await this.nostr.publishEvent(event);
            this.logger.debug(`Response sent for request: ${response.id}`);
        }
        catch (error) {
            this.logger.error(`Failed to send response:`, error.message);
        }
    }
    /**
     * Check if a client is authorized
     */
    isClientAuthorized(clientPubkey) {
        return this.clients.has(clientPubkey);
    }
    /**
     * Set the log level
     */
    setLogLevel(level) {
        this.logger.setLevel(level);
    }
}
exports.SimpleNIP46Bunker = SimpleNIP46Bunker;
