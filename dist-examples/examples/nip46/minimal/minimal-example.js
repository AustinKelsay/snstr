"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../../../src");
const event_1 = require("../../../src/utils/event");
const ws_1 = __importDefault(require("ws"));
// Simple in-memory relay for testing
class TestRelay {
    constructor(port) {
        this.clients = [];
        this.server = new ws_1.default.Server({ port });
        this.url = `ws://localhost:${port}`;
        this.server.on('connection', (ws) => {
            this.clients.push(ws);
            ws.on('message', (data) => {
                // Broadcast message to all clients
                this.clients.forEach(client => {
                    if (client.readyState === ws_1.default.OPEN) {
                        client.send(data.toString());
                    }
                });
            });
            ws.on('close', () => {
                this.clients = this.clients.filter(client => client !== ws);
            });
        });
    }
    async start() {
        return new Promise((resolve) => {
            this.server.on('listening', () => {
                console.log(`Test relay started on ${this.url}`);
                resolve();
            });
        });
    }
    async close() {
        this.clients.forEach(client => client.close());
        this.server.close();
    }
}
// NIP-46 Client
class MinimalNIP46Client {
    constructor(relayUrl) {
        this.pendingRequests = new Map();
        this.socket = new ws_1.default(relayUrl);
        this.clientKeys = { publicKey: '', privateKey: '' };
        this.signerPubkey = '';
    }
    async connect(connectionString) {
        // Parse connection string
        const url = new URL(connectionString);
        this.signerPubkey = url.hostname;
        // Generate client keypair
        this.clientKeys = await (0, src_1.generateKeypair)();
        // Connect to socket
        if (this.socket.readyState !== ws_1.default.OPEN) {
            await this.waitForOpen();
        }
        // Set up message handler
        this.socket.on('message', (data) => {
            this.handleMessage(data.toString());
        });
        // Send connect request
        const userPubkey = await this.sendRequest('connect', [this.signerPubkey]);
        // Get user public key
        return await this.sendRequest('get_public_key', []);
    }
    async signEvent(eventData) {
        return await this.sendRequest('sign_event', [JSON.stringify(eventData)]);
    }
    async ping() {
        return await this.sendRequest('ping', []);
    }
    async waitForOpen() {
        if (this.socket.readyState === ws_1.default.OPEN)
            return;
        return new Promise((resolve, reject) => {
            this.socket.on('open', resolve);
            this.socket.on('error', reject);
        });
    }
    async sendRequest(method, params) {
        return new Promise((resolve, reject) => {
            // Generate request ID
            const id = Math.random().toString(36).substring(2, 10);
            // Create request object
            const request = { id, method, params };
            // Set up timeout
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Request timed out: ${method}`));
            }, 10000);
            // Store resolver
            this.pendingRequests.set(id, (result) => {
                clearTimeout(timeout);
                resolve(result);
            });
            // Encrypt and send request
            try {
                const json = JSON.stringify(request);
                const encrypted = (0, src_1.encryptNIP04)(json, this.clientKeys.privateKey, this.signerPubkey);
                // Create and send event
                this.sendEvent({
                    kind: 24133,
                    content: encrypted,
                    tags: [['p', this.signerPubkey]],
                    pubkey: this.clientKeys.publicKey
                });
            }
            catch (error) {
                clearTimeout(timeout);
                this.pendingRequests.delete(id);
                reject(error);
            }
        });
    }
    async sendEvent(event) {
        // Add created_at if not present
        if (!event.created_at) {
            event.created_at = Math.floor(Date.now() / 1000);
        }
        // Calculate ID if not present
        if (!event.id) {
            event.id = await (0, event_1.getEventHash)(event);
        }
        // Sign if not signed
        if (!event.sig) {
            event.sig = await (0, src_1.signEvent)(event.id, this.clientKeys.privateKey);
        }
        // Send to relay
        this.socket.send(JSON.stringify(['EVENT', event]));
    }
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            // Only handle EVENT messages
            if (!Array.isArray(message) || message[0] !== 'EVENT')
                return;
            const event = message[1];
            // Only handle events from the signer pubkey
            if (event.pubkey !== this.signerPubkey)
                return;
            // Only handle events to our client
            const pTag = event.tags.find((tag) => tag[0] === 'p' && tag[1] === this.clientKeys.publicKey);
            if (!pTag)
                return;
            // Decrypt content
            try {
                const decrypted = (0, src_1.decryptNIP04)(event.content, this.clientKeys.privateKey, this.signerPubkey);
                // Parse response
                const response = JSON.parse(decrypted);
                // Find and call handler
                const handler = this.pendingRequests.get(response.id);
                if (handler) {
                    this.pendingRequests.delete(response.id);
                    handler(response.result);
                }
            }
            catch (error) {
                console.error('Failed to decrypt or parse message:', error);
            }
        }
        catch (error) {
            console.error('Failed to handle message:', error);
        }
    }
}
// NIP-46 Bunker
class MinimalNIP46Bunker {
    constructor(relayUrl, userPubkey, signerPubkey) {
        this.connectedClients = new Set();
        this.socket = new ws_1.default(relayUrl);
        this.userKeys = { publicKey: userPubkey, privateKey: '' };
        this.signerKeys = {
            publicKey: signerPubkey || userPubkey,
            privateKey: ''
        };
    }
    setUserPrivateKey(privateKey) {
        this.userKeys.privateKey = privateKey;
    }
    setSignerPrivateKey(privateKey) {
        this.signerKeys.privateKey = privateKey;
    }
    async start() {
        // Connect to socket
        if (this.socket.readyState !== ws_1.default.OPEN) {
            await this.waitForOpen();
        }
        // Set up message handler
        this.socket.on('message', (data) => {
            this.handleMessage(data.toString());
        });
    }
    getConnectionString(relayUrl) {
        return `bunker://${this.signerKeys.publicKey}?relay=${encodeURIComponent(relayUrl)}`;
    }
    async waitForOpen() {
        if (this.socket.readyState === ws_1.default.OPEN)
            return;
        return new Promise((resolve, reject) => {
            this.socket.on('open', resolve);
            this.socket.on('error', reject);
        });
    }
    async handleMessage(data) {
        try {
            const message = JSON.parse(data);
            // Only handle EVENT messages
            if (!Array.isArray(message) || message[0] !== 'EVENT')
                return;
            const event = message[1];
            // Only handle events to our signer pubkey
            const pTag = event.tags.find((tag) => tag[0] === 'p' && tag[1] === this.signerKeys.publicKey);
            if (!pTag)
                return;
            // Decrypt content
            try {
                const decrypted = (0, src_1.decryptNIP04)(event.content, this.signerKeys.privateKey, event.pubkey);
                // Parse request
                const request = JSON.parse(decrypted);
                // Handle request
                const response = await this.handleRequest(request, event.pubkey);
                // Send response
                await this.sendResponse(event.pubkey, response);
            }
            catch (error) {
                console.error('Failed to handle client request:', error);
            }
        }
        catch (error) {
            console.error('Failed to handle message:', error);
        }
    }
    async handleRequest(request, clientPubkey) {
        const { id, method, params } = request;
        let result;
        let error;
        try {
            switch (method) {
                case 'connect':
                    // Check if signer pubkey matches
                    if (params[0] === this.signerKeys.publicKey) {
                        this.connectedClients.add(clientPubkey);
                        result = 'ack';
                    }
                    else {
                        error = 'Invalid signer pubkey';
                    }
                    break;
                case 'get_public_key':
                    result = this.userKeys.publicKey;
                    break;
                case 'ping':
                    result = 'pong';
                    break;
                case 'sign_event':
                    if (!this.connectedClients.has(clientPubkey)) {
                        error = 'Not connected';
                        break;
                    }
                    try {
                        // Parse event data
                        const eventData = JSON.parse(params[0]);
                        // Add pubkey
                        eventData.pubkey = this.userKeys.publicKey;
                        // Complete the event
                        if (!eventData.created_at) {
                            eventData.created_at = Math.floor(Date.now() / 1000);
                        }
                        // Calculate ID
                        eventData.id = await (0, event_1.getEventHash)(eventData);
                        // Sign the event
                        eventData.sig = await (0, src_1.signEvent)(eventData.id, this.userKeys.privateKey);
                        result = JSON.stringify(eventData);
                    }
                    catch (signError) {
                        error = `Failed to sign event: ${signError.message}`;
                    }
                    break;
                default:
                    error = `Unsupported method: ${method}`;
            }
        }
        catch (e) {
            error = e.message;
        }
        return { id, result, error };
    }
    async sendResponse(clientPubkey, response) {
        try {
            // Encrypt the response
            const json = JSON.stringify(response);
            const encrypted = (0, src_1.encryptNIP04)(json, this.signerKeys.privateKey, clientPubkey);
            // Create and send event
            await this.sendEvent({
                kind: 24133,
                content: encrypted,
                tags: [['p', clientPubkey]],
                pubkey: this.signerKeys.publicKey
            });
        }
        catch (error) {
            console.error('Failed to send response:', error);
        }
    }
    async sendEvent(event) {
        // Add created_at if not present
        if (!event.created_at) {
            event.created_at = Math.floor(Date.now() / 1000);
        }
        // Calculate ID if not present
        if (!event.id) {
            event.id = await (0, event_1.getEventHash)(event);
        }
        // Sign if not signed
        if (!event.sig) {
            event.sig = await (0, src_1.signEvent)(event.id, this.signerKeys.privateKey);
        }
        // Send to relay
        this.socket.send(JSON.stringify(['EVENT', event]));
    }
}
// Main demo
async function main() {
    console.log('=== NIP-46 Minimal Example ===');
    // Start a test relay
    const relay = new TestRelay(3789);
    await relay.start();
    try {
        // Generate keypairs
        console.log('\nGenerating keypairs...');
        const userKeypair = await (0, src_1.generateKeypair)();
        const signerKeypair = await (0, src_1.generateKeypair)();
        console.log(`User pubkey: ${userKeypair.publicKey}`);
        console.log(`Signer pubkey: ${signerKeypair.publicKey}`);
        // Create and start bunker
        console.log('\nSetting up bunker...');
        const bunker = new MinimalNIP46Bunker(relay.url, userKeypair.publicKey, signerKeypair.publicKey);
        bunker.setUserPrivateKey(userKeypair.privateKey);
        bunker.setSignerPrivateKey(signerKeypair.privateKey);
        await bunker.start();
        const connectionString = bunker.getConnectionString(relay.url);
        console.log(`Connection string: ${connectionString}`);
        // Create and connect client
        console.log('\nConnecting client...');
        const client = new MinimalNIP46Client(relay.url);
        const pubkey = await client.connect(connectionString);
        console.log(`Connected! Got pubkey: ${pubkey}`);
        console.log(`Matches original user pubkey: ${pubkey === userKeypair.publicKey}`);
        // Test ping
        console.log('\nTesting ping...');
        const pong = await client.ping();
        console.log(`Ping response: ${pong}`);
        // Test signing
        console.log('\nTesting event signing...');
        const event = {
            kind: 1,
            content: 'Hello from NIP-46 remote signing!',
            created_at: Math.floor(Date.now() / 1000),
            tags: []
        };
        const signedEvent = await client.signEvent(event);
        console.log('Successfully signed event:');
        console.log(`- ID: ${JSON.parse(signedEvent).id}`);
        console.log(`- Pubkey: ${JSON.parse(signedEvent).pubkey}`);
        console.log(`- Signature: ${JSON.parse(signedEvent).sig.substring(0, 20)}...`);
        // Verify signature
        const parsed = JSON.parse(signedEvent);
        const valid = await (0, src_1.verifySignature)(parsed.id, parsed.sig, parsed.pubkey);
        console.log(`Signature valid: ${valid}`);
    }
    catch (error) {
        console.error('ERROR:', error.message);
    }
    finally {
        // Clean up
        console.log('\nCleaning up...');
        await relay.close();
    }
}
main().catch(console.error);
