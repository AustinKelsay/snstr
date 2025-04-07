import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { NostrRelay } from '../../src/utils/ephemeral-relay';
import { generateKeypair } from '../../src/utils/crypto';
import { 
  NostrWalletConnectClient, 
  NostrWalletService,
  WalletImplementation,
  NIP47Transaction,
  NIP47Method,
  NIP47NotificationType,
  TransactionType,
  NIP47ConnectionOptions,
  generateNWCURL,
  parseNWCURL,
  NIP47ErrorCode
} from '../../src/nip47';

// Mock Implementation
class MockWalletImplementation implements WalletImplementation {
  private balance: number = 50000000; // 50,000 sats
  
  async getInfo(): Promise<any> {
    return {
      alias: 'Test Wallet',
      color: '#ff0000',
      pubkey: '00000000000000000000000000000000000000000000000000000000000000',
      network: 'regtest',
      methods: [
        NIP47Method.GET_INFO,
        NIP47Method.GET_BALANCE,
        NIP47Method.PAY_INVOICE,
        NIP47Method.MAKE_INVOICE,
        NIP47Method.LOOKUP_INVOICE,
        NIP47Method.LIST_TRANSACTIONS
      ],
      notifications: [
        NIP47NotificationType.PAYMENT_RECEIVED,
        NIP47NotificationType.PAYMENT_SENT
      ]
    };
  }
  
  async getBalance(): Promise<number> {
    return this.balance;
  }
  
  async payInvoice(invoice: string): Promise<any> {
    return {
      preimage: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      payment_hash: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
      amount: 1000,
      fees_paid: 10
    };
  }
  
  async makeInvoice(amount: number, description: string): Promise<any> {
    return {
      invoice: 'lnbc10n1ptest',
      payment_hash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      amount,
      created_at: Math.floor(Date.now() / 1000),
      expires_at: Math.floor(Date.now() / 1000) + 3600
    };
  }
  
  async lookupInvoice(): Promise<NIP47Transaction> {
    return {
      type: TransactionType.INCOMING,
      invoice: 'lnbc10n1ptest',
      payment_hash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      amount: 1000,
      fees_paid: 0,
      created_at: Math.floor(Date.now() / 1000) - 3600,
      settled_at: Math.floor(Date.now() / 1000) - 3000
    };
  }
  
  async listTransactions(from?: number, until?: number, limit?: number, offset?: number, unpaid?: boolean, type?: string): Promise<NIP47Transaction[]> {
    return [
      {
        type: TransactionType.INCOMING,
        invoice: 'lnbc10n1ptest1',
        payment_hash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
        amount: 1000,
        fees_paid: 0,
        created_at: Math.floor(Date.now() / 1000) - 7200,
        settled_at: Math.floor(Date.now() / 1000) - 7100
      },
      {
        type: TransactionType.OUTGOING,
        invoice: 'lnbc20n1ptest2',
        payment_hash: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
        preimage: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        amount: 2000,
        fees_paid: 20,
        created_at: Math.floor(Date.now() / 1000) - 3600,
        settled_at: Math.floor(Date.now() / 1000) - 3500
      }
    ];
  }
  
  async signMessage(message: string): Promise<{signature: string, message: string}> {
    return {
      signature: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      message
    };
  }
}

