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
  NIP47ErrorCode,
} from "../../src";
import { NostrRelay } from "../../src/utils/ephemeral-relay";

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
      alias: "SimpleWallet",
      color: "#ff9900",
      pubkey: "00000000000000000000000000000000000000000000000000000000000000",
      network: "regtest",
      methods: [
        NIP47Method.GET_INFO,
        NIP47Method.GET_BALANCE,
        NIP47Method.PAY_INVOICE,
        NIP47Method.MAKE_INVOICE,
        NIP47Method.LOOKUP_INVOICE,
        NIP47Method.LIST_TRANSACTIONS,
      ],
      notifications: [
        NIP47NotificationType.PAYMENT_RECEIVED,
        NIP47NotificationType.PAYMENT_SENT,
      ],
    };
  }

  async getBalance(): Promise<number> {
    return this.balance;
  }

  async payInvoice(
    _invoice: string,
    amount?: number,
    _maxfee?: number,
  ): Promise<any> {
    // Simplified payment logic
    const paymentAmount = amount || 1000; // Default 1000 msats
    const fee = Math.floor(paymentAmount * 0.01); // 1% fee

    // Deduct from balance
    this.balance -= paymentAmount + fee;

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
      settled_at: Math.floor(Date.now() / 1000),
    };

    this.invoices.set(paymentHash, txn);

    return {
      preimage,
      payment_hash: paymentHash,
      amount: paymentAmount,
      fees_paid: fee,
    };
  }

  async makeInvoice(
    amount: number,
    description: string,
    description_hash?: string,
    expiry?: number,
  ): Promise<any> {
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
      expires_at: expiryTime,
    };

    this.invoices.set(paymentHash, txn);

    return {
      invoice: txn.invoice,
      payment_hash: paymentHash,
      amount,
      created_at: txn.created_at,
      expires_at: expiryTime,
    };
  }

  async lookupInvoice(params: {
    payment_hash?: string;
    invoice?: string;
  }): Promise<NIP47Transaction> {
    // Check that at least one required parameter is provided
    if (!params.payment_hash && !params.invoice) {
      const error: any = new Error("Payment hash or invoice is required");
      error.code = "INVALID_REQUEST";
      throw error;
    }

    // First try to find by payment_hash if provided
    if (params.payment_hash && this.invoices.has(params.payment_hash)) {
      return this.invoices.get(params.payment_hash)!;
    }

    // Then try to find by invoice if provided
    if (params.invoice) {
      const invoiceList = Array.from(this.invoices.values());
      const found = invoiceList.find((inv) => inv.invoice === params.invoice);
      if (found) {
        return found;
      }
    }

    // If we get here, no invoice was found
    const error: any = new Error("Invoice not found");
    error.code = NIP47ErrorCode.NOT_FOUND;
    error.context = {
      payment_hash: params.payment_hash,
      invoice: params.invoice,
    };
    throw error;
  }

  async listTransactions(
    _from?: number,
    _until?: number,
    limit?: number,
    _offset?: number,
    _unpaid?: boolean,
    _type?: string,
  ): Promise<NIP47Transaction[]> {
    let transactions = Array.from(this.invoices.values());

    // Sort by created_at in descending order
    transactions.sort((a, b) => b.created_at - a.created_at);

    // Apply pagination
    if (limit) {
      transactions = transactions.slice(0, limit);
    }

    return transactions;
  }

  async signMessage(
    message: string,
  ): Promise<{ signature: string; message: string }> {
    return {
      signature: `${randomHex(32)}${randomHex(32)}`,
      message,
    };
  }
}

// Helper function to generate random hex strings
function randomHex(length: number): string {
  return [...Array(length)]
    .map(() => Math.floor(Math.random() * 16).toString(16))
    .join("");
}

