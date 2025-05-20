import {
  NostrWalletConnectClient,
  NostrWalletService,
  WalletImplementation,
  NIP47Transaction,
  NIP47Method,
  TransactionType,
  generateKeypair,
  NIP47ConnectionOptions,
  NIP47ErrorCode,
} from "../../src";
import { NIP47ClientError } from "../../src/nip47/client";
import {
  GetInfoResponseResult,
  PaymentResponseResult,
  MakeInvoiceResponseResult,
} from "../../src/nip47/types";
import { NostrRelay } from "../../src/utils/ephemeral-relay";
import { signEvent, sha256Hex } from "../../src/utils/crypto";

/**
 * Request Expiration Example for NIP-47
 *
 * This example demonstrates the request expiration feature:
 * - Setting expiration timestamps on requests
 * - Handling expired requests
 * - Best practices for expiration times
 */

// Custom error class for NOT_FOUND errors
class NotFoundError extends Error {
  code = NIP47ErrorCode.NOT_FOUND as const;
  context?: { payment_hash?: string; invoice?: string };

  constructor(message = "Invoice not found", ctx?: NotFoundError["context"]) {
    super(message);
    this.name = "NotFoundError";
    this.context = ctx;
  }
}

// Simple wallet implementation
class ExpirationDemoWallet implements WalletImplementation {
  private balance: number = 10000000; // 10,000,000 msats
  // Generate a wallet private key at runtime instead of using a hard-coded value
  private walletPrivateKey: string;

  constructor(privateKey: string) {
    this.walletPrivateKey = privateKey;
  }

  async getInfo(): Promise<GetInfoResponseResult> {
    return {
      alias: "ExpirationDemoWallet",
      color: "#ff9900",
      pubkey: "00000000000000000000000000000000000000000000000000000000000000",
      network: "regtest",
      methods: [
        NIP47Method.GET_INFO,
        NIP47Method.GET_BALANCE,
        NIP47Method.PAY_INVOICE,
        NIP47Method.MAKE_INVOICE,
      ],
    };
  }

  async getBalance(): Promise<number> {
    // Add a small delay to simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 250));
    return this.balance;
  }

  async payInvoice(
    _invoice: string,
    amount?: number,
    _maxfee?: number,
  ): Promise<PaymentResponseResult> {
    // Simulate a long-running operation that might exceed expiration
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const paymentAmount = amount || 1000;
    const fee = Math.floor(paymentAmount * 0.01);

    return {
      preimage: randomHex(32),
      payment_hash: randomHex(32),
      amount: paymentAmount,
      fees_paid: fee,
    };
  }

  async makeInvoice(
    amount: number,
    _description: string, // unused in demo
    description_hash?: string,
    expiry?: number,
  ): Promise<MakeInvoiceResponseResult> {
    const now = Math.floor(Date.now() / 1000);
    const result: MakeInvoiceResponseResult = {
      invoice: `lnbc${amount}n1demo${randomHex(10)}`,
      payment_hash: randomHex(32),
      amount,
      created_at: now,
      // honour caller‐provided expiry or fall back to one hour
      expires_at: expiry ? now + expiry : now + 3600,
    };

    // propagate description hash when provided
    if (description_hash) {
      result.description_hash = description_hash;
    }

    return result;
  }

  // Implement other required methods
  async lookupInvoice(params: {
    payment_hash?: string;
    invoice?: string;
  }): Promise<NIP47Transaction> {
    // Implement NOT_FOUND error correctly
    if (Math.random() < 0.3) {
      throw new NotFoundError("Invoice not found", {
        payment_hash: params.payment_hash,
        invoice: params.invoice,
      });
    }

    // Return a transaction for demonstration
    return {
      type: TransactionType.INCOMING,
      payment_hash: params.payment_hash || randomHex(32),
      amount: 5000,
      fees_paid: 0,
      created_at: Math.floor(Date.now() / 1000) - 3600, // Created 1 hour ago
      settled_at: Math.floor(Date.now() / 1000) - 3000, // Settled 50 minutes ago
      description: "Test invoice for request expiration demo",
    };
  }

  async listTransactions(
    _from?: number,
    _until?: number,
    _limit?: number,
    _offset?: number,
    _unpaid?: boolean,
    _type?: string,
  ): Promise<NIP47Transaction[]> {
    return [];
  }

  async signMessage(
    message: string,
  ): Promise<{ signature: string; message: string }> {
    // Use proper cryptographic signing instead of random values
    // Hash the message first to get a 32-byte value to sign
    const messageHash = sha256Hex(message);

    // Sign the hash with the wallet's private key
    const signature = await signEvent(messageHash, this.walletPrivateKey);

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

// Function to sleep for a specified number of milliseconds
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("Starting NIP-47 Request Expiration Example...");

  // Set up relay, service, and client
  const relay = new NostrRelay(3200);
  await relay.start();
  console.log(`Started ephemeral relay at ${relay.url}`);

  const serviceKeypair = await generateKeypair();
  const clientKeypair = await generateKeypair();
  const walletKeypair = await generateKeypair();

  // Create wallet with generated private key
  const expirationWallet = new ExpirationDemoWallet(walletKeypair.privateKey);

  // Set up connection options
  const connectionOptions: NIP47ConnectionOptions = {
    pubkey: serviceKeypair.publicKey,
    secret: clientKeypair.privateKey,
    relays: [relay.url],
  };

  // Create and initialize service
  const service = new NostrWalletService(
    {
      relays: [relay.url],
      pubkey: serviceKeypair.publicKey,
      privkey: serviceKeypair.privateKey,
      name: "ExpirationDemoService",
      methods: [
        NIP47Method.GET_INFO,
        NIP47Method.GET_BALANCE,
        NIP47Method.PAY_INVOICE,
        NIP47Method.MAKE_INVOICE,
      ],
    },
    expirationWallet,
  );
  await service.init();
  console.log("Expiration demo service initialized");

  // Create and initialize client
  const client = new NostrWalletConnectClient(connectionOptions);
  await client.init();
  console.log("Client initialized and connected to service");

  // Wait for connections to stabilize
  await sleep(2000);

  try {
    // Get the current time in seconds
    const now = Math.floor(Date.now() / 1000);

    console.log("\n==== 1. Request Without Expiration ====");
    console.log("Sending request without expiration:");
    const balance = await client.getBalance();
    console.log(`Wallet balance: ${balance} msats`);

    console.log("\n==== 2. Request With Future Expiration ====");
    console.log(
      "Sending request with future expiration (30 seconds from now):",
    );
    const futureExpiration = now + 30;
    console.log(
      `Expiration timestamp: ${futureExpiration} (${new Date(futureExpiration * 1000).toISOString()})`,
    );

    try {
      const invoice = await client.makeInvoice(
        1000,
        "Test invoice",
        undefined,
        undefined,
        { expiration: futureExpiration },
      );
      console.log("Request succeeded before expiration:", invoice);
    } catch (error) {
      console.error("Unexpected error:", error);
    }

    console.log("\n==== 3. Request With Past Expiration ====");
    console.log("Sending request with past expiration (60 seconds ago):");
    const pastExpiration = now - 60;
    console.log(
      `Expiration timestamp: ${pastExpiration} (${new Date(pastExpiration * 1000).toISOString()})`,
    );

    try {
      await client.getBalance({ expiration: pastExpiration });
      console.log("Request should have failed, but succeeded unexpectedly");
    } catch (error: unknown) {
      if (
        error instanceof NIP47ClientError &&
        error.code === NIP47ErrorCode.REQUEST_EXPIRED
      ) {
        console.log(
          "Request correctly failed with expired error:",
          error.message,
        );
      } else {
        console.error("Unexpected error:", error);
      }
    }

    console.log("\n==== 4. Request That Will Expire During Processing ====");
    console.log("Sending payment request that will expire during processing:");

    // Set expiration to 1 second from now, but the payment takes 2 seconds to process
    const shortExpiration = now + 1;
    console.log(
      `Expiration timestamp: ${shortExpiration} (${new Date(shortExpiration * 1000).toISOString()})`,
    );
    console.log(
      "Payment processing will take 2 seconds, but expiration is in 1 second...",
    );

    try {
      await client.payInvoice("lnbc1000n1demo", undefined, undefined, {
        expiration: shortExpiration,
      });
      console.log("Request should have expired, but succeeded unexpectedly");
    } catch (error: unknown) {
      if (
        error instanceof NIP47ClientError &&
        error.code === NIP47ErrorCode.REQUEST_EXPIRED
      ) {
        console.log(
          "Request correctly failed with expired error:",
          error.message,
        );
      } else {
        console.error("Unexpected error:", error);
      }
    }

    console.log("\n==== 5. Best Practices for Expiration Times ====");

    console.log("\nFor quick operations (fetching info/balance):");
    // Use a short expiration (10 seconds)
    const quickExpiration = now + 10;
    try {
      const balance = await client.getBalance({ expiration: quickExpiration });
      console.log(`Balance query succeeded: ${balance} msats`);
    } catch (error: unknown) {
      console.error("Unexpected error in getBalance for quick op:", error);
    }

    console.log("\nFor operations that may take longer (payments):");
    // Use a longer expiration (5 minutes)
    const longExpiration = now + 300;
    try {
      await client.makeInvoice(
        5000,
        "Long-lived invoice",
        undefined,
        undefined,
        { expiration: longExpiration },
      );
      console.log("Invoice creation succeeded with 5-minute expiration window");
    } catch (error: unknown) {
      console.error("Unexpected error in makeInvoice for long op:", error);
    }

    console.log("\n==== 6. Security Considerations ====");
    console.log("Always use expirations to prevent replay attacks");
    console.log("Recommended expiration times:");
    console.log("- Read operations: 10-30 seconds");
    console.log("- Write operations: 30-60 seconds");
    console.log(
      "- Payment operations: 1-5 minutes depending on network reliability",
    );

    // Clean up
    client.disconnect();
    service.disconnect();
    await relay.close();

    console.log("\nRequest expiration demo completed successfully!");
  } catch (error: unknown) {
    console.error("Unexpected error during demo:", error);
    client.disconnect();
    service.disconnect();
    await relay.close();
  }
}

// Run the example
main().catch(console.error);
