import { Nostr } from '../client/nostr';
import { NostrEvent } from '../types/nostr';
import { getPublicKey } from '../utils/crypto';
import { createEvent, createSignedEvent } from '../utils/event';
import { encrypt as encryptNIP04, decrypt as decryptNIP04 } from '../nip04';
import { 
  NIP47Method, 
  NIP47Request, 
  NIP47Response, 
  NIP47ConnectionOptions,
  NIP47EventKind,
  NIP47NotificationType,
  NIP47Notification,
  TransactionType
} from './types';

/**
 * Parse a NWC URL into connection options
 */
export function parseNWCURL(url: string): NIP47ConnectionOptions {
  if (!url.startsWith('nostr+walletconnect://')) {
    throw new Error('Invalid NWC URL format');
  }

  // Extract pubkey
  const [_, pubkeyAndParams] = url.split('://');
  const [pubkey, queryString] = pubkeyAndParams.split('?');

  if (!pubkey) {
    throw new Error('Missing pubkey in NWC URL');
  }

  // Parse query parameters
  const params = new URLSearchParams(queryString);
  const relays: string[] = [];
  params.getAll('relay').forEach(relay => relays.push(relay));

  const secret = params.get('secret');
  if (!secret) {
    throw new Error('Missing secret in NWC URL');
  }

  return {
    pubkey,
    secret,
    relays
  };
}

/**
 * Generate a NWC URL from connection options
 */
export function generateNWCURL(options: NIP47ConnectionOptions): string {
  if (!options.pubkey) {
    throw new Error('Missing pubkey in connection options');
  }

  if (!options.secret) {
    throw new Error('Missing secret in connection options');
  }

  if (!options.relays || options.relays.length === 0) {
    throw new Error('At least one relay must be specified');
  }

  const params = new URLSearchParams();
  options.relays.forEach(relay => params.append('relay', relay));
  params.append('secret', options.secret);

  return `nostr+walletconnect://${options.pubkey}?${params.toString()}`;
}

/**
 * Nostr Wallet Connect client implementation
 * 
 * This class provides an API for applications to connect to a NIP-47 compatible
 * wallet service over Nostr.
 */
export class NostrWalletConnectClient {
  private pubkey: string;
  private clientPrivkey: string;
  private clientPubkey: string;
  private relays: string[];
  private client: Nostr;
  private supportedMethods: string[] = [];
  private supportedNotifications: string[] = [];
  private notificationHandlers = new Map<string, ((notification: NIP47Notification) => void)[]>();
  private pendingRequests = new Map<string, (response: NIP47Response) => void>();
  private initialized = false;
  private subIds: string[] = [];

  constructor(options: NIP47ConnectionOptions) {
    if (!options.pubkey) {
      throw new Error('Missing pubkey in connection options');
    }

    if (!options.secret) {
      throw new Error('Missing secret in connection options');
    }

    if (!options.relays || options.relays.length === 0) {
      throw new Error('At least one relay must be specified');
    }

    this.pubkey = options.pubkey;
    this.clientPrivkey = options.secret;
    this.clientPubkey = getPublicKey(this.clientPrivkey);
    this.relays = options.relays;
    this.client = new Nostr(this.relays);
  }

  /**
   * Initialize the client, connect to relays and fetch capabilities
   */
  public async init(): Promise<void> {
    // Connect to relays
    await this.client.connectToRelays();
    console.log(`Client connected to relays: ${this.relays.join(', ')}`);

    // Set up subscription to receive responses
    this.setupSubscription();
    console.log('Client subscribed to service events');
    
    // Wait for capabilities to be discovered via events
    console.log('Waiting for service capabilities...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    if (this.supportedMethods.length === 0) {
      console.warn('No methods discovered from service after timeout, will try explicit getInfo call');
      try {
        // Fallback to explicit getInfo call
        const info = await this.getInfo();
        if (info && info.methods) {
          this.supportedMethods = info.methods;
          console.log(`Discovered methods via getInfo: ${this.supportedMethods.join(', ')}`);
        }
        if (info && info.notifications) {
          this.supportedNotifications = info.notifications;
          console.log(`Discovered notifications via getInfo: ${this.supportedNotifications.join(', ')}`);
        }
      } catch (error) {
        throw new Error(`Failed to initialize wallet connection: ${error}`);
      }
    }
    
    this.initialized = true;
  }