async function main() {
  console.log("Starting NIP-47 Basic Client-Service Example...");

  // Step 1: Start an ephemeral relay for the demo
  const relay = new NostrRelay(3333);
  await relay.start();
  console.log(`Started ephemeral relay at ${relay.url}`);

  // Step 2: Generate keypairs for the service and client
  const serviceKeypair = await generateKeypair();
  const clientKeypair = await generateKeypair();

  console.log("Generated keypairs:");
  console.log(`  Service pubkey: ${serviceKeypair.publicKey}`);
  console.log(`  Client pubkey: ${clientKeypair.publicKey}`);

  // Step 3: Create a connection options object
  const connectionOptions: NIP47ConnectionOptions = {
    pubkey: serviceKeypair.publicKey,
    secret: clientKeypair.privateKey, // Use client's private key as the secret
    relays: [relay.url],
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
      name: "SimpleWalletService",
      methods: [
        NIP47Method.GET_INFO,
        NIP47Method.GET_BALANCE,
        NIP47Method.PAY_INVOICE,
        NIP47Method.MAKE_INVOICE,
        NIP47Method.LOOKUP_INVOICE,
        NIP47Method.LIST_TRANSACTIONS,
        NIP47Method.SIGN_MESSAGE,
      ],
      notificationTypes: [
        NIP47NotificationType.PAYMENT_RECEIVED,
        NIP47NotificationType.PAYMENT_SENT,
      ],
    },
    simpleWallet,
  );

  await service.init();
  console.log("Wallet service initialized and connected to relay");

  // Step 5: Create and initialize a client
  const client = new NostrWalletConnectClient(connectionOptions);

  try {
    await client.init();
    console.log("Wallet client initialized and connected to relay");

    // Wait for client to fully connect and discover service capabilities
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Step 6: Basic wallet operations
    console.log("\n1. Getting wallet info...");
    const info = await client.getInfo();
    console.log("Wallet info:", info);

    console.log("\n2. Getting wallet balance...");
    const balance = await client.getBalance();
    console.log(`Balance: ${balance} msats (${balance / 1000} sats)`);

    console.log("\n3. Creating an invoice...");
    const invoice = await client.makeInvoice(
      5000,
      "Test invoice from NIP-47 demo",
    );
    console.log("Created invoice:", invoice);

    console.log("\n4. Looking up invoice by payment hash...");
    if (invoice && invoice.payment_hash) {
      try {
        const lookedUpInvoice = await client.lookupInvoice({
          payment_hash: invoice.payment_hash,
        });
        console.log("Found invoice:", lookedUpInvoice);

        // Now try to look up a non-existent invoice
        console.log("\n4b. Looking up a non-existent invoice...");
        try {
          await client.lookupInvoice({ payment_hash: "non_existent_hash" });
        } catch (error: any) {
          if (error.code === NIP47ErrorCode.NOT_FOUND) {
            console.log(
              "As expected, invoice was not found. Error:",
              error.message,
            );
            console.log("Recovery hint:", error.recoveryHint);
            console.log("Error category:", error.category);
            console.log("Error context:", JSON.stringify(error.context || {}));
            console.log(
              "User-friendly message:",
              error.getUserMessage ? error.getUserMessage() : error.message,
            );
            console.log("Recommended UI handling:");
            console.log("- Display a message that the invoice was not found");
            console.log(
              "- Offer to create a new invoice or search with different criteria",
            );
            console.log("- Provide a way to view recent transactions");
          } else {
            console.error("Unexpected error:", error);
          }
        }
      } catch (error: any) {
        console.error("Error looking up invoice:", error.message);
        if (error.recoveryHint) {
          console.log("Recovery hint:", error.recoveryHint);
        }
      }
    }

    console.log("\n5. Paying an invoice...");
    const payment = await client.payInvoice("lnbc100n1demo");
    console.log("Payment successful:", payment);

    console.log("\n6. Listing transactions...");
    const txList = await client.listTransactions({ limit: 5 });
    console.log(`Recent transactions (${txList.transactions.length}):`);
    txList.transactions.forEach((tx: NIP47Transaction) => {
      console.log(
        `  - ${tx.type}: ${tx.amount} msats [${tx.payment_hash.substring(0, 8)}...]`,
      );
    });

    // Step 7: Clean up
    client.disconnect();
    service.disconnect();
    await relay.close();

    console.log("\nDemo completed successfully!");
  } catch (error) {
    console.error("Error during demo:", error);
    // Ensure we still clean up resources
    client.disconnect();
    service.disconnect();
    await relay.close();
  }
}

// Run the example
main().catch(console.error);
