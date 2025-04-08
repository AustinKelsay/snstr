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
  NIP47NotificationType
} from '../../src';
import { NostrRelay } from '../../src/utils/ephemeral-relay';

/**
 * Basic Client-Service Example for NIP-47
 * 
 * This example demonstrates the core functionality of NIP-47:
 * - Setting up a NIP-47 wallet service
 * - Connecting a client to the service
 * - Basic wallet operations (get info, balance, create/lookup invoices)
 */

// Simple in-memory wallet implementation for demonstration
class SimpleWallet implements WalletImplementation {
  private balance: number = 10000000; // 10,000,000 msats (10,000 sats)
  private invoices: Map<string, NIP47Transaction> = new Map();
  
  async getInfo(): Promise<any> {
    return {
      alias: 'SimpleWallet',
      color: '#ff9900',
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
  
  async payInvoice(invoice: string, amount?: number, maxfee?: number): Promise<any> {
    // Simplified payment logic
    const paymentAmount = amount || 1000; // Default 1000 msats
    const fee = Math.floor(paymentAmount * 0.01); // 1% fee
    
    // Deduct from balance
    this.balance -= (paymentAmount + fee);
    
    // Generate payment hash and preimage
    const paymentHash = randomHex(32);
    const preimage = randomHex(32);
    
    // Create transaction record
    const txn: NIP47Transaction = {
      type: TransactionType.OUTGOING,
      invoice,
      payment_hash: paymentHash,
      preimage,
      amount: paymentAmount,
      fees_paid: fee,
      created_at: Math.floor(Date.now() / 1000),
      settled_at: Math.floor(Date.now() / 1000)
    };
    
    this.invoices.set(paymentHash, txn);
    
    return {
      preimage,
      payment_hash: paymentHash,
      amount: paymentAmount,
      fees_paid: fee
    };
  }
  
  async makeInvoice(amount: number, description: string, description_hash?: string, expiry?: number): Promise<any> {
    // Generate fake invoice
    const paymentHash = randomHex(32);
    const expiryTime = Math.floor(Date.now() / 1000) + (expiry || 3600);
    
    // Create transaction record
    const txn: NIP47Transaction = {
      type: TransactionType.INCOMING,
      invoice: `lnbc${amount}n1demo${randomHex(10)}`,
      description,
      description_hash: description_hash,
      payment_hash: paymentHash,
      amount,
      fees_paid: 0,
      created_at: Math.floor(Date.now() / 1000),
      expires_at: expiryTime
    };
    
    this.invoices.set(paymentHash, txn);
    
    return {
      invoice: txn.invoice,
      payment_hash: paymentHash,
      amount,
      created_at: txn.created_at,
      expires_at: expiryTime
    };
  }
  
  async lookupInvoice(paymentHash?: string, invoice?: string): Promise<NIP47Transaction> {
    if (paymentHash && this.invoices.has(paymentHash)) {
      return this.invoices.get(paymentHash)!;
    }
    
    if (invoice) {
      // Find by invoice
      for (const txn of this.invoices.values()) {
        if (txn.invoice === invoice) {
          return txn;
        }
      }
    }
    
    throw { code: 'NOT_FOUND', message: 'Invoice not found' };
  }
  
  async listTransactions(from?: number, until?: number, limit?: number, offset?: number, unpaid?: boolean, type?: string): Promise<NIP47Transaction[]> {
    let transactions = Array.from(this.invoices.values());
    
    // Sort by created_at in descending order
    transactions.sort((a, b) => b.created_at - a.created_at);
    
    // Apply pagination
    if (limit) {
      transactions = transactions.slice(0, limit);
    }
    
    return transactions;
  }
  
  async signMessage(message: string): Promise<{signature: string, message: string}> {
    return {
      signature: `${randomHex(32)}${randomHex(32)}`,
      message
    };
  }
}

// Helper function to generate random hex strings
function randomHex(length: number): string {
  return [...Array(length)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

async function main() {
  console.log('Starting NIP-47 Basic Client-Service Example...');
  
  // Step 1: Start an ephemeral relay for the demo
  const relay = new NostrRelay(3333);
  await relay.start();
  console.log(`Started ephemeral relay at ${relay.url}`);
  
  // Step 2: Generate keypairs for the service and client
  const serviceKeypair = await generateKeypair();
  const clientKeypair = await generateKeypair();
  
  console.log('Generated keypairs:');
  console.log(`  Service pubkey: ${serviceKeypair.publicKey}`);
  console.log(`  Client pubkey: ${clientKeypair.publicKey}`);
  
  // Step 3: Create a connection options object
  const connectionOptions: NIP47ConnectionOptions = {
    pubkey: serviceKeypair.publicKey,
    secret: clientKeypair.privateKey, // Use client's private key as the secret
    relays: [relay.url]
  };
  
  // Generate a NWC URL (in real scenarios, this would be shared with users)
  const nwcUrl = generateNWCURL(connectionOptions);
  console.log(`\nGenerated NWC URL for client to connect:\n${nwcUrl}\n`);
  
  // Step 4: Create and initialize a wallet service
  const simpleWallet = new SimpleWallet();
  const service = new NostrWalletService(
    {
      relays: [relay.url],
      pubkey: serviceKeypair.publicKey,
      privkey: serviceKeypair.privateKey,
      name: 'SimpleWalletService',
      methods: [
        NIP47Method.GET_INFO,
        NIP47Method.GET_BALANCE,
        NIP47Method.PAY_INVOICE,
        NIP47Method.MAKE_INVOICE,
        NIP47Method.LOOKUP_INVOICE,
        NIP47Method.LIST_TRANSACTIONS,
        NIP47Method.SIGN_MESSAGE
      ],
      notificationTypes: [
        NIP47NotificationType.PAYMENT_RECEIVED,
        NIP47NotificationType.PAYMENT_SENT
      ]
    },
    simpleWallet
  );
  
  await service.init();
  console.log('Wallet service initialized and connected to relay');
  
  // Step 5: Create and initialize a client
  const client = new NostrWalletConnectClient(connectionOptions);
  
  try {
    await client.init();
    console.log('Wallet client initialized and connected to relay');
    
    // Wait for client to fully connect and discover service capabilities
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 6: Basic wallet operations
    console.log('\n1. Getting wallet info...');
    const info = await client.getInfo();
    console.log('Wallet info:', info);
    
    console.log('\n2. Getting wallet balance...');
    const balance = await client.getBalance();
    console.log(`Balance: ${balance} msats (${balance / 1000} sats)`);
    
    console.log('\n3. Creating an invoice...');
    const invoice = await client.makeInvoice(5000, 'Test invoice from NIP-47 demo');
    console.log('Created invoice:', invoice);
    
    console.log('\n4. Looking up invoice by payment hash...');
    if (invoice && invoice.payment_hash) {
      const lookedUpInvoice = await client.lookupInvoice(invoice.payment_hash);
      console.log('Found invoice:', lookedUpInvoice);
    }
    
    console.log('\n5. Paying an invoice...');
    const payment = await client.payInvoice('lnbc100n1demo');
    console.log('Payment successful:', payment);
    
    console.log('\n6. Listing transactions...');
    const txList = await client.listTransactions({ limit: 5 });
    console.log(`Recent transactions (${txList.transactions.length}):`);
    txList.transactions.forEach((tx: NIP47Transaction) => {
      console.log(`  - ${tx.type}: ${tx.amount} msats [${tx.payment_hash.substring(0, 8)}...]`);
    });
    
    // Step 7: Clean up
    client.disconnect();
    service.disconnect();
    await relay.close();
    
    console.log('\nDemo completed successfully!');
    
  } catch (error) {
    console.error('Error during demo:', error);
    // Ensure we still clean up resources
    client.disconnect();
    service.disconnect();
    await relay.close();
  }
}

// Run the example
main().catch(console.error); 