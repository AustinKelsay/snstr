import { NostrEvent, NostrFilter } from '../types/nostr';
import { Nostr } from '../client/nostr';
import { encrypt as encryptNIP04, decrypt as decryptNIP04 } from '../nip04';
import { NIP46Request, NIP46Response, createSuccessResponse, createErrorResponse } from './utils/request-response';
import { Logger, LogLevel } from './utils/logger';
import { createSignedEvent } from '../utils/event';

// Session data for connected clients
interface ClientSession {
  permissions: Set<string>;
  lastSeen: number;
}

// Bunker options
export interface SimpleNIP46BunkerOptions {
  timeout?: number;
  logLevel?: LogLevel;
  defaultPermissions?: string[];
  secret?: string;
  debug?: boolean;
}

/**
 * Simple implementation of a NIP-46 bunker (remote signer)
 * 
 * This class implements the signer-side of the NIP-46 Remote Signing protocol.
 * It is designed to be lightweight and easy to use.
 */
export class SimpleNIP46Bunker {
  private nostr: Nostr;
  private relays: string[];
  private userKeys: { publicKey: string; privateKey: string };
  private signerKeys: { publicKey: string; privateKey: string };
  private clients: Map<string, ClientSession>;
  private defaultPermissions: Set<string>;
  private subId: string | null;
  private secret?: string;
  private logger: Logger;
  private debug: boolean;
  
  /**
   * Create a new SimpleNIP46Bunker
   * 
   * @param relays - Array of relay URLs to connect to
   * @param userPubkey - The user's public key
   * @param signerPubkey - Optional separate signer public key (defaults to user pubkey)
   * @param options - Bunker options
   */
  constructor(
    relays: string[], 
    userPubkey: string, 
    signerPubkey?: string,
    options: SimpleNIP46BunkerOptions = {}
  ) {
    this.relays = relays;
    this.nostr = new Nostr(relays);
    this.userKeys = { publicKey: userPubkey, privateKey: '' };
    this.signerKeys = { publicKey: signerPubkey || userPubkey, privateKey: '' };
    this.clients = new Map();
    this.defaultPermissions = new Set(options.defaultPermissions || []);
    this.subId = null;
    this.secret = options.secret;
    this.debug = options.debug || false;
    
    // For backward compatibility, set the logger level based on debug flag if not explicitly set
    const logLevel = options.logLevel || (this.debug ? LogLevel.DEBUG : LogLevel.INFO);
    
    this.logger = new Logger({
      prefix: 'Bunker',
      level: logLevel
    });
  }
  
