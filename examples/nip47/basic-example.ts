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
import { NIP47ClientError } from "../../src/nip47/client";
import {
  GetInfoResponseResult,
  PaymentResponseResult,
  MakeInvoiceResponseResult,
  SignMessageResponseResult,
  NIP47Error,
} from "../../src/nip47/types";
import { NostrRelay } from "../../src/utils/ephemeral-relay";
import { signEvent, getPublicKey } from "../../src/utils/crypto";
import { getEventHash } from "../../src/nip01/event";

// Custom error classes for type-safe error handling
class InsufficientBalanceError extends Error {
  code = NIP47ErrorCode.INSUFFICIENT_BALANCE as const;
  constructor(message = "Insufficient balance to make payment") {
    super(message);
    this.name = "InsufficientBalanceError";
  }
}

class InvalidRequestError extends Error {
  code = NIP47ErrorCode.INVALID_REQUEST as const;
  constructor(message = "Invalid request parameters") {
    super(message);
    this.name = "InvalidRequestError";
  }
}

class NotFoundError extends Error {
  code = NIP47ErrorCode.NOT_FOUND as const;
  context?: Record<string, unknown>;

  constructor(
    message = "Resource not found",
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "NotFoundError";
    this.context = context;
  }
}

class InternalError extends Error {
  code = NIP47ErrorCode.INTERNAL_ERROR as const;
  constructor(message = "Internal error occurred") {
    super(message);
    this.name = "InternalError";
  }
}

// Simple in-memory wallet implementation for demonstration
class DemoWallet implements WalletImplementation {
  private balance: number = 10000000; // 10,000,000 msats (10,000 sats)
  private invoices: Map<string, NIP47Transaction> = new Map();
  private walletPrivateKey: string =
    "0000000000000000000000000000000000000000000000000000000000000001";

  constructor() {
    // Add some sample invoices
    const sampleInvoice: NIP47Transaction = {
      type: TransactionType.INCOMING,
      invoice:
        "lnbc100n1p3489qvpp509g9hd99exce74dke48wy2cwcm8z605hqxm3fhk6u308n4n58aeusdq5g9kxy7fqd9h8vmmfvdjjqsmfvyxqrrsssp5nwdvmfsl8e6c27m66tn02sz27wpk5v0lzvh8cf40y9l2u0jkn3uq9qyyssqyzf9504aozwykfj5j76m5d3naqytw6p8lc8n5n740l5aax99t6c0t5mvjry75zy6xnr8z4flz6nx59n9muuwmvl57n7386wlfrfevgqppvqeh",
      payment_hash:
        "21b9bbbc5abe93639cb56686adb632a5af0de842c47bde7f0a2db5ee47c58fa5",
      preimage:
        "1dea7cd05979072f737903b5cba969c62a91d4ecc5ae3cccb6a0c6bb676b8978",
      amount: 10000,
      fees_paid: 0,
      created_at: Math.floor(Date.now() / 1000) - 3600,
      settled_at: Math.floor(Date.now() / 1000) - 3600,
    };

    this.invoices.set(sampleInvoice.payment_hash, sampleInvoice);
  }

  async getInfo(): Promise<GetInfoResponseResult> {
    return {
      alias: "DemoWallet",
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
        NIP47Method.SIGN_MESSAGE,
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
    invoice: string,
    amount?: number,
  ): Promise<PaymentResponseResult> {
    // Simulate payment
    const paymentAmount = amount || 1000; // Default 1000 msats
    const fee = Math.floor(paymentAmount * 0.01); // 1% fee

    if (paymentAmount + fee > this.balance) {
      throw new InsufficientBalanceError();
    }

    // Simulate network failure occasionally
    if (Math.random() < 0.3) {
      throw {
        code: NIP47ErrorCode.CONNECTION_ERROR,
        message: "Network error during payment processing",
      };
    }

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
  ): Promise<MakeInvoiceResponseResult> {
    // Generate fake invoice
    const paymentHash = randomHex(32);
    const expiryTime = Math.floor(Date.now() / 1000) + (expiry || 3600);

    // Create transaction record
    const txn: NIP47Transaction = {
      type: TransactionType.INCOMING,
      invoice: `lnbc${amount}n1demo${randomHex(10)}`,
      description,
      payment_hash: paymentHash,
      amount,
      fees_paid: 0,
      created_at: Math.floor(Date.now() / 1000),
      expires_at: expiryTime,
    };

    // Add description_hash if provided
    if (description_hash) {
      txn.description_hash = description_hash;
    }

    this.invoices.set(paymentHash, txn);

    const result: MakeInvoiceResponseResult = {
      invoice: txn.invoice!,
      payment_hash: paymentHash,
      amount,
      created_at: txn.created_at,
      expires_at: expiryTime,
      ...(description_hash ? { description_hash } : {}),
    };

    return result;
  }

  async lookupInvoice(params: {
    payment_hash?: string;
    invoice?: string;
  }): Promise<NIP47Transaction> {
    if (!params.payment_hash && !params.invoice) {
      throw new InvalidRequestError("Payment hash or invoice is required");
    }

    // Find by payment hash
    if (params.payment_hash) {
      // Simulate 20% chance of not finding it
      if (Math.random() < 0.2) {
        throw new NotFoundError("Invoice not found", {
          payment_hash: params.payment_hash,
          method: "lookupInvoice",
        });
      }

      return {
        type: TransactionType.INCOMING,
        payment_hash: params.payment_hash,
        amount: 1000,
        fees_paid: 0,
        created_at: Math.floor(Date.now() / 1000) - 3600,
        settled_at: Math.floor(Date.now() / 1000) - 3000,
        description: "Test invoice",
      };
    }

    // Find by invoice
    if (params.invoice) {
      return {
        type: TransactionType.INCOMING,
        invoice: params.invoice,
        payment_hash: randomHex(32),
        amount: 1000,
        fees_paid: 0,
        created_at: Math.floor(Date.now() / 1000) - 3600,
        settled_at: Math.floor(Date.now() / 1000) - 3000,
        description: "Test invoice",
      };
    }

    // This should never happen due to the validation at the beginning
    throw new InternalError("Logic error");
  }

  async listTransactions(
    from?: number,
    until?: number,
    limit?: number,
    offset?: number,
    unpaid?: boolean,
    type?: TransactionType,
  ): Promise<NIP47Transaction[]> {
    let transactions = Array.from(this.invoices.values());

    // Apply filters
    if (from !== undefined) {
      transactions = transactions.filter((t) => t.created_at >= from);
    }

    if (until) {
      transactions = transactions.filter((t) => t.created_at <= until);
    }

    if (unpaid === false) {
      transactions = transactions.filter((t) => t.settled_at !== undefined);
    } else if (unpaid === true) {
      transactions = transactions.filter((t) => t.settled_at === undefined);
    }

    if (type) {
      transactions = transactions.filter((t) => t.type === type);
    }

    // Sort by created_at in descending order
    transactions.sort((a, b) => b.created_at - a.created_at);

    // Apply pagination
    if (offset !== undefined) {
      transactions = transactions.slice(offset);
    }
    if (limit !== undefined) {
      transactions = transactions.slice(0, limit);
    }

    return transactions;
  }

  async signMessage(message: string): Promise<SignMessageResponseResult> {
    // Create a Nostr event for signing
    const unsignedEvent = {
      pubkey: getPublicKey(this.walletPrivateKey),
      created_at: Math.floor(Date.now() / 1000),
      kind: 4, // arbitrary kind for "signed message"
      tags: [],
      content: message,
    };

    // Calculate the event ID according to the Nostr protocol
    const eventId = await getEventHash(unsignedEvent);

    // Sign the event ID with the wallet's private key
    const signature = await signEvent(eventId, this.walletPrivateKey);

    return {
      signature,
      message,
    };
  }
}

// Helper function to generate random hex strings
// Note: Not cryptographically secure - for demo purposes only
function randomHex(length: number): string {
  return [...Array(length)]
    .map(() => Math.floor(Math.random() * 16).toString(16))
    .join("");
}

async function main() {
  console.log("Starting Nostr Wallet Connect (NIP-47) demo...");

  // Step 1: Start an ephemeral relay for the demo
  const relay = new NostrRelay(3333);
  await relay.start();
  console.log(`Started ephemeral relay at ${relay.url}`);

  // Step 2: Generate keypairs for the service and client
  const serviceKeypair = await generateKeypair();
  const clientKeypair = await generateKeypair(); // Generate a proper keypair for the client

  console.log("Generated service keypair:");
  console.log(`  Public key: ${serviceKeypair.publicKey}`);

  // Step 3: Create a connection options object
  const connectionOptions: NIP47ConnectionOptions = {
    pubkey: serviceKeypair.publicKey,
    secret: clientKeypair.privateKey, // Use a proper private key as the secret
    relays: [relay.url],
  };

  // Generate a NWC URL
  const nwcUrl = generateNWCURL(connectionOptions);
  console.log(`\nGenerated NWC URL for client to connect:\n${nwcUrl}\n`);

  // Step 4: Create and initialize a wallet service
  const demoWallet = new DemoWallet();
  const service = new NostrWalletService(
    {
      relays: [relay.url],
      pubkey: serviceKeypair.publicKey,
      privkey: serviceKeypair.privateKey,
      name: "DemoWalletService",
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
    demoWallet,
  );

  await service.init();
  console.log("Wallet service initialized and connected to relay");

  // Wait for a moment to ensure the service is fully initialized
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Step 5: Create and initialize a client
  const client = new NostrWalletConnectClient(connectionOptions);

  // Log key details for debugging
  console.log(`Client keypair details for debugging:`);
  console.log(`  Client pubkey: ${client.getPublicKey()}`);
  console.log(`  Service pubkey: ${serviceKeypair.publicKey}`);

  try {
    await client.init();
    console.log("Wallet client initialized and connected to relay");

    // Wait for a moment to ensure the client is fully initialized
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Step 6: Subscribe to notifications
    if (client.supportsNotification(NIP47NotificationType.PAYMENT_RECEIVED)) {
      client.onNotification(
        NIP47NotificationType.PAYMENT_RECEIVED,
        (notification: NIP47Transaction | unknown) => {
          console.log("\nReceived payment notification:", notification);
        },
      );
      console.log("Subscribed to payment received notifications");
    }

    // Step 7: Make API calls from the client
    try {
      // Additional delay before making requests to ensure subscriptions are set up
      console.log("\nWaiting for subscriptions to be fully established...");
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Get wallet info
      console.log("\n[1] Getting wallet info...");
      const info = await client.getInfo();
      console.log("Wallet info:", info);

      // Wait a moment between requests
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Get balance
      console.log("\n[2] Getting wallet balance...");
      const balance = await client.getBalance();
      console.log(`Balance: ${balance} msats (${balance / 1000} sats)`);

      // Wait a moment between requests
      await new Promise((resolve) => setTimeout(resolve, 500));

      // List transactions
      console.log("\n[3] Listing recent transactions...");
      const txList = await client.listTransactions({ limit: 5 });
      console.log(
        `Found ${txList.transactions ? txList.transactions.length : 0} transactions:`,
      );
      for (const tx of txList.transactions || []) {
        console.log(
          `  - ${tx.type}: ${tx.amount} msats [${tx.payment_hash.substring(0, 8)}...]`,
        );
      }

      // Wait a moment between requests
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Create an invoice
      console.log("\n[4] Creating an invoice...");
      const invoice = await client.makeInvoice(
        5000,
        "Test invoice from NIP-47 demo",
      );
      console.log("Created invoice:", invoice);

      // Wait a moment between requests
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Lookup the invoice
      console.log("\n4. Looking up invoice by payment hash...");
      if (invoice && invoice.payment_hash) {
        const lookedUpInvoice = await client.lookupInvoice({
          payment_hash: invoice.payment_hash,
        });
        console.log("Found invoice:", lookedUpInvoice);
      }

      // Wait a moment between requests
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Pay an invoice (using a fake invoice)
      console.log("\n[6] Paying an invoice...");
      const payment = await client.payInvoice("lnbc100n1demo");
      console.log("Payment successful:", payment);

      // Wait a moment between requests
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Send a notification from service to client (simulating received payment)
      console.log("\n[7] Service sending notification to client...");
      await service.sendNotification(
        client.getPublicKey(),
        NIP47NotificationType.PAYMENT_RECEIVED,
        {
          type: TransactionType.INCOMING,
          invoice: "lnbc500n1notification",
          payment_hash: randomHex(32),
          preimage: randomHex(32),
          amount: 50000,
          fees_paid: 0,
          created_at: Math.floor(Date.now() / 1000),
          settled_at: Math.floor(Date.now() / 1000),
        },
      );

      // Wait for notification to be processed
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error("Error during API calls:", error);
    }

    // Now demonstrate request expiration
    console.log("\nDemonstrating request expiration:");
    try {
      // Set expiration to 1 second in the past
      const pastExpiration = Math.floor(Date.now() / 1000) - 1;
      console.log(
        `Setting request expiration to ${pastExpiration} (${new Date(pastExpiration * 1000).toISOString()})`,
      );

      console.log("Attempting to get balance with expired request...");
      const balanceResult = await client.getBalance({
        expiration: pastExpiration,
      });
      console.log(
        "This should not be reached due to expiration",
        balanceResult,
      );
    } catch (error: unknown) {
      if (error instanceof NIP47ClientError) {
        console.log(
          `Caught error as expected: ${error.message} (Code: ${error.code})`,
        );
        switch (error.code) {
          case NIP47ErrorCode.NOT_FOUND:
            console.log("Invoice not found, showing appropriate UI message");
            console.log("Error category:", error.category);
            console.log("Error context:", JSON.stringify(error.data || {}));
            console.log(
              "Recovery hint:",
              error.recoveryHint || "None provided",
            );
            console.log("User-friendly message:", error.getUserMessage());
            console.log("Suggested actions:");
            console.log("- Create a new invoice or check payment hash");
            console.log(
              "- Show transaction history to verify if invoice exists",
            );
            console.log("- Offer to rescan the lightning node");
            break;
          case NIP47ErrorCode.TIMEOUT:
            console.log("Request timed out, suggesting to try again");
            break;
          default:
            console.log(`Unexpected NIP47ClientError: ${error.message}`);
        }
      } else if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        "message" in error &&
        Object.values(NIP47ErrorCode).includes(
          (error as { code: NIP47ErrorCode | string }).code as NIP47ErrorCode,
        )
      ) {
        const nip47Error = error as NIP47Error;
        console.log(
          `Caught error as expected: ${nip47Error.message} (Code: ${nip47Error.code})`,
        );
        switch (nip47Error.code) {
          case NIP47ErrorCode.NOT_FOUND:
            console.log("Invoice not found, showing appropriate UI message");
            console.log("Error category:", nip47Error.category);
            console.log(
              "Error context:",
              JSON.stringify(nip47Error.data || {}),
            );
            console.log(
              "Recovery hint:",
              nip47Error.recoveryHint || "None provided",
            );
            console.log("User-friendly message:", nip47Error.message);
            break;
          default:
            console.log(`Unexpected NIP47Error object: ${nip47Error.message}`);
        }
      } else if (error instanceof Error) {
        console.log(`Caught standard error: ${error.message}`);
      } else {
        console.log(`Caught unknown error: ${String(error)}`);
      }
    }

    /**
     * Error handling and retry demonstration
     */
    console.log("\n--- Error Handling and Retry Demonstration ---");

    // Standard error handling
    try {
      // Try to pay an invoice with a very large amount (will fail)
      await client.payInvoice("lnbc100000000n1demo", 100000000);
    } catch (error) {
      if (error instanceof NIP47ClientError) {
        console.log(`\nHandling error with enhanced error system:`);
        console.log(`- Error code: ${error.code}`);
        console.log(`- Error category: ${error.category}`);
        console.log(`- Error message: ${error.message}`);
        console.log(
          `- Recovery hint: ${error.recoveryHint || "None provided"}`,
        );
        console.log(`- User-friendly message: ${error.getUserMessage()}`);
        console.log(`- Is retriable: ${error.isRetriable()}`);
      } else {
        console.error(
          `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Retry demonstration
    console.log("\nRetry mechanism demonstration:");
    console.log(
      "Attempting operation with automatic retry for transient errors...",
    );

    try {
      // This will occasionally fail with network errors (due to our simulation)
      // but the retry mechanism should handle it
      const paymentResult = await client.withRetry(
        () => client.payInvoice("lnbc1000n1demo", 1000),
        {
          maxRetries: 5,
          initialDelay: 500,
          maxDelay: 5000,
          factor: 1.5,
        },
      );

      console.log("Payment succeeded after potential retries:", paymentResult);
    } catch (error) {
      if (error instanceof NIP47ClientError) {
        console.log("All retry attempts failed:");
        console.log(`Final error: ${error.getUserMessage()}`);
      } else {
        console.error(
          `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    /**
     * Cleanup
     */
    console.log("\nCleaning up...");
    client.disconnect();
    service.disconnect();
    await relay.close();

    console.log("Demo completed successfully!");
  } catch (error) {
    console.error(
      "Error initializing client:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

main().catch(console.error);
