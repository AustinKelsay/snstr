import { Nostr } from '../client/nostr';
import { generateKeypair } from '../utils/crypto';
import { encrypt as encryptNIP44, decrypt as decryptNIP44 } from '../nip44';
import { encrypt as encryptNIP04, decrypt as decryptNIP04 } from '../nip04';
import { NostrEvent, NostrFilter } from '../types/nostr';
import { 
  NIP46Method, 
  NIP46Request, 
  NIP46Response, 
  NIP46ClientOptions,
  NIP46ConnectionInfo,
  NIP46Metadata,
  NIP46EncryptionResult 
} from './types';

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_ENCRYPTION = 'nip44' as const;

export class NostrRemoteSignerClient {
  private nostr: Nostr;
  private clientKeypair: { publicKey: string; privateKey: string } | null = null;
  private signerPubkey: string | null = null;
  private userPubkey: string | null = null;
  private pendingRequests = new Map<string, {
    resolve: (response: NIP46Response) => void;
    reject: (reason: any) => void;
    timeout: NodeJS.Timeout;
  }>();
  private options: NIP46ClientOptions;
  private preferredEncryption: 'nip44' | 'nip04';
  private authWindow: Window | null;
  private connected = false;
  private subId: string | null = null;

  constructor(options: NIP46ClientOptions = {}) {
    this.options = {
      timeout: DEFAULT_TIMEOUT,
      relays: [],
      secret: '',
      permissions: [],
      name: '',
      url: '',
      image: '',
      preferredEncryption: DEFAULT_ENCRYPTION,
      ...options
    };
    this.nostr = new Nostr(this.options.relays);
    this.preferredEncryption = this.options.preferredEncryption || DEFAULT_ENCRYPTION;
    this.authWindow = null;
  }

  /**
   * Set up subscription to receive responses from the signer
   */
  private async setupSubscription(): Promise<void> {
    if (this.subId) {
      this.nostr.unsubscribe([this.subId]);
    }

    if (!this.clientKeypair) {
      throw new Error('Client keypair not initialized');
    }

    const filter: NostrFilter = {
      kinds: [24133],
      '#p': [this.clientKeypair.publicKey]
    };

    this.subId = this.nostr.subscribe(
      [filter],
      (event) => this.handleResponse(event)
    )[0];
  }

  /**
   * Clean up resources and reset state
   */
  private async cleanup(): Promise<void> {
    if (this.subId) {
      this.nostr.unsubscribe([this.subId]);
      this.subId = null;
    }

    await this.nostr.disconnectFromRelays();
    
    this.connected = false;
    this.signerPubkey = null;
    this.userPubkey = null;
    
    this.pendingRequests.forEach((request) => {
      clearTimeout(request.timeout);
      request.reject(new Error('Client disconnected'));
    });
    this.pendingRequests.clear();
  }