  /**
   * Check if the wallet supports a specific method
   */
  public supportsMethod(method: string): boolean {
    return this.supportedMethods.includes(method);
  }

  /**
   * Check if the wallet supports a specific notification type
   */
  public supportsNotification(type: string): boolean {
    return this.supportedNotifications.includes(type);
  }

  /**
   * Register a notification handler
   */
  public onNotification(type: string, handler: (notification: NIP47Notification) => void): void {
    if (!this.notificationHandlers.has(type)) {
      this.notificationHandlers.set(type, []);
    }
    this.notificationHandlers.get(type)!.push(handler);
  }

  /**
   * Get the client's public key
   */
  public getPublicKey(): string {
    return this.clientPubkey;
  }

  /**
   * Disconnect from the wallet service
   */
  public disconnect(): void {
    if (this.subIds.length > 0) {
      this.client.unsubscribe(this.subIds);
      this.subIds = [];
    }
    this.initialized = false;
  }

  /**
   * Set up subscription to receive responses from the wallet service
   */
  private setupSubscription(): void {
    // Subscribe to events from the wallet service directed to us
    const responseFilter = {
      kinds: [NIP47EventKind.RESPONSE, NIP47EventKind.NOTIFICATION],
      authors: [this.pubkey],
      '#p': [this.clientPubkey]
    };

    // Filter for INFO events from the service
    const infoFilter = {
      kinds: [NIP47EventKind.INFO],
      authors: [this.pubkey]
    };

    console.log('Setting up client subscriptions:');
    console.log('Filter 1:', JSON.stringify(responseFilter));
    console.log('Filter 2:', JSON.stringify(infoFilter));
    
    // Enhanced debug logging for the client filter
    console.log('Client pubkey for filter:', this.clientPubkey);
    console.log('Service pubkey for filter:', this.pubkey);
    
    this.subIds = this.client.subscribe(
      [responseFilter, infoFilter], 
      (event: NostrEvent, relay: string) => {
        console.log(`Received event: ${event.id} of kind ${event.kind} from ${relay}`);
        console.log(`Event pubkey: ${event.pubkey}, tags: ${JSON.stringify(event.tags)}`);
        
        // Log all event data for debugging
        console.log(`Full event:`, JSON.stringify(event));
        
        this.handleEvent(event);
      }
    );
    console.log('Subscription IDs:', this.subIds);
  }

  /**
   * Handle incoming events from the wallet service
   */
  private handleEvent(event: NostrEvent): void {
    console.log(`Handling event of kind ${event.kind} from ${event.pubkey}`);
    console.log(`Event id: ${event.id}`);
    console.log(`Event tags: ${JSON.stringify(event.tags)}`);
    
    // Extract p-tag and e-tag values for easier debugging
    const pTags = event.tags.filter(tag => tag[0] === 'p').map(tag => tag[1]);
    const eTags = event.tags.filter(tag => tag[0] === 'e').map(tag => tag[1]);
    
    console.log(`Event p-tags: ${pTags.join(', ')}`);
    console.log(`Event e-tags: ${eTags.join(', ')}`);
    console.log(`Expected p-tag for this client: ${this.clientPubkey}`);
    
    if (event.kind === NIP47EventKind.RESPONSE) {
      console.log(`Processing as RESPONSE event (kind ${NIP47EventKind.RESPONSE})`);
      this.handleResponse(event);
    } else if (event.kind === NIP47EventKind.NOTIFICATION) {
      console.log(`Processing as NOTIFICATION event (kind ${NIP47EventKind.NOTIFICATION})`);
      this.handleNotification(event);
    } else if (event.kind === NIP47EventKind.INFO) {
      console.log(`Processing as INFO event (kind ${NIP47EventKind.INFO})`);
      this.handleInfoEvent(event);
    } else {
      console.log(`Unknown event kind: ${event.kind}, expected one of: ${NIP47EventKind.RESPONSE}, ${NIP47EventKind.NOTIFICATION}, ${NIP47EventKind.INFO}`);
    }
  }

