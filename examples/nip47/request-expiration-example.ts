import { 
  NostrWalletConnectClient,
  NostrWalletService,
  WalletImplementation,
  NIP47Transaction,
  NIP47Method,
  TransactionType,
  generateKeypair,
  generateNWCURL,
  NIP47ConnectionOptions,
  NIP47NotificationType,
  NIP47ErrorCode
} from '../../src';
import { NIP47ClientError } from '../../src/nip47/client';
import { NostrRelay } from '../../src/utils/ephemeral-relay';

/**
 * Request Expiration Example for NIP-47
 * 
 * This example demonstrates the request expiration feature:
 * - Setting expiration timestamps on requests
 * - Handling expired requests
 * - Best practices for expiration times
 */

// Simple wallet implementation
class ExpirationDemoWallet implements WalletImplementation {
  private balance: number = 10000000; // 10,000,000 msats
  
  async getInfo(): Promise<any> {
    return {
      alias: 'ExpirationDemoWallet',
      color: '#ff9900',
      pubkey: '00000000000000000000000000000000000000000000000000000000000000',
      network: 'regtest',
      methods: [
        NIP47Method.GET_INFO,
        NIP47Method.GET_BALANCE,
        NIP47Method.PAY_INVOICE,
        NIP47Method.MAKE_INVOICE
      ]
    };
  }
  
  async getBalance(): Promise<number> {
    // Add a small delay to simulate processing time
    await new Promise(resolve => setTimeout(resolve, 250));
    return this.balance;
  }
  
  async payInvoice(invoice: string, amount?: number, maxfee?: number): Promise<any> {
    // Simulate a long-running operation that might exceed expiration
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const paymentAmount = amount || 1000;
    const fee = Math.floor(paymentAmount * 0.01);
    
    return {
      preimage: randomHex(32),
      payment_hash: randomHex(32),
      amount: paymentAmount,
      fees_paid: fee
    };
  }
  
  async makeInvoice(amount: number, description: string): Promise<any> {
    return {
      invoice: `lnbc${amount}n1demo${randomHex(10)}`,
      payment_hash: randomHex(32),
      amount,
      created_at: Math.floor(Date.now() / 1000),
      expires_at: Math.floor(Date.now() / 1000) + 3600
    };
  }
  
  // Implement other required methods
  async lookupInvoice(params: { payment_hash?: string; invoice?: string }): Promise<NIP47Transaction> {
    // Implement NOT_FOUND error correctly
    if (Math.random() < 0.3) {
      const error: any = new Error('Invoice not found');
      error.code = NIP47ErrorCode.NOT_FOUND;
      error.context = {
        payment_hash: params.payment_hash,
        invoice: params.invoice
      };
      throw error;
    }
    
    // Return a transaction for demonstration
    return {
      type: TransactionType.INCOMING,
      payment_hash: params.payment_hash || randomHex(32),
      amount: 5000,
      fees_paid: 0,
      created_at: Math.floor(Date.now() / 1000) - 3600, // Created 1 hour ago
      settled_at: Math.floor(Date.now() / 1000) - 3000, // Settled 50 minutes ago
      description: 'Test invoice for request expiration demo'
    };
  }
  
  async listTransactions(): Promise<NIP47Transaction[]> {
    return [];
  }
  
  async signMessage(message: string): Promise<{signature: string, message: string}> {
    return {
      signature: randomHex(64),
      message
    };
  }
}

