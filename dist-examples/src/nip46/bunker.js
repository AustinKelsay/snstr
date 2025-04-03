"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NostrRemoteSignerBunker = void 0;
const nostr_1 = require("../client/nostr");
const nip44_1 = require("../nip44");
const nip04_1 = require("../nip04");
const event_1 = require("../utils/event");
const types_1 = require("./types");
class NostrRemoteSignerBunker {
    constructor(options) {
        this.options = {
            authTimeout: 300000, // Default 5 minute timeout for auth challenges
            ...options
        };
        this.connectedClients = new Map();
        this.pendingAuthChallenges = new Map();
        this.nostr = new nostr_1.Nostr(options.relays || []);
        this.preferredEncryption = options.preferredEncryption || 'nip44';
        this.subId = null;
        // Initialize keypairs with empty private keys
        this.userKeypair = {
            publicKey: options.userPubkey,
            privateKey: ''
        };
        // Initialize signer keypair - can be the same as user keypair 
        // or a dedicated keypair for the signer
        this.signerKeypair = {
            publicKey: options.signerPubkey || options.userPubkey,
            privateKey: ''
        };
    }
    /**
     * Get the public key of the signer
     */
    getSignerPubkey() {
        return this.signerKeypair.publicKey;
    }
    async start() {
        if (!this.signerKeypair.privateKey) {
            throw new Error('Signer private key not set');
        }
        // Connect to relays
        await this.nostr.connectToRelays();
        // Subscribe to requests
        const filter = {
            kinds: [24133],
            '#p': [this.signerKeypair.publicKey]
        };
        // Clean up any existing subscription
        if (this.subId) {
            this.nostr.unsubscribe([this.subId]);
        }
        // Subscribe to incoming requests
        this.subId = this.nostr.subscribe([filter], (event) => this.handleRequest(event))[0];
        // Publish metadata if needed
        if (this.options.metadata) {
            await this.publishMetadata(this.options.metadata);
        }
        // Start cleanup interval
        setInterval(() => this.cleanup(), 300000); // Run cleanup every 5 minutes
    }
    async stop() {
        if (this.subId) {
            this.nostr.unsubscribe([this.subId]);
            this.subId = null;
        }
        if (this.nostr) {
            this.nostr.disconnectFromRelays();
        }
        this.connectedClients.clear();
        this.pendingAuthChallenges.clear();
    }
    /**
     * Set the user's private key
     */
    setUserPrivateKey(privateKey) {
        this.userKeypair.privateKey = privateKey;
    }
    /**
     * Set the signer's private key
     */
    setSignerPrivateKey(privateKey) {
        this.signerKeypair.privateKey = privateKey;
    }
    /**
     * Initialize both user and signer private keys
     */
    setPrivateKeys(userPrivateKey, signerPrivateKey) {
        this.setUserPrivateKey(userPrivateKey);
        this.setSignerPrivateKey(signerPrivateKey || userPrivateKey);
    }
    /**
     * Resolves an authentication challenge for a user
     * @param pubkey The public key of the user to resolve the auth challenge for
     * @returns boolean indicating if any challenge was resolved
     */
    resolveAuthChallenge(pubkey) {
        let resolved = false;
        // Find all pending challenges for this pubkey
        this.pendingAuthChallenges.forEach((challenge, id) => {
            if (challenge.clientPubkey === pubkey) {
                // Get or create a client session
                let clientSession = this.connectedClients.get(pubkey);
                if (!clientSession) {
                    // Create a new session if one doesn't exist
                    clientSession = {
                        permissions: new Set(),
                        lastSeen: Date.now(),
                        preferredEncryption: this.preferredEncryption
                    };
                }
                // Add the requested permissions to the client
                if (challenge.permissions) {
                    challenge.permissions.forEach(permission => {
                        clientSession.permissions.add(permission);
                    });
                }
                // Add default permissions if configured
                if (this.options.defaultPermissions) {
                    this.options.defaultPermissions.forEach(permission => {
                        clientSession.permissions.add(permission);
                    });
                }
                // Update the client session
                this.connectedClients.set(pubkey, clientSession);
                // Send a success response to the client
                this.sendResponse(challenge.clientPubkey, challenge.id, 'ack').catch(console.error);
                // Remove the challenge
                this.pendingAuthChallenges.delete(id);
                resolved = true;
            }
        });
        return resolved;
    }
    cleanup() {
        const now = Date.now();
        // Clean up stale clients
        this.connectedClients.forEach((client, clientPubkey) => {
            if (now - client.lastSeen > 3600000) { // 1 hour timeout
                this.connectedClients.delete(clientPubkey);
            }
        });
        // Clean up stale auth challenges
        this.pendingAuthChallenges.forEach((challenge, id) => {
            if (now - challenge.timestamp > (this.options.authTimeout || 300000)) {
                this.pendingAuthChallenges.delete(id);
            }
        });
    }
    async handleRequest(event) {
        if (!this.signerKeypair || !this.signerKeypair.privateKey) {
            console.error('Received request but bunker is not properly initialized');
            return;
        }
        try {
            // Try to decrypt request using both methods
            let decrypted = null;
            let error = null;
            // Try NIP-44 first
            try {
                decrypted = (0, nip44_1.decrypt)(event.content, this.signerKeypair.privateKey, event.pubkey);
                this.preferredEncryption = 'nip44';
            }
            catch (e) {
                error = e;
            }
            // Fall back to NIP-04 if NIP-44 fails
            if (!decrypted) {
                try {
                    decrypted = (0, nip04_1.decrypt)(event.content, this.signerKeypair.privateKey, event.pubkey);
                    this.preferredEncryption = 'nip04';
                }
                catch (e) {
                    // If both methods fail, use the first error
                    if (error) {
                        console.error('Failed to decrypt request:', error);
                        return;
                    }
                    console.error('Failed to decrypt request:', e);
                    return;
                }
            }
            if (!decrypted) {
                console.error('Failed to decrypt request: No decryption method succeeded');
                return;
            }
            const request = JSON.parse(decrypted);
            // Check if client is authorized
            const clientPubkey = event.pubkey;
            const clientSession = this.connectedClients.get(clientPubkey);
            // Special case for connect requests - they're allowed without a session
            if (request.method === types_1.NIP46Method.CONNECT) {
                const response = await this.handleConnect(request, clientPubkey);
                await this.sendResponse(clientPubkey, request.id, response.result, response.error);
                return;
            }
            // For all other requests, require an active session
            if (!clientSession) {
                await this.sendResponse(clientPubkey, request.id, null, 'Not connected');
                return;
            }
            // Update last seen time
            clientSession.lastSeen = Date.now();
            // Handle other request types
            switch (request.method) {
                case types_1.NIP46Method.SIGN_EVENT:
                    const signResponse = await this.handleSignEvent(request, clientPubkey);
                    await this.sendResponse(clientPubkey, request.id, signResponse.result, signResponse.error, signResponse.auth_url);
                    break;
                case types_1.NIP46Method.GET_PUBLIC_KEY:
                    const pubkeyResponse = await this.handleGetPublicKey(request);
                    await this.sendResponse(clientPubkey, request.id, pubkeyResponse.result, pubkeyResponse.error);
                    break;
                case types_1.NIP46Method.PING:
                    await this.sendResponse(clientPubkey, request.id, 'pong');
                    break;
                case types_1.NIP46Method.NIP04_ENCRYPT:
                case types_1.NIP46Method.NIP04_DECRYPT:
                case types_1.NIP46Method.NIP44_ENCRYPT:
                case types_1.NIP46Method.NIP44_DECRYPT:
                    const encResponse = await this.handleEncryption(request, clientPubkey);
                    await this.sendResponse(clientPubkey, request.id, encResponse.result, encResponse.error);
                    break;
                default:
                    await this.sendResponse(clientPubkey, request.id, null, `Unknown method: ${request.method}`);
            }
        }
        catch (error) {
            try {
                await this.sendResponse(event.pubkey, error.requestId || '', null, `Error: ${error.message || 'Unknown error'}`);
            }
            catch (sendError) {
                console.error('Failed to send error response:', sendError);
            }
        }
    }
    async handleConnect(request, clientPubkey) {
        // Extract parameters
        const [signerPubkey, secret, permissionsStr] = request.params;
        // Verify the client is connecting to the correct signer
        if (signerPubkey !== this.signerKeypair.publicKey) {
            return {
                id: request.id,
                error: 'Invalid signer pubkey'
            };
        }
        // Check secret if required
        if (this.options.secret) {
            if (!secret || this.options.secret !== secret) {
                return {
                    id: request.id,
                    error: 'Invalid secret'
                };
            }
        }
        // If auth challenges are required, create and send a challenge
        if (this.options.requireAuthChallenge && this.options.authUrl) {
            // Parse requested permissions
            const requestedPermissions = permissionsStr ?
                permissionsStr.split(',').filter(p => p.trim()) :
                [];
            // Create auth challenge
            const challenge = {
                id: request.id,
                clientPubkey,
                timestamp: Date.now(),
                permissions: requestedPermissions
            };
            // Store the challenge
            this.pendingAuthChallenges.set(request.id, challenge);
            // Return auth challenge response
            return {
                id: request.id,
                auth_url: this.options.authUrl
            };
        }
        // Create a new session for this client
        const permissions = new Set();
        // Add default permissions
        if (this.options.defaultPermissions) {
            this.options.defaultPermissions.forEach(p => permissions.add(p));
        }
        // Add client-requested permissions (optional)
        if (permissionsStr) {
            permissionsStr.split(',').forEach(p => {
                if (p.trim())
                    permissions.add(p.trim());
            });
        }
        // Store client session
        this.connectedClients.set(clientPubkey, {
            permissions,
            lastSeen: Date.now(),
            preferredEncryption: this.preferredEncryption
        });
        // Return success response (with secret for nostrconnect validation)
        return {
            id: request.id,
            result: secret || 'ack'
        };
    }
    async handleSignEvent(request, clientPubkey) {
        const client = this.connectedClients.get(clientPubkey);
        if (!client) {
            return {
                id: request.id,
                error: 'Client not connected'
            };
        }
        try {
            // Parse event data
            const eventData = JSON.parse(request.params[0]);
            // Check permissions
            const requiredPerm = `sign_event:${eventData.kind}`;
            const hasSpecificPerm = client.permissions.has(requiredPerm);
            const hasGenericPerm = client.permissions.has('sign_event');
            if (!hasSpecificPerm && !hasGenericPerm) {
                // If auth URL is configured and auth challenges required, allow client to re-authenticate
                if (this.options.authUrl && this.options.requireAuthChallenge) {
                    const challenge = {
                        id: request.id,
                        clientPubkey,
                        timestamp: Date.now(),
                        permissions: [requiredPerm]
                    };
                    this.pendingAuthChallenges.set(request.id, challenge);
                    return {
                        id: request.id,
                        auth_url: this.options.authUrl
                    };
                }
                return {
                    id: request.id,
                    error: `Permission denied for kind ${eventData.kind}`
                };
            }
            // Prepare event for signing
            const event = {
                ...eventData,
                pubkey: this.userKeypair.publicKey,
                created_at: eventData.created_at || Math.floor(Date.now() / 1000),
                tags: eventData.tags || []
            };
            // Sign the event
            const signedEvent = await (0, event_1.createSignedEvent)(event, this.userKeypair.privateKey);
            return {
                id: request.id,
                result: JSON.stringify(signedEvent)
            };
        }
        catch (error) {
            return {
                id: request.id,
                error: `Failed to sign event: ${error.message}`
            };
        }
    }
    async handleGetPublicKey(request) {
        return {
            id: request.id,
            result: this.userKeypair.publicKey
        };
    }
    async handleEncryption(request, clientPubkey) {
        const client = this.connectedClients.get(clientPubkey);
        if (!client) {
            return {
                id: request.id,
                error: 'Client not connected'
            };
        }
        // Check permissions
        if (!client.permissions.has(request.method)) {
            return {
                id: request.id,
                error: `Permission denied for ${request.method}`
            };
        }
        try {
            const [thirdPartyPubkey, content] = request.params;
            let result;
            switch (request.method) {
                case types_1.NIP46Method.NIP04_ENCRYPT:
                    result = (0, nip04_1.encrypt)(content, this.userKeypair.privateKey, thirdPartyPubkey);
                    break;
                case types_1.NIP46Method.NIP04_DECRYPT:
                    result = (0, nip04_1.decrypt)(content, this.userKeypair.privateKey, thirdPartyPubkey);
                    break;
                case types_1.NIP46Method.NIP44_ENCRYPT:
                    result = (0, nip44_1.encrypt)(content, this.userKeypair.privateKey, thirdPartyPubkey);
                    break;
                case types_1.NIP46Method.NIP44_DECRYPT:
                    result = (0, nip44_1.decrypt)(content, this.userKeypair.privateKey, thirdPartyPubkey);
                    break;
                default:
                    return {
                        id: request.id,
                        error: 'Invalid encryption method'
                    };
            }
            return {
                id: request.id,
                result
            };
        }
        catch (error) {
            return {
                id: request.id,
                error: `Encryption operation failed: ${error.message}`
            };
        }
    }
    async sendResponse(clientPubkey, id, result = null, error, auth_url) {
        if (!this.signerKeypair || !this.signerKeypair.privateKey) {
            throw new Error('Bunker not properly initialized');
        }
        const response = {
            id,
            result: result === null ? undefined : result,
            error,
            auth_url
        };
        try {
            // Get client's preferred encryption method if available
            const client = this.connectedClients.get(clientPubkey);
            const encMethod = client?.preferredEncryption || this.preferredEncryption;
            // Try to encrypt response using both methods
            let encryptedContent = null;
            let encError = null;
            // Try preferred method first
            try {
                if (encMethod === 'nip44') {
                    encryptedContent = (0, nip44_1.encrypt)(JSON.stringify(response), this.signerKeypair.privateKey, clientPubkey);
                }
                else {
                    encryptedContent = (0, nip04_1.encrypt)(JSON.stringify(response), this.signerKeypair.privateKey, clientPubkey);
                }
            }
            catch (e) {
                encError = e;
            }
            // Try fallback method if preferred method fails
            if (!encryptedContent) {
                try {
                    if (encMethod === 'nip44') {
                        encryptedContent = (0, nip04_1.encrypt)(JSON.stringify(response), this.signerKeypair.privateKey, clientPubkey);
                        if (client) {
                            client.preferredEncryption = 'nip04';
                        }
                        this.preferredEncryption = 'nip04';
                    }
                    else {
                        encryptedContent = (0, nip44_1.encrypt)(JSON.stringify(response), this.signerKeypair.privateKey, clientPubkey);
                        if (client) {
                            client.preferredEncryption = 'nip44';
                        }
                        this.preferredEncryption = 'nip44';
                    }
                }
                catch (e) {
                    // If both methods fail, use the first error
                    throw encError || e;
                }
            }
            if (!encryptedContent) {
                throw new Error('Failed to encrypt response: No encryption method succeeded');
            }
            // Send response
            await this.nostr.publishEvent({
                kind: 24133,
                content: encryptedContent,
                tags: [['p', clientPubkey]],
                created_at: Math.floor(Date.now() / 1000),
                pubkey: this.signerKeypair.publicKey,
                id: '',
                sig: ''
            });
        }
        catch (error) {
            console.error('Failed to send response:', error);
            throw error;
        }
    }
    isClientAuthorized(clientPubkey) {
        return this.connectedClients.has(clientPubkey);
    }
    getConnectionString() {
        const params = new URLSearchParams();
        if (this.options.relays) {
            this.options.relays.forEach(relay => params.append('relay', relay));
        }
        if (this.options.secret) {
            params.append('secret', this.options.secret);
        }
        return `bunker://${this.signerKeypair.publicKey}?${params.toString()}`;
    }
    async publishMetadata(metadata) {
        try {
            // Include relay information if not already specified
            if (!metadata.relays && this.options.relays) {
                metadata.relays = this.options.relays;
            }
            // Create metadata event (kind 31990 - NIP-89 application handler)
            const event = await (0, event_1.createSignedEvent)({
                kind: 31990,
                content: JSON.stringify(metadata),
                tags: [
                    ['k', '24133'], // Handles kind 24133 (NIP-46)
                    ...metadata.relays ? metadata.relays.map(url => ['relay', url]) : [],
                    ...(metadata.nostrconnect_url ? [['nostrconnect_url', metadata.nostrconnect_url]] : [])
                ],
                created_at: Math.floor(Date.now() / 1000),
                pubkey: this.signerKeypair.publicKey
            }, this.signerKeypair.privateKey);
            // Publish metadata event
            await this.nostr.publishEvent(event);
            return event;
        }
        catch (error) {
            console.error('Failed to publish metadata:', error);
            return undefined;
        }
    }
}
exports.NostrRemoteSignerBunker = NostrRemoteSignerBunker;