  /**
   * Handle response events
   */
  private handleResponse(event: NostrEvent): void {
    try {
      // Check if this is from our service
      if (event.pubkey !== this.pubkey) {
        console.warn(`Received event from unknown pubkey: ${event.pubkey}, expected ${this.pubkey}`);
        return;
      }

      // Decrypt the content
      console.log(`Decrypting response with client private key and service public key`);
      const decrypted = decryptNIP04(event.content, this.clientPrivkey, this.pubkey);
      console.log(`Decrypted response: ${decrypted.substring(0, 100)}...`);

      // Parse the content
      const response = JSON.parse(decrypted) as NIP47Response;
      console.log(`Parsed response of type: ${response.result_type}`);

      // Find the e-tag which references the request event ID
      const eTags = event.tags.filter(tag => tag[0] === 'e');
      if (eTags.length === 0) {
        console.warn('Response event has no e-tag, cannot correlate with a request');
        return;
      }

      // Get the request ID from the e-tag
      const requestId = eTags[0][1];
      console.log(`Found request ID from e-tag: ${requestId}`);
      
      // Find the pending request
      if (this.pendingRequests.has(requestId)) {
        console.log(`Found pending request with ID: ${requestId}`);
        const resolver = this.pendingRequests.get(requestId);
        if (resolver) {
          resolver(response);
          this.pendingRequests.delete(requestId);
          console.log(`Request ${requestId} resolved successfully`);
          return;
        }
      } else {
        console.warn(`No pending request found with ID: ${requestId}`);
      }
    } catch (error) {
      console.error('Error handling response event:', error);
    }
  }

  /**
   * Handle notification events
   */
  private handleNotification(event: NostrEvent): void {
    try {
      // Decrypt the content with client's private key and service's public key
      const decrypted = decryptNIP04(event.content, this.clientPrivkey, this.pubkey);
      const notification: NIP47Notification = JSON.parse(decrypted);

      // Find and call the notification handlers
      const handlers = this.notificationHandlers.get(notification.notification_type);
      if (handlers) {
        handlers.forEach(handler => handler(notification));
      }
    } catch (error) {
      console.error('Failed to handle notification:', error);
    }
  }

  /**
   * Handle info events to discover capabilities
   */
  private handleInfoEvent(event: NostrEvent): void {
    try {
      console.log('Received INFO event from:', event.pubkey);
      console.log('Expected service pubkey:', this.pubkey);
      console.log('Event kind:', event.kind, 'Expected:', NIP47EventKind.INFO);
      console.log('Event content:', event.content);
      console.log('Event tags:', JSON.stringify(event.tags));
      
      // Extract supported methods from content
      if (event.content.trim()) {
        this.supportedMethods = event.content.trim().split(' ');
      }
      
      // Extract supported notifications from tags
      const notificationsTag = event.tags.find((tag: string[]) => tag[0] === 'notifications');
      if (notificationsTag && notificationsTag[1]) {
        this.supportedNotifications = notificationsTag[1].split(' ');
      }
      
      console.log('Discovered capabilities:');
      console.log(`Methods: ${this.supportedMethods.join(', ')}`);
      console.log(`Notifications: ${this.supportedNotifications.join(', ')}`);
    } catch (error) {
      console.error('Failed to handle info event:', error);
    }
  }