  /**
   * Connect to a remote signer
   * @throws {Error} If connection fails or validation fails
   */
  public async connect(connectionString: string): Promise<string> {
    try {
      // Generate client keypair if needed
      if (!this.clientKeypair) {
        this.clientKeypair = await generateKeypair();
      }

      // Connect to relays
      await this.nostr.connectToRelays();

      // Parse connection info
      const connectionInfo = this.parseConnectionString(connectionString);
      this.signerPubkey = connectionInfo.pubkey;

      // Update relays if needed
      if (connectionInfo.relays?.length) {
        this.options.relays = connectionInfo.relays;
        this.nostr = new Nostr(connectionInfo.relays);
        await this.nostr.connectToRelays();
      }

      // Set up subscription
      await this.setupSubscription();

      // Send connect request
      const response = await this.sendRequest(NIP46Method.CONNECT, [
        this.signerPubkey,
        connectionInfo.secret || this.options.secret || '',
        [...new Set([
          ...(this.options.permissions || []),
          ...(connectionInfo.permissions || [])
        ])].join(',')
      ]);

      // Handle auth challenge
      if (response.auth_url) {
        // Wait for authentication to complete (will be handled by handleResponse)
        const authTimeout = this.options.timeout || DEFAULT_TIMEOUT;
        await new Promise<void>((resolve, reject) => {
          setTimeout(() => {
            reject(new Error('Authentication challenge timed out'));
          }, authTimeout);
          
          // Check periodically if we can connect
          const checkInterval = setInterval(async () => {
            try {
              if (this.connected) {
                clearInterval(checkInterval);
                resolve();
              }
              
              // Try to get the public key as a test of successful connection
              await this.getPublicKey();
              clearInterval(checkInterval);
              resolve();
            } catch (err) {
              // Keep trying until timeout
            }
          }, 1000);
        });
      } else {
        // Validate response
        if (response.error) {
          throw new Error(`Connection failed: ${response.error}`);
        }

        if (connectionInfo.type === 'nostrconnect' && 
            connectionInfo.secret && 
            response.result !== connectionInfo.secret) {
          throw new Error('Connection secret validation failed');
        }

        this.connected = true;
      }

      // Get user's public key (required by NIP-46)
      this.userPubkey = await this.getPublicKey();
      if (!this.userPubkey) {
        throw new Error('Failed to get user public key');
      }
      
      return this.userPubkey;
    } catch (error) {
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Parse a connection string into connection info
   */
  private parseConnectionString(str: string): NIP46ConnectionInfo {
    if (!str.startsWith('bunker://') && !str.startsWith('nostrconnect://')) {
      throw new Error('Invalid connection string format. Must start with bunker:// or nostrconnect://');
    }

    try {
      const url = new URL(str);
      const type = url.protocol === 'bunker:' ? 'bunker' : 'nostrconnect';
      
      // Extract the pubkey from the hostname
      const pubkey = url.hostname;
      
      if (!pubkey || pubkey.length !== 64) {
        throw new Error('Invalid signer public key in connection string');
      }
      
      const relays = url.searchParams.getAll('relay');
      const secret = url.searchParams.get('secret') || undefined;
      const permissions = url.searchParams.get('perms')?.split(',');
      
      const metadata: NIP46Metadata = {};
      if (url.searchParams.has('name')) metadata.name = url.searchParams.get('name')!;
      if (url.searchParams.has('url')) metadata.url = url.searchParams.get('url')!;
      if (url.searchParams.has('image')) metadata.image = url.searchParams.get('image')!;

      return { type, pubkey, relays, secret, permissions, metadata };
    } catch (error) {
      throw new Error(`Failed to parse connection string: ${error}`);
    }
  }

  /**
   * Disconnect from the remote signer
   */
  public async disconnect(): Promise<void> {
    await this.cleanup();
  }

  /**
   * Sign an event using the remote signer
   */
  async signEvent(eventData: Partial<NostrEvent>): Promise<NostrEvent> {
    if (!this.connected || !this.clientKeypair || !this.signerPubkey) {
      throw new Error('Client not connected');
    }

    const response = await this.sendRequest(NIP46Method.SIGN_EVENT, [
      JSON.stringify(eventData)
    ]);

    if (response.error) {
      throw new Error(`Signing failed: ${response.error}`);
    }

    if (response.auth_url) {
      throw new Error('Auth challenge not supported in this implementation');
    }

    return JSON.parse(response.result!);
  }

  /**
   * Get the user's public key from the remote signer
   */
  async getPublicKey(): Promise<string> {
    if (!this.connected || !this.clientKeypair || !this.signerPubkey) {
      throw new Error('Client not connected');
    }

    const response = await this.sendRequest(NIP46Method.GET_PUBLIC_KEY, []);
    if (response.error) {
      throw new Error(`Failed to get public key: ${response.error}`);
    }
    return response.result!;
  }

  /**
   * Send a ping to the remote signer
   */
  async ping(): Promise<string> {
    if (!this.connected || !this.clientKeypair || !this.signerPubkey) {
      throw new Error('Client not connected');
    }

    const response = await this.sendRequest(NIP46Method.PING, []);
    if (response.error) {
      throw new Error(`Ping failed: ${response.error}`);
    }
    return response.result!;
  }

  /**
   * Encrypt a message using NIP-04
   */
  async nip04Encrypt(thirdPartyPubkey: string, plaintext: string): Promise<string> {
    if (!this.connected || !this.clientKeypair || !this.signerPubkey) {
      throw new Error('Not connected to remote signer');
    }

    const response = await this.sendRequest(
      NIP46Method.NIP04_ENCRYPT, 
      [thirdPartyPubkey, plaintext]
    );

    if (response.error) {
      throw new Error(`NIP-04 encryption failed: ${response.error}`);
    }

    return response.result!;
  }

  /**
   * Decrypt a message using NIP-04
   */
  async nip04Decrypt(thirdPartyPubkey: string, ciphertext: string): Promise<string> {
    if (!this.connected || !this.clientKeypair || !this.signerPubkey) {
      throw new Error('Not connected to remote signer');
    }

    const response = await this.sendRequest(
      NIP46Method.NIP04_DECRYPT, 
      [thirdPartyPubkey, ciphertext]
    );

    if (response.error) {
      throw new Error(`NIP-04 decryption failed: ${response.error}`);
    }

    return response.result!;
  }

  /**
   * Encrypt a message using NIP-44
   */
  async nip44Encrypt(thirdPartyPubkey: string, plaintext: string): Promise<string> {
    if (!this.connected || !this.clientKeypair || !this.signerPubkey) {
      throw new Error('Not connected to remote signer');
    }

    const response = await this.sendRequest(
      NIP46Method.NIP44_ENCRYPT, 
      [thirdPartyPubkey, plaintext]
    );

    if (response.error) {
      throw new Error(`NIP-44 encryption failed: ${response.error}`);
    }

    return response.result!;
  }

  /**
   * Decrypt a message using NIP-44
   */
  async nip44Decrypt(thirdPartyPubkey: string, ciphertext: string): Promise<string> {
    if (!this.connected || !this.clientKeypair || !this.signerPubkey) {
      throw new Error('Not connected to remote signer');
    }

    const response = await this.sendRequest(
      NIP46Method.NIP44_DECRYPT, 
      [thirdPartyPubkey, ciphertext]
    );

    if (response.error) {
      throw new Error(`NIP-44 decryption failed: ${response.error}`);
    }

    return response.result!;
  }

  /**
   * Send a request to the remote signer
   */
  private async sendRequest(method: NIP46Method, params: string[]): Promise<NIP46Response> {
    if (!this.clientKeypair || !this.signerPubkey) {
      throw new Error('Client not initialized');
    }

    // Generate a random ID for the request
    const id = Math.random().toString(36).substring(2, 15);
    
    const request: NIP46Request = {
      id,
      method,
      params,
    };

    return new Promise<NIP46Response>((resolve, reject) => {
      // Set a timeout to reject the promise if we don't get a response
      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timed out: ${method}`));
        }
      }, this.options.timeout || DEFAULT_TIMEOUT);

      // Store the request with its callbacks
      this.pendingRequests.set(id, { 
        resolve: (response) => {
          // Make sure we only resolve once
          if (this.pendingRequests.has(id)) {
            clearTimeout(timeout);
            this.pendingRequests.delete(id);
            resolve(response);
          }
        }, 
        reject: (error) => {
          // Make sure we only reject once
          if (this.pendingRequests.has(id)) {
            clearTimeout(timeout);
            this.pendingRequests.delete(id);
            reject(error);
          }
        }, 
        timeout 
      });

      // Send the request
      this.sendEncryptedRequest(request).catch((error) => {
        if (this.pendingRequests.has(id)) {
          clearTimeout(timeout);
          this.pendingRequests.delete(id);
          reject(error);
        }
      });
    });
  }

  /**
   * Encrypt and send a request to the signer
   */
  private async sendEncryptedRequest(request: NIP46Request): Promise<void> {
    if (!this.clientKeypair || !this.signerPubkey) {
      throw new Error('Client not initialized');
    }

    // Encrypt the request content
    let encryptedContent: string;
    try {
      const jsonStr = JSON.stringify(request);
      
      if (this.preferredEncryption === 'nip44') {
        try {
          encryptedContent = encryptNIP44(
            jsonStr,
            this.clientKeypair.privateKey,
            this.signerPubkey
          );
        } catch (e) {
          // Fall back to NIP-04
          encryptedContent = encryptNIP04(
            jsonStr,
            this.clientKeypair.privateKey,
            this.signerPubkey
          );
          this.preferredEncryption = 'nip04';
        }
      } else {
        try {
          encryptedContent = encryptNIP04(
            jsonStr,
            this.clientKeypair.privateKey,
            this.signerPubkey
          );
        } catch (e) {
          // Fall back to NIP-44
          encryptedContent = encryptNIP44(
            jsonStr,
            this.clientKeypair.privateKey,
            this.signerPubkey
          );
          this.preferredEncryption = 'nip44';
        }
      }
    } catch (error) {
      throw new Error(`Failed to encrypt request: ${error}`);
    }

    // Create and publish the event
    try {
      await this.nostr.publishEvent({
        kind: 24133,
        pubkey: this.clientKeypair.publicKey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', this.signerPubkey]],
        content: encryptedContent,
        id: '',
        sig: ''
      });
    } catch (error) {
      throw new Error(`Failed to publish request: ${error}`);
    }
  }

  /**
   * Handle a response from the signer
   */
  private async handleResponse(event: NostrEvent): Promise<void> {
    try {
      // If we're not connected or don't have a client keypair, ignore this event
      if (!this.connected || !this.clientKeypair || !this.signerPubkey) {
        return;
      }

      // Ensure the event is from our signer
      if (event.pubkey !== this.signerPubkey) {
        return;
      }

      // Decrypt event content
      const decryptResult = await this.decryptContent(event.content, event.pubkey);
      if (!decryptResult.success) {
        // Silently ignore decrypt failures - they might be for other clients
        return;
      }

      const data = decryptResult.data;
      const response: NIP46Response = JSON.parse(data);

      // Handle auth URL: open the auth URL in a popup or redirect
      if (response.auth_url) {
        this.handleAuthChallenge(response);
        return;
      }

      // Find the corresponding request handler and call it
      const pendingRequest = this.pendingRequests.get(response.id);
      if (!pendingRequest) {
        // Response for a request that no longer exists or timed out
        // This is normal and can happen when requests time out
        // No need to warn about it
        return;
      }

      // Clear timeout and remove from pending requests
      clearTimeout(pendingRequest.timeout);
      this.pendingRequests.delete(response.id);

      // Handle the response
      pendingRequest.resolve(response);
    } catch (error: any) {
      console.error('Error handling response:', error.message);
    }
  }

  /**
   * Decrypt content from the signer
   * @private
   */
  private async decryptContent(content: string, authorPubkey: string): Promise<NIP46EncryptionResult> {
    if (!this.clientKeypair) {
      return { 
        success: false, 
        error: 'Client keypair not initialized',
        method: this.preferredEncryption
      };
    }

    // Try preferred method first
    try {
      if (this.preferredEncryption === 'nip44') {
        const decrypted = decryptNIP44(content, this.clientKeypair.privateKey, authorPubkey);
        return { 
          success: true, 
          data: decrypted,
          method: 'nip44' 
        };
      } else {
        const decrypted = decryptNIP04(content, this.clientKeypair.privateKey, authorPubkey);
        return { 
          success: true, 
          data: decrypted,
          method: 'nip04' 
        };
      }
    } catch (error1) {
      // Try the other method as fallback
      try {
        if (this.preferredEncryption === 'nip44') {
          const decrypted = decryptNIP04(content, this.clientKeypair.privateKey, authorPubkey);
          this.preferredEncryption = 'nip04'; // Switch preference for future messages
          return { 
            success: true, 
            data: decrypted,
            method: 'nip04' 
          };
        } else {
          const decrypted = decryptNIP44(content, this.clientKeypair.privateKey, authorPubkey);
          this.preferredEncryption = 'nip44'; // Switch preference for future messages
          return { 
            success: true, 
            data: decrypted,
            method: 'nip44' 
          };
        }
      } catch (error2) {
        // Both methods failed
        return { 
          success: false, 
          error: `Decryption failed: ${error1}. Fallback also failed: ${error2}`,
          method: this.preferredEncryption 
        };
      }
    }
  }

  /**
   * Handle authentication challenge
   * @private
   */
  private handleAuthChallenge(response: NIP46Response): void {
    if (response.auth_url && typeof window !== 'undefined') {
      // Open auth window if not already open
      if (!this.authWindow || this.authWindow.closed) {
        this.authWindow = window.open(response.auth_url, '_blank');
      }
    }
  }

  /**
   * Generate a nostrconnect:// URL to allow the signer to connect to the client
   */
  static generateConnectionString(
    clientPubkey: string,
    options: NIP46ClientOptions = {}
  ): string {
    if (!clientPubkey) {
      throw new Error('Client public key is required');
    }

    const params = new URLSearchParams();
    
    // Add required relays
    if (options.relays && options.relays.length > 0) {
      options.relays.forEach(relay => params.append('relay', relay));
    }
    
    // Generate a random secret
    const secret = options.secret || Math.random().toString(36).substring(2, 10);
    params.append('secret', secret);
    
    // Add optional metadata
    if (options.name) params.append('name', options.name);
    if (options.url) params.append('url', options.url);
    if (options.image) params.append('image', options.image);
    
    // Add permissions
    if (options.permissions && options.permissions.length > 0) {
      params.append('perms', options.permissions.join(','));
    }
    
    return `nostrconnect://${clientPubkey}?${params.toString()}`;
  }
} 