describe('NIP-47: Nostr Wallet Connect', () => {
  let relay: NostrRelay;
  let serviceKeypair: { privateKey: string; publicKey: string };
  let clientKeypair: { privateKey: string; publicKey: string };
  let connectionOptions: NIP47ConnectionOptions;
  let service: NostrWalletService;
  let client: NostrWalletConnectClient;
  
  beforeAll(async () => {
    // Start ephemeral relay
    relay = new NostrRelay(3047); // Use port 3047 for NIP-47 tests
    await relay.start();
    
    // Generate keypairs for service and client
    serviceKeypair = await generateKeypair();
    clientKeypair = await generateKeypair();
    
    // Create connection options
    connectionOptions = {
      pubkey: serviceKeypair.publicKey,
      secret: clientKeypair.privateKey, // Use client private key as secret
      relays: [relay.url]
    };
    
    // Create and initialize service
    service = new NostrWalletService(
      {
        relays: [relay.url],
        pubkey: serviceKeypair.publicKey,
        privkey: serviceKeypair.privateKey,
        methods: Object.values(NIP47Method),
        notificationTypes: Object.values(NIP47NotificationType)
      },
      new MockWalletImplementation()
    );
    
    await service.init();
    
    // Create and initialize client
    client = new NostrWalletConnectClient(connectionOptions);
    
    try {
      await client.init();
      
      // Wait for client to connect and discover capabilities
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Failed to initialize client:', error);
      throw error;
    }
  });
  
  afterAll(async () => {
    // Clean up resources
    client.disconnect();
    service.disconnect();
    await relay.close();
  });
  
  describe('URL Handling', () => {
    it('should generate valid NWC URLs', () => {
      const url = generateNWCURL(connectionOptions);
      expect(url.startsWith('nostr+walletconnect://')).toBe(true);
      expect(url).toContain(connectionOptions.pubkey);
      expect(url).toContain('relay=');
      expect(url).toContain('secret=');
    });
    
    it('should parse NWC URLs correctly', () => {
      const url = generateNWCURL(connectionOptions);
      const parsed = parseNWCURL(url);
      
      expect(parsed.pubkey).toBe(connectionOptions.pubkey);
      expect(parsed.secret).toBe(connectionOptions.secret);
      expect(parsed.relays).toEqual(expect.arrayContaining(connectionOptions.relays));
    });
    
    it('should reject invalid NWC URLs', () => {
      expect(() => parseNWCURL('invalid')).toThrow();
      expect(() => parseNWCURL('nostr+walletconnect://')).toThrow();
      expect(() => parseNWCURL('nostr+walletconnect://pubkey')).toThrow();
    });
  });
  
  describe('Basic Client-Service Communication', () => {
    it('should get wallet info', async () => {
      jest.setTimeout(10000);
      const info = await client.getInfo();
      expect(info).toBeDefined();
      if (info) {
        expect(info.methods).toContain(NIP47Method.GET_INFO);
        expect(info.methods).toContain(NIP47Method.GET_BALANCE);
      } else {
        fail('Info result was null');
      }
    });
    
    it('should get wallet balance', async () => {
      jest.setTimeout(10000);
      const balance = await client.getBalance();
      expect(typeof balance).toBe('number');
      expect(balance).toBeGreaterThan(0);
    });
    
    it('should create an invoice', async () => {
      jest.setTimeout(10000);
      const invoice = await client.makeInvoice(1000, 'Test invoice');
      expect(invoice).toBeDefined();
      if (invoice) {
        expect(invoice.invoice).toBeDefined();
        expect(invoice.payment_hash).toBeDefined();
        expect(invoice.amount).toBe(1000);
      } else {
        fail('Invoice was null');
      }
    });
    
    it('should look up an invoice', async () => {
      jest.setTimeout(10000);
      const invoice = await client.lookupInvoice('abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789');
      expect(invoice).toBeDefined();
      if (invoice) {
        expect(invoice.payment_hash).toBeDefined();
        expect(invoice.type).toBe(TransactionType.INCOMING);
      } else {
        fail('Invoice lookup result was null');
      }
    });
    
    it('should list transactions', async () => {
      jest.setTimeout(10000);
      const result = await client.listTransactions({ limit: 10 });
      expect(result).toBeDefined();
      if (result) {
        // Check that transactions is an array and has at least one item
        expect(Array.isArray(result.transactions)).toBe(true);
        expect(result.transactions.length).toBeGreaterThan(0);
      } else {
        fail('Transaction list result was null');
      }
    });
    
    it('should pay an invoice', async () => {
      jest.setTimeout(10000);
      const payment = await client.payInvoice('lnbc10n1pdummy');
      expect(payment).toBeDefined();
      if (payment) {
        expect(payment.preimage).toBeDefined();
        expect(payment.payment_hash).toBeDefined();
      } else {
        fail('Payment result was null');
      }
    });
    
    it('should sign a message', async () => {
      jest.setTimeout(10000);
      const result = await client.signMessage('Test message');
      expect(result).toBeDefined();
      if (result) {
        expect(result.signature).toBeDefined();
        expect(result.message).toBe('Test message');
      } else {
        fail('Sign message result was null');
      }
    });
  });
  
  describe('Notifications', () => {
    it('should receive notifications from service', async () => {
      jest.setTimeout(10000);
      // Set up notification handler
      const notificationPromise = new Promise<any>(resolve => {
        client.onNotification(NIP47NotificationType.PAYMENT_RECEIVED, (notification) => {
          resolve(notification);
        });
      });
      
      // Send notification from service
      await service.sendNotification(
        client.getPublicKey(),
        NIP47NotificationType.PAYMENT_RECEIVED,
        {
          type: TransactionType.INCOMING,
          invoice: 'lnbc100n1test',
          payment_hash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          amount: 10000,
          fees_paid: 0,
          created_at: Math.floor(Date.now() / 1000),
          settled_at: Math.floor(Date.now() / 1000)
        }
      );
      
      // Wait for notification
      const notification = await notificationPromise;
      expect(notification).toBeDefined();
      expect(notification.notification_type).toBe(NIP47NotificationType.PAYMENT_RECEIVED);
      expect(notification.notification.payment_hash).toBeDefined();
    });
  });
  
  describe('Error Handling', () => {
    it('should handle expired requests', async () => {
      jest.setTimeout(10000);
      
      // Create a request with an already expired timestamp
      const expiredTime = Math.floor(Date.now() / 1000) - 60; // 60 seconds in the past
      
      try {
        await client.getBalance({ expiration: expiredTime });
        fail('Should have thrown an error for expired request');
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as { code: string }).code).toBe(NIP47ErrorCode.REQUEST_EXPIRED);
      }
    });
    
    it('should handle invalid method errors', async () => {
      jest.setTimeout(10000);
      
      try {
        // @ts-ignore - deliberately call with invalid parameters
        await client.makeInvoice(null);
        fail('Should have thrown an INVALID_REQUEST error');
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as { code: string }).code).toBe(NIP47ErrorCode.INVALID_REQUEST);
      }
    });
    
    it('should handle not found errors', async () => {
      jest.setTimeout(10000);
      
      // Mock the wallet implementation to throw a NOT_FOUND error
      const originalLookup = (service as any).walletImpl.lookupInvoice;
      (service as any).walletImpl.lookupInvoice = () => {
        throw { code: 'NOT_FOUND', message: 'Invoice not found' };
      };
      
      try {
        await client.lookupInvoice('nonexistent');
        fail('Should have thrown a NOT_FOUND error');
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as { code: string }).code).toBe(NIP47ErrorCode.NOT_FOUND);
      } finally {
        // Restore original implementation
        (service as any).walletImpl.lookupInvoice = originalLookup;
      }
    });
  });
}); 