  /**
   * Send a request to the wallet service
   */
  private async sendRequest<TRequest extends NIP47Request, TResponse extends NIP47Response>(
    request: TRequest
  ): Promise<TResponse> {
    // Special case for getInfo which might be called during initialization
    if (request.method !== NIP47Method.GET_INFO && !this.initialized) {
      throw new Error('Client not initialized');
    }
    
    // Check if method is supported (except for getInfo during initialization)
    if (request.method !== NIP47Method.GET_INFO && !this.supportedMethods.includes(request.method)) {
      throw new Error(`Method ${request.method} not supported by this wallet service`);
    }
    
    // Create event template
    const eventTemplate = {
      kind: NIP47EventKind.REQUEST,
      tags: [
        ['p', this.pubkey],
        // Add expiration tag (5 minutes)
        ['expiration', Math.floor(Date.now() / 1000 + 300).toString()]
      ],
      content: '' // Will be replaced with encrypted content
    };
    
    // Encrypt the request
    console.log(`Encrypting request from ${this.clientPubkey} to ${this.pubkey}`);
    
    // Always use sender's private key, receiver's public key
    const encryptedContent = encryptNIP04(
      JSON.stringify(request),
      this.clientPrivkey,
      this.pubkey
    );
    
    // Create an unsigned event
    const unsignedEvent = createEvent(
      { ...eventTemplate, content: encryptedContent }, 
      this.clientPubkey
    );
    
    // Sign the event
    const signedEvent = await createSignedEvent(unsignedEvent, this.clientPrivkey);
    
    console.log(`Sending request event: ${signedEvent.id}, method: ${request.method}`);
    
    // Set up promise for the response
    const responsePromise = new Promise<TResponse>((resolve, reject) => {
      // Add a timeout
      const timeoutId = setTimeout(() => {
        console.log(`Request timed out for method: ${request.method}, id: ${signedEvent.id}`);
        this.pendingRequests.delete(signedEvent.id);
        // Log the current pending requests for debugging
        console.log(`Current pending requests: ${Array.from(this.pendingRequests.keys()).join(', ')}`);
        reject(new Error(`Request timed out: ${request.method}`));
      }, 10000); // 10 second timeout (reduced for debugging)
      
      // Add the request to pending
      this.pendingRequests.set(signedEvent.id, (response: NIP47Response) => {
        console.log(`Resolver called for request ${signedEvent.id}`);
        clearTimeout(timeoutId);
        
        if (response.error) {
          const error = new Error(response.error.message);
          // @ts-ignore - Add the error code
          error.code = response.error.code;
          reject(error);
        } else {
          resolve(response as TResponse);
        }
      });
      
      // Log the current pending requests for debugging
      console.log(`Added to pending requests: ${signedEvent.id}`);
      console.log(`Current pending requests: ${Array.from(this.pendingRequests.keys()).join(', ')}`);
    });
    
    try {
      // Publish the event
      await this.client.publishEvent(signedEvent);
      console.log(`Request published with ID: ${signedEvent.id}`);
      
      // Wait for response
      return await responsePromise;
    } catch (error) {
      // Clean up the pending request if there was an error publishing
      this.pendingRequests.delete(signedEvent.id);
      throw error;
    }
  }

  /**
   * Get wallet info
   */
  public async getInfo(): Promise<any> {
    const response = await this.sendRequest({
      method: NIP47Method.GET_INFO,
      params: {}
    });
    return response.result;
  }

  /**
   * Get wallet balance
   */
  public async getBalance(): Promise<number> {
    const response = await this.sendRequest({
      method: NIP47Method.GET_BALANCE,
      params: {}
    });
    return response.result as number;
  }

  /**
   * Pay a lightning invoice
   */
  public async payInvoice(invoice: string, amount?: number, maxfee?: number): Promise<any> {
    const response = await this.sendRequest({
      method: NIP47Method.PAY_INVOICE,
      params: {
        invoice,
        amount,
        maxfee
      }
    });
    return response.result;
  }

  /**
   * Create a lightning invoice
   */
  public async makeInvoice(amount: number, description: string, description_hash?: string, expiry?: number): Promise<any> {
    const response = await this.sendRequest({
      method: NIP47Method.MAKE_INVOICE,
      params: {
        amount,
        description,
        description_hash,
        expiry
      }
    });
    return response.result;
  }

  /**
   * Look up an invoice by payment hash or bolt11 string
   */
  public async lookupInvoice(params: { payment_hash?: string, invoice?: string }): Promise<any> {
    const response = await this.sendRequest({
      method: NIP47Method.LOOKUP_INVOICE,
      params
    });
    return response.result;
  }

  /**
   * List transactions
   */
  public async listTransactions(params: {
    from?: number;
    until?: number;
    limit?: number;
    offset?: number;
    unpaid?: boolean;
    type?: TransactionType | string;
  } = {}): Promise<any> {
    const response = await this.sendRequest({
      method: NIP47Method.LIST_TRANSACTIONS,
      params
    });
    
    // Ensure we return a standardized format with a transactions array
    const result = response.result;
    
    if (Array.isArray(result)) {
      return { transactions: result };
    }
    
    return result;
  }

  /**
   * Sign a message with the wallet's private key
   */
  public async signMessage(message: string): Promise<any> {
    const response = await this.sendRequest({
      method: NIP47Method.SIGN_MESSAGE,
      params: {
        message
      }
    });
    return response.result;
  }
} 