  /**
   * Start the bunker and listen for requests
   */
  async start(): Promise<void> {
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
      const filter: NostrFilter = {
        kinds: [24133],
        '#p': [this.signerKeys.publicKey]
      };
      
      const subIds = this.nostr.subscribe([filter], (event) => this.handleRequest(event));
      this.subId = subIds[0];
      
      this.logger.info(`Bunker started for ${this.signerKeys.publicKey} on ${this.relays.length} relay(s)`);
      return;
    } catch (error: any) {
      this.logger.error(`Failed to start bunker:`, error.message);
      throw error;
    }
  }
  
  /**
   * Stop the bunker
   */
  async stop(): Promise<void> {
    if (this.subId) {
      try {
        this.nostr.unsubscribe([this.subId]);
      } catch (e) {
        // Ignore unsubscribe errors
      }
      this.subId = null;
    }
    
    try {
      await this.nostr.disconnectFromRelays();
      this.logger.info(`Bunker stopped`);
    } catch (error: any) {
      this.logger.warn(`Error disconnecting from relays:`, error.message);
      // Continue despite errors
    }
    
    // Clear client sessions
    this.clients.clear();
  }
  
  /**
   * Get a connection string for clients
   */
  getConnectionString(): string {
    const relayParams = this.relays.map(relay => `relay=${encodeURIComponent(relay)}`).join('&');
    const secretParam = this.secret ? `&secret=${encodeURIComponent(this.secret)}` : '';
    
    return `bunker://${this.signerKeys.publicKey}?${relayParams}${secretParam}`;
  }
  
  /**
   * Set the user's private key
   */
  setUserPrivateKey(privateKey: string): void {
    this.userKeys.privateKey = privateKey;
  }
  
  /**
   * Set the signer's private key
   */
  setSignerPrivateKey(privateKey: string): void {
    this.signerKeys.privateKey = privateKey;
  }
  
  /**
   * Set default permissions for all clients
   */
  setDefaultPermissions(permissions: string[]): void {
    this.defaultPermissions = new Set(permissions);
  }
  
  /**
   * Add a permission for a specific client
   */
  addClientPermission(clientPubkey: string, permission: string): boolean {
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
  removeClientPermission(clientPubkey: string, permission: string): boolean {
    const client = this.clients.get(clientPubkey);
    if (client) {
      return client.permissions.delete(permission);
    }
    return false;
  }
  
  /**
   * Handle an incoming request event
   */
  private async handleRequest(event: NostrEvent): Promise<void> {
    try {
      this.logger.info(`Received request from ${event.pubkey}`);
      
      // Check if we have the signer private key
      if (!this.signerKeys.privateKey) {
        this.logger.error(`Signer private key not set`);
        return;
      }
      
      // Decrypt with the signer's private key and client's public key
      try {
        const decrypted = decryptNIP04(
          event.content, 
          this.signerKeys.privateKey, 
          event.pubkey
        );
        
        this.logger.debug(`Decrypted content: ${decrypted}`);
        
        // Parse the request
        const request: NIP46Request = JSON.parse(decrypted);
        const clientPubkey = event.pubkey;
        
        this.logger.debug(`Processing request: ${request.method} (${request.id})`);
        
        // Handle the request based on method
        let response: NIP46Response;
        
        switch(request.method) {
          case 'connect':
            response = await this.handleConnect(request, clientPubkey);
            break;
            
          case 'get_public_key':
            if (!this.isClientAuthorized(clientPubkey)) {
              response = createErrorResponse(request.id, 'Unauthorized');
            } else {
              this.logger.debug(`Sending pubkey: ${this.userKeys.publicKey}`);
              response = createSuccessResponse(request.id, this.userKeys.publicKey);
            }
            break;
            
          case 'ping':
            if (!this.isClientAuthorized(clientPubkey)) {
              response = createErrorResponse(request.id, 'Unauthorized');
            } else {
              this.logger.debug(`Ping-pong`);
              response = createSuccessResponse(request.id, 'pong');
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
            response = createErrorResponse(request.id, `Unknown method: ${request.method}`);
        }
        
        // Send the response
        await this.sendResponse(response, clientPubkey);
        
      } catch (error: any) {
        this.logger.error(`Failed to process request:`, error.message);
      }
    } catch (error: any) {
      this.logger.error(`Error handling request:`, error.message);
    }
  }
  
  /**
   * Handle a connect request
   */
  private async handleConnect(
    request: NIP46Request,
    clientPubkey: string
  ): Promise<NIP46Response> {
    // Extract parameters
    const [signerPubkey, secret, permissionsParam] = request.params;
    
    // Verify the client is connecting to the correct signer
    if (signerPubkey !== this.signerKeys.publicKey) {
      return createErrorResponse(request.id, 'Invalid signer pubkey');
    }
    
    // Check secret if required
    if (this.secret && (!secret || this.secret !== secret)) {
      return createErrorResponse(request.id, 'Invalid secret');
    }
    
    // Create a new session for this client
    const session: ClientSession = {
      permissions: new Set<string>(),
      lastSeen: Date.now()
    };
    
    // Add default permissions
    this.defaultPermissions.forEach(p => session.permissions.add(p));
    
    // Add client-requested permissions (optional)
    if (permissionsParam) {
      permissionsParam.split(',').forEach(p => {
        if (p.trim()) session.permissions.add(p.trim());
      });
    }
    
    // Store client session
    this.clients.set(clientPubkey, session);
    this.logger.info(`Client connected: ${clientPubkey}`);
    
    return createSuccessResponse(request.id, 'ack');
  }
  
  /**
   * Handle a sign_event request
   */
  private async handleSignEvent(
    request: NIP46Request,
    clientPubkey: string
  ): Promise<NIP46Response> {
    // Check authorization
    if (!this.isClientAuthorized(clientPubkey)) {
      return createErrorResponse(request.id, 'Unauthorized');
    }
    
    // Check if we have the user's private key
    if (!this.userKeys.privateKey) {
      return createErrorResponse(request.id, 'User private key not set');
    }
    
    // Get the event data
    if (!request.params[0]) {
      return createErrorResponse(request.id, 'Missing event data');
    }
    
    try {
      // Parse the event data
      const eventData = JSON.parse(request.params[0]);
      
      // Check if the client has permission to sign this kind of event
      const kindPermission = `sign_event:${eventData.kind}`;
      const client = this.clients.get(clientPubkey);
      
      if (!client || (!client.permissions.has('sign_event') && !client.permissions.has(kindPermission))) {
        return createErrorResponse(request.id, `Not authorized to sign kind ${eventData.kind} events`);
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
      const signedEvent = await createSignedEvent(unsignedEvent, this.userKeys.privateKey);
      
      this.logger.debug(`Event signed successfully`);
      
      // Return the signed event
      return createSuccessResponse(request.id, JSON.stringify(signedEvent));
    } catch (error: any) {
      return createErrorResponse(request.id, `Failed to sign event: ${error.message}`);
    }
  }
  
  /**
   * Handle a nip04_encrypt request
   */
  private async handleNIP04Encrypt(
    request: NIP46Request,
    clientPubkey: string
  ): Promise<NIP46Response> {
    // Check authorization
    if (!this.isClientAuthorized(clientPubkey)) {
      return createErrorResponse(request.id, 'Unauthorized');
    }
    
    // Check if client has encryption permission
    const client = this.clients.get(clientPubkey);
    if (!client || !client.permissions.has('nip04_encrypt')) {
      return createErrorResponse(request.id, 'Not authorized for NIP-04 encryption');
    }
    
    // Check if we have the user's private key
    if (!this.userKeys.privateKey) {
      return createErrorResponse(request.id, 'User private key not set');
    }
    
    // Check parameters
    if (request.params.length < 2) {
      return createErrorResponse(request.id, 'Missing parameters');
    }
    
    const [recipient, plaintext] = request.params;
    
    try {
      // Encrypt the message
      const encrypted = encryptNIP04(plaintext, this.userKeys.privateKey, recipient);
      
      this.logger.debug(`NIP-04 encryption successful`);
      
      return createSuccessResponse(request.id, encrypted);
    } catch (error: any) {
      return createErrorResponse(request.id, `NIP-04 encryption failed: ${error.message}`);
    }
  }
  
  /**
   * Handle a nip04_decrypt request
   */
  private async handleNIP04Decrypt(
    request: NIP46Request,
    clientPubkey: string
  ): Promise<NIP46Response> {
    // Check authorization
    if (!this.isClientAuthorized(clientPubkey)) {
      return createErrorResponse(request.id, 'Unauthorized');
    }
    
    // Check if client has decryption permission
    const client = this.clients.get(clientPubkey);
    if (!client || !client.permissions.has('nip04_decrypt')) {
      return createErrorResponse(request.id, 'Not authorized for NIP-04 decryption');
    }
    
    // Check parameters
    if (request.params.length < 2) {
      return createErrorResponse(request.id, 'Missing parameters');
    }
    
    const [sender, ciphertext] = request.params;
    
    try {
      // Decrypt the message
      const decrypted = decryptNIP04(ciphertext, this.userKeys.privateKey, sender);
      
      this.logger.debug(`NIP-04 decryption successful`);
      
      return createSuccessResponse(request.id, decrypted);
    } catch (error: any) {
      return createErrorResponse(request.id, `NIP-04 decryption failed: ${error.message}`);
    }
  }
  
  /**
   * Send a response to a client
   */
  private async sendResponse(response: NIP46Response, clientPubkey: string): Promise<void> {
    try {
      this.logger.debug(`Sending response: ${response.id} to ${clientPubkey}`);
      this.logger.trace(`Response JSON: ${JSON.stringify(response)}`);
      
      // Check if we have the signer private key
      if (!this.signerKeys.privateKey) {
        this.logger.error(`Signer private key not set`);
        return;
      }
      
      // Encrypt the response with the signer's private key and client's public key
      const encrypted = encryptNIP04(
        JSON.stringify(response),
        this.signerKeys.privateKey,
        clientPubkey
      );
      
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
    } catch (error: any) {
      this.logger.error(`Failed to send response:`, error.message);
    }
  }
  
  /**
   * Check if a client is authorized
   */
  private isClientAuthorized(clientPubkey: string): boolean {
    return this.clients.has(clientPubkey);
  }
  
  /**
   * Set the log level
   */
  setLogLevel(level: LogLevel): void {
    this.logger.setLevel(level);
  }
} 