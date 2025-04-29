import { Relay } from './relay';
import { NostrEvent, Filter, RelayEvent } from '../types/nostr';
import { getPublicKey, generateKeypair, signEvent } from '../utils/crypto';
import { decrypt as decryptNIP04 } from '../nip04';
import { createSignedEvent, createTextNote, createDirectMessage, createMetadataEvent } from '../utils/event';

export class Nostr {
  private relays: Map<string, Relay> = new Map();
  private privateKey?: string;
  private publicKey?: string;
  private relayOptions?: { connectionTimeout?: number };

  /**
   * Create a new Nostr client
   * @param relayUrls List of relay URLs to connect to
   * @param options Client options
   * @param options.relayOptions Options to pass to each Relay instance
   */
  constructor(
    relayUrls: string[] = [], 
    options?: { 
      relayOptions?: { 
        connectionTimeout?: number 
      } 
    }
  ) {
    this.relayOptions = options?.relayOptions;
    relayUrls.forEach((url) => this.addRelay(url));
  }

  public addRelay(url: string): Relay {
    if (this.relays.has(url)) {
      return this.relays.get(url)!;
    }

    const relay = new Relay(url, this.relayOptions);
    this.relays.set(url, relay);
    return relay;
  }

  public removeRelay(url: string): void {
    const relay = this.relays.get(url);
    if (relay) {
      relay.disconnect();
      this.relays.delete(url);
    }
  }

  public async connectToRelays(): Promise<void> {
    const connectPromises = Array.from(this.relays.values()).map((relay) => relay.connect());
    await Promise.all(connectPromises);
  }

  public disconnectFromRelays(): void {
    this.relays.forEach((relay) => relay.disconnect());
  }

  public setPrivateKey(privateKey: string): void {
    this.privateKey = privateKey;
    this.publicKey = getPublicKey(privateKey);
  }

  public async generateKeys(): Promise<{ privateKey: string; publicKey: string }> {
    const keypair = await generateKeypair();
    this.privateKey = keypair.privateKey;
    this.publicKey = keypair.publicKey;
    return keypair;
  }

  public getPublicKey(): string | undefined {
    return this.publicKey;
  }

  public async publishEvent(event: NostrEvent, options?: { timeout?: number }): Promise<{
    success: boolean;
    event: NostrEvent | null;
    relayResults: Map<string, { success: boolean; reason?: string }>;
  }> {
    if (!this.relays.size) {
      console.warn('No relays configured for publishing');
      return {
        success: false,
        event: null,
        relayResults: new Map()
      };
    }

    try {
      const relayResults = new Map<string, { success: boolean; reason?: string }>();
      const publishPromises = Array.from(this.relays.entries()).map(async ([url, relay]) => {
        const result = await relay.publish(event, options);
        relayResults.set(url, result);
        return result;
      });
      
      const results = await Promise.all(publishPromises);
      
      // Check if at least one relay accepted the event
      const atLeastOneSuccess = results.some(result => result.success);
      
      if (atLeastOneSuccess) {
        return {
          success: true,
          event,
          relayResults
        };
      } else {
        // Get reasons for failures
        const failureReasons = Array.from(relayResults.entries())
          .filter(([_, result]) => !result.success)
          .map(([url, result]) => `${url}: ${result.reason || 'unknown'}`);
        
        console.warn('Failed to publish event to any relay:', failureReasons.join(', '));
        
        return {
          success: false,
          event: null,
          relayResults
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'unknown error';
      console.error('Failed to publish event:', errorMessage);
      
      return {
        success: false,
        event: null,
        relayResults: new Map()
      };
    }
  }

  public async publishTextNote(content: string, tags: string[][] = [], options?: { timeout?: number }): Promise<NostrEvent | null> {
    if (!this.privateKey || !this.publicKey) {
      throw new Error('Private key is not set');
    }

    const noteTemplate = createTextNote(content, this.privateKey, tags);
    const signedEvent = await createSignedEvent(noteTemplate, this.privateKey);
    
    const publishResult = await this.publishEvent(signedEvent, options);
    return publishResult.success ? publishResult.event : null;
  }

  public async publishDirectMessage(
    content: string,
    recipientPubkey: string,
    tags: string[][] = [],
    options?: { timeout?: number }
  ): Promise<NostrEvent | null> {
    if (!this.privateKey || !this.publicKey) {
      throw new Error('Private key is not set');
    }

    const dmTemplate = createDirectMessage(content, recipientPubkey, this.privateKey, tags);
    const signedEvent = await createSignedEvent(dmTemplate, this.privateKey);
    
    const publishResult = await this.publishEvent(signedEvent, options);
    return publishResult.success ? publishResult.event : null;
  }

  /**
   * Decrypt a direct message received from another user
   * 
   * Uses NIP-04 encryption which is the standard for kind:4 direct messages
   */
  public decryptDirectMessage(event: NostrEvent): string {
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
      return decryptNIP04(event.content, this.privateKey, senderPubkey);
    } catch (error) {
      console.error('Failed to decrypt message:', error);
      throw new Error('Failed to decrypt message. Make sure you are the intended recipient.');
    }
  }

  public async publishMetadata(metadata: Record<string, any>, options?: { timeout?: number }): Promise<NostrEvent | null> {
    if (!this.privateKey || !this.publicKey) {
      throw new Error('Private key is not set');
    }

    const metadataTemplate = createMetadataEvent(metadata, this.privateKey);
    const signedEvent = await createSignedEvent(metadataTemplate, this.privateKey);
    
    const publishResult = await this.publishEvent(signedEvent, options);
    return publishResult.success ? publishResult.event : null;
  }

  public subscribe(
    filters: Filter[],
    onEvent: (event: NostrEvent, relay: string) => void,
    onEOSE?: () => void
  ): string[] {
    const subscriptionIds: string[] = [];

    this.relays.forEach((relay, url) => {
      const id = relay.subscribe(
        filters,
        (event) => onEvent(event, url),
        onEOSE
      );
      subscriptionIds.push(id);
    });

    return subscriptionIds;
  }

  public unsubscribe(subscriptionIds: string[]): void {
    this.relays.forEach((relay) => {
      subscriptionIds.forEach((id) => relay.unsubscribe(id));
    });
  }

  public unsubscribeAll(): void {
    // Clear all subscriptions on all relays
    this.relays.forEach((relay) => {
      // The Relay class handles clearing its internal subscription map
      relay.disconnect();
    });
  }

  public on(event: RelayEvent, callback: (relay: string, ...args: any[]) => void): void {
    this.relays.forEach((relay, url) => {
      relay.on(event, (...args: any[]) => {
        callback(url, ...args);
      });
    });
  }

  /**
   * Publish an event and get detailed results from all relays
   * 
   * @param event The NostrEvent to publish
   * @param options Options including timeout
   * @returns Detailed publish results including success status and relay-specific information
   */
  public async publishWithDetails(event: NostrEvent, options?: { timeout?: number }): Promise<{
    success: boolean;
    event: NostrEvent;
    relayResults: Map<string, { success: boolean; reason?: string }>;
    successCount: number;
    failureCount: number;
  }> {
    const result = await this.publishEvent(event, options);
    
    // Count successful and failed relays
    let successCount = 0;
    let failureCount = 0;
    
    result.relayResults.forEach(relayResult => {
      if (relayResult.success) {
        successCount++;
      } else {
        failureCount++;
      }
    });
    
    return {
      ...result,
      event: result.event || event,
      successCount,
      failureCount
    };
  }
} 