// Helper function to generate random hex strings
function randomHex(length: number): string {
  return [...Array(length)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

// Function to sleep for a specified number of milliseconds
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('Starting NIP-47 Request Expiration Example...');
  
  // Set up relay, service, and client
  const relay = new NostrRelay(3200);
  await relay.start();
  console.log(`Started ephemeral relay at ${relay.url}`);
  
  const serviceKeypair = await generateKeypair();
  const clientKeypair = await generateKeypair();
  
  // Create wallet
  const expirationWallet = new ExpirationDemoWallet();
  
  // Set up connection options
  const connectionOptions: NIP47ConnectionOptions = {
    pubkey: serviceKeypair.publicKey,
    secret: clientKeypair.privateKey,
    relays: [relay.url]
  };
  
  // Create and initialize service
  const service = new NostrWalletService(
    {
      relays: [relay.url],
      pubkey: serviceKeypair.publicKey,
      privkey: serviceKeypair.privateKey,
      name: 'ExpirationDemoService',
      methods: [
        NIP47Method.GET_INFO,
        NIP47Method.GET_BALANCE,
        NIP47Method.PAY_INVOICE,
        NIP47Method.MAKE_INVOICE
      ]
    },
    expirationWallet
  );
  await service.init();
  console.log('Expiration demo service initialized');
  
  // Create and initialize client
  const client = new NostrWalletConnectClient(connectionOptions);
  await client.init();
  console.log('Client initialized and connected to service');
  
  // Wait for connections to stabilize
  await sleep(2000);
  
  try {
    // Get the current time in seconds
    const now = Math.floor(Date.now() / 1000);
    
    console.log('\n==== 1. Request Without Expiration ====');
    console.log('Sending request without expiration:');
    const balance = await client.getBalance();
    console.log(`Wallet balance: ${balance} msats`);
    
    console.log('\n==== 2. Request With Future Expiration ====');
    console.log('Sending request with future expiration (30 seconds from now):');
    const futureExpiration = now + 30;
    console.log(`Expiration timestamp: ${futureExpiration} (${new Date(futureExpiration * 1000).toISOString()})`);
    
    try {
      const invoice = await client.makeInvoice(1000, 'Test invoice', undefined, undefined, { expiration: futureExpiration });
      console.log('Request succeeded before expiration:', invoice);
    } catch (error) {
      console.error('Unexpected error:', error);
    }
    
    console.log('\n==== 3. Request With Past Expiration ====');
    console.log('Sending request with past expiration (60 seconds ago):');
    const pastExpiration = now - 60;
    console.log(`Expiration timestamp: ${pastExpiration} (${new Date(pastExpiration * 1000).toISOString()})`);
    
    try {
      await client.getBalance({ expiration: pastExpiration });
      console.log('Request should have failed, but succeeded unexpectedly');
    } catch (error) {
      if (error instanceof NIP47ClientError && error.code === NIP47ErrorCode.REQUEST_EXPIRED) {
        console.log('Request correctly failed with expired error:', error.message);
      } else {
        console.error('Unexpected error:', error);
      }
    }
    
    console.log('\n==== 4. Request That Will Expire During Processing ====');
    console.log('Sending payment request that will expire during processing:');
    
    // Set expiration to 1 second from now, but the payment takes 2 seconds to process
    const shortExpiration = now + 1;
    console.log(`Expiration timestamp: ${shortExpiration} (${new Date(shortExpiration * 1000).toISOString()})`);
    console.log('Payment processing will take 2 seconds, but expiration is in 1 second...');
    
    try {
      await client.payInvoice('lnbc1000n1demo', undefined, undefined, { expiration: shortExpiration });
      console.log('Request should have expired, but succeeded unexpectedly');
    } catch (error) {
      if (error instanceof NIP47ClientError && error.code === NIP47ErrorCode.REQUEST_EXPIRED) {
        console.log('Request correctly failed with expired error:', error.message);
      } else {
        console.error('Unexpected error:', error);
      }
    }
    
    console.log('\n==== 5. Best Practices for Expiration Times ====');
    
    console.log('\nFor quick operations (fetching info/balance):');
    // Use a short expiration (10 seconds)
    const quickExpiration = now + 10;
    try {
      const balance = await client.getBalance({ expiration: quickExpiration });
      console.log(`Balance query succeeded: ${balance} msats`);
    } catch (error) {
      console.error('Unexpected error:', error);
    }
    
    console.log('\nFor operations that may take longer (payments):');
    // Use a longer expiration (5 minutes)
    const longExpiration = now + 300;
    try {
      const invoice = await client.makeInvoice(5000, 'Long-lived invoice', undefined, undefined, { expiration: longExpiration });
      console.log('Invoice creation succeeded with 5-minute expiration window');
    } catch (error) {
      console.error('Unexpected error:', error);
    }
    
    console.log('\n==== 6. Security Considerations ====');
    console.log('Always use expirations to prevent replay attacks');
    console.log('Recommended expiration times:');
    console.log('- Read operations: 10-30 seconds');
    console.log('- Write operations: 30-60 seconds');
    console.log('- Payment operations: 1-5 minutes depending on network reliability');
    
    // Clean up
    client.disconnect();
    service.disconnect();
    await relay.close();
    
    console.log('\nRequest expiration demo completed successfully!');
    
  } catch (error) {
    console.error('Unexpected error during demo:', error);
    client.disconnect();
    service.disconnect();
    await relay.close();
  }
}

// Run the example
main().catch(console.error); 