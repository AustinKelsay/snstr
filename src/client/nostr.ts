import { Relay } from './relay';
import { NostrEvent, Filter, RelayEvent } from '../types/nostr';
import { getPublicKey, generateKeypair, signEvent, decryptMessage } from '../utils/crypto';
import { createSignedEvent, createTextNote, createDirectMessage, createMetadataEvent } from '../utils/event';

export class Nostr {
  private relays: Map<string, Relay> = new Map();
  private privateKey?: string;
  private publicKey?: string;

  constructor(relayUrls: string[] = []) {
    relayUrls.forEach((url) => this.addRelay(url));
  }

  public addRelay(url: string): Relay {
    if (this.relays.has(url)) {
      return this.relays.get(url)!;
    }

    const relay = new Relay(url);
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

  public async publishEvent(event: NostrEvent): Promise<void> {
    const publishPromises = Array.from(this.relays.values()).map((relay) => relay.publish(event));
    await Promise.all(publishPromises);
  }

  public async publishTextNote(content: string, tags: string[][] = []): Promise<NostrEvent | null> {
    if (!this.privateKey || !this.publicKey) {
      throw new Error('Private key is not set');
    }

    const noteTemplate = createTextNote(content, tags);
    const signedEvent = await createSignedEvent(noteTemplate, this.privateKey, this.publicKey);
    
    await this.publishEvent(signedEvent);
    return signedEvent;
  }

  public async publishDirectMessage(
    content: string,
    recipientPubkey: string,
    tags: string[][] = []
  ): Promise<NostrEvent | null> {
    if (!this.privateKey || !this.publicKey) {
      throw new Error('Private key is not set');
    }

    const dmTemplate = createDirectMessage(content, recipientPubkey, this.privateKey, tags);
    const signedEvent = await createSignedEvent(dmTemplate, this.privateKey, this.publicKey);
    
    await this.publishEvent(signedEvent);
    return signedEvent;
  }

  /**
   * Decrypt a direct message received from another user
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
      return decryptMessage(event.content, this.privateKey, senderPubkey);
    } catch (error) {
      console.error('Failed to decrypt message:', error);
      throw new Error('Failed to decrypt message. Make sure you are the intended recipient.');
    }
  }

  public async publishMetadata(metadata: Record<string, any>): Promise<NostrEvent | null> {
    if (!this.privateKey || !this.publicKey) {
      throw new Error('Private key is not set');
    }

    const metadataTemplate = createMetadataEvent(metadata);
    const signedEvent = await createSignedEvent(metadataTemplate, this.privateKey, this.publicKey);
    
    await this.publishEvent(signedEvent);
    return signedEvent;
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

  public on(event: RelayEvent, callback: (relay: string, ...args: any[]) => void): void {
    this.relays.forEach((relay) => {
      relay.on(event, callback);
    });
  }
} 