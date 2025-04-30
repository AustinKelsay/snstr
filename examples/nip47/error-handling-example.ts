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
import { NostrRelay } from "../../src/utils/ephemeral-relay";

/**
 * Error Handling Example for NIP-47
 *
 * This example demonstrates the error handling capabilities:
 * - Different error types and categories
 * - Handling specific errors (insufficient balance, not found, etc.)
 * - Using the retry mechanism for transient errors
 */

// Wallet implementation that generates specific errors for demonstration
class ErrorDemoWallet implements WalletImplementation {
  private balance: number = 1000; // Only 1000 msats to trigger insufficient balance errors
  private errorMode: string = "none"; // Current error mode to simulate

  setErrorMode(mode: string) {
    this.errorMode = mode;
    console.log(`Wallet set to error mode: ${mode}`);
  }

  async getInfo(): Promise<any> {
    if (this.errorMode === "timeout") {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Simulate timeout
      throw { code: NIP47ErrorCode.TIMEOUT, message: "Operation timed out" };
    }

    return {
      alias: "ErrorDemoWallet",
      color: "#ff0000",
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
    };
  }

  async getBalance(): Promise<number> {
    if (this.errorMode === "network") {
      throw {
        code: NIP47ErrorCode.CONNECTION_ERROR,
        message: "Network connection failed",
      };
    }

    if (this.errorMode === "wallet_locked") {
      throw { code: NIP47ErrorCode.WALLET_LOCKED, message: "Wallet is locked" };
    }

    return this.balance;
  }

  async payInvoice(
    invoice: string,
    amount?: number,
    maxfee?: number,
  ): Promise<any> {
    const paymentAmount = amount || 2000; // Default 2000 msats (intentionally more than balance)
    const fee = 100; // Fixed fee for simplicity

    // Check error modes
    if (
      this.errorMode === "insufficient_balance" ||
      paymentAmount + fee > this.balance
    ) {
      throw {
        code: NIP47ErrorCode.INSUFFICIENT_BALANCE,
        message: "Insufficient balance to make payment",
      };
    }

    if (this.errorMode === "invalid_invoice") {
      throw {
        code: NIP47ErrorCode.INVALID_INVOICE_FORMAT,
        message: "Invoice format is invalid",
      };
    }

    if (this.errorMode === "route_not_found") {
      throw {
        code: NIP47ErrorCode.PAYMENT_ROUTE_NOT_FOUND,
        message: "No route found to destination",
      };
    }

    if (this.errorMode === "payment_rejected") {
      throw {
        code: NIP47ErrorCode.PAYMENT_REJECTED,
        message: "Payment was rejected by recipient node",
      };
    }

    if (this.errorMode === "network") {
      throw {
        code: NIP47ErrorCode.CONNECTION_ERROR,
        message: "Network error during payment processing",
      };
    }

    if (this.errorMode === "unavailable") {
      throw {
        code: NIP47ErrorCode.WALLET_UNAVAILABLE,
        message: "Wallet is currently unavailable",
      };
    }

    // Success path - deduct from balance
    this.balance -= paymentAmount + fee;

    return {
      preimage: randomHex(32),
      payment_hash: randomHex(32),
      amount: paymentAmount,
      fees_paid: fee,
    };
  }

  async makeInvoice(amount: number, description: string): Promise<any> {
    if (this.errorMode === "internal") {
      throw {
        code: NIP47ErrorCode.INTERNAL_ERROR,
        message: "An internal error occurred",
      };
    }

    return {
      invoice: `lnbc${amount}n1demo${randomHex(10)}`,
      payment_hash: randomHex(32),
      amount,
      created_at: Math.floor(Date.now() / 1000),
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
  }

  async lookupInvoice(params: {
    payment_hash?: string;
    invoice?: string;
  }): Promise<NIP47Transaction> {
    console.log(
      `Wallet: Looking up invoice with payment hash: ${params.payment_hash || "none"} or invoice: ${params.invoice || "none"}`,
    );

    // Simulate an invoice not found error when in NOT_FOUND mode
    if (this.errorMode === "not_found" || this.errorMode === "NOT_FOUND") {
      // For our improved NOT_FOUND error handling, we throw a structured error object
      const error: any = new Error("Invoice not found");
      error.code = NIP47ErrorCode.NOT_FOUND;
      error.context = {
        payment_hash: params.payment_hash,
        invoice: params.invoice,
      };
      throw error;
    }

    if (this.errorMode === "internal_error") {
      throw new Error("Internal server error");
    }

    // In normal operation, we'd look up the invoice in our database
    // For the demo, we'll just return a fake response
    return {
      type: TransactionType.INCOMING,
      payment_hash: params.payment_hash || "sample_hash",
      amount: 1000,
      fees_paid: 0,
      created_at: Date.now() / 1000,
      description: "Sample invoice",
      settled_at: Date.now() / 1000,
    };
  }

  async listTransactions(): Promise<NIP47Transaction[]> {
    // Simply return an empty array
    return [];
  }

  async signMessage(
    message: string,
  ): Promise<{ signature: string; message: string }> {
    return {
      signature: randomHex(64),
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

// Helper to format error details
function formatError(error: any): string {
  if (error instanceof NIP47ClientError) {
    return `
    Error code: ${error.code}
    Category: ${error.category}
    Message: ${error.message}
    Recovery hint: ${error.recoveryHint || "None provided"}
    User-friendly message: ${error.getUserMessage()}
    Is retriable: ${error.isRetriable() ? "Yes" : "No"}
    `;
  } else {
    return `Unexpected error type: ${error.message || error}`;
  }
}

/**
 * Example of handling the NOT_FOUND error when looking up an invoice
 */
async function lookupInvoiceExample(client: NostrWalletConnectClient) {
  try {
    // Use randomHex to create a random payment hash (that won't exist)
    const randomPaymentHash = randomHex(32);

    console.log(
      `Looking up non-existent invoice with payment hash: ${randomPaymentHash}`,
    );
    const result = await client.lookupInvoice({
      payment_hash: randomPaymentHash,
    });

    console.log("Lookup result:", result);
    return result;
  } catch (error) {
    if (
      error instanceof NIP47ClientError &&
      error.code === NIP47ErrorCode.NOT_FOUND
    ) {
      console.log("✅ Correctly received NOT_FOUND error:");
      console.log(`Error message: ${error.message}`);
      console.log(`Error code: ${error.code}`);

      // You would handle this appropriately in your application
      // For example, showing a "Invoice not found" message to the user
      return null;
    }

    console.error("Unexpected error during lookupInvoice:", error);
    throw error;
  }
}

async function main() {
  console.log("Starting NIP-47 Error Handling Example...");

  // Setup relay, service, and client
  const relay = new NostrRelay(3100);
  await relay.start();
  console.log(`Started ephemeral relay at ${relay.url}`);

  const serviceKeypair = await generateKeypair();
  const clientKeypair = await generateKeypair();

  // Create wallet with error simulation capabilities
  const errorWallet = new ErrorDemoWallet();

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
      name: "ErrorDemoService",
      methods: Object.values(NIP47Method),
    },
    errorWallet,
  );
  await service.init();
  console.log("Error demo service initialized");

  // Create and initialize client
  const client = new NostrWalletConnectClient(connectionOptions);
  await client.init();
  console.log("Client initialized and connected to service");

  // Wait for connections to stabilize
  await new Promise((resolve) => setTimeout(resolve, 2000));

  try {
    // 1. Demonstrate basic error handling - insufficient balance
    console.log("\n\n=== 1. Basic Error Handling ===");
    console.log("Demonstrating insufficient balance error:");
    errorWallet.setErrorMode("insufficient_balance");
    try {
      await client.payInvoice("lnbc2000n1demo");
    } catch (error) {
      console.log(formatError(error));
    }

    // 2. Demonstrate validation errors
    console.log("\n\n=== 2. Validation Errors ===");
    console.log("Demonstrating invalid invoice format error:");
    errorWallet.setErrorMode("invalid_invoice");
    try {
      await client.payInvoice("invalid_invoice_format");
    } catch (error) {
      console.log(formatError(error));
    }

    // 3. Demonstrate resource errors
    console.log("\n\n=== 3. Resource Errors ===");
    console.log("Demonstrating not found error:");
    errorWallet.setErrorMode("not_found");
    try {
      await client.lookupInvoice({ payment_hash: "nonexistent_hash" });
    } catch (error) {
      console.log(formatError(error));
    }

    // 4. Demonstrate payment errors
    console.log("\n\n=== 4. Payment Errors ===");
    console.log("Demonstrating payment rejected error:");
    errorWallet.setErrorMode("payment_rejected");
    try {
      await client.payInvoice("lnbc1000n1demo");
    } catch (error) {
      console.log(formatError(error));
    }

    console.log("Demonstrating route not found error:");
    errorWallet.setErrorMode("route_not_found");
    try {
      await client.payInvoice("lnbc1000n1demo");
    } catch (error) {
      console.log(formatError(error));
    }

    // 5. Demonstrate network errors
    console.log("\n\n=== 5. Network Errors ===");
    console.log("Demonstrating connection error:");
    errorWallet.setErrorMode("network");
    try {
      await client.getBalance();
    } catch (error) {
      console.log(formatError(error));
    }

    // 6. Demonstrate wallet errors
    console.log("\n\n=== 6. Wallet Errors ===");
    console.log("Demonstrating wallet locked error:");
    errorWallet.setErrorMode("wallet_locked");
    try {
      await client.getBalance();
    } catch (error) {
      console.log(formatError(error));
    }

    // 7. Demonstrate internal errors
    console.log("\n\n=== 7. Internal Errors ===");
    console.log("Demonstrating internal error:");
    errorWallet.setErrorMode("internal");
    try {
      await client.makeInvoice(1000, "Test invoice");
    } catch (error) {
      console.log(formatError(error));
    }

    // 8. Demonstrate retry mechanism for retriable errors
    console.log("\n\n=== 8. Retry Mechanism ===");
    console.log("Demonstrating automatic retry for temporary failures:");
    errorWallet.setErrorMode("unavailable");

    // On the third attempt, succeed
    let attemptCount = 0;
    const originalPayInvoice = errorWallet.payInvoice;
    errorWallet.payInvoice = async function (...args) {
      attemptCount++;
      if (attemptCount < 3) {
        throw {
          code: NIP47ErrorCode.WALLET_UNAVAILABLE,
          message: `Wallet is currently unavailable (attempt ${attemptCount})`,
        };
      }
      errorWallet.setErrorMode("none");
      return originalPayInvoice.apply(this, args);
    };

    try {
      // Use the built-in retry mechanism
      const result = await client.withRetry(
        () => client.payInvoice("lnbc1000n1demo"),
        { maxRetries: 3, initialDelay: 500, maxDelay: 2000, factor: 2 },
      );
      console.log("Succeeded after retries!");
      console.log("Result:", result);
    } catch (error) {
      console.log("Even retry mechanism failed:", formatError(error));
    }

    // Add a specific section to demonstrate NOT_FOUND error for lookupInvoice
    console.log("\n\n=== 5. Handling NOT_FOUND Error for lookupInvoice ===");
    console.log("Demonstrating proper handling of NOT_FOUND error:");

    // First reset the error mode
    errorWallet.setErrorMode("none");

    // Create an invoice first so we have a valid payment hash
    const invoice = await client.makeInvoice(1000, "Test invoice");
    console.log(
      `Created invoice with payment hash: ${invoice?.payment_hash || "unknown"}`,
    );

    // Look up the valid invoice
    console.log("\nLooking up valid invoice:");
    try {
      if (invoice && invoice.payment_hash) {
        const lookedUpInvoice = await client.lookupInvoice({
          payment_hash: invoice.payment_hash,
        });
        console.log("Successfully found invoice:", lookedUpInvoice);
      } else {
        console.log("Could not create valid invoice for testing");
      }
    } catch (error) {
      console.log("Error looking up valid invoice:", formatError(error));
    }

    // Now set error mode to simulate NOT_FOUND
    errorWallet.setErrorMode("not_found");

    // Try to look up a non-existent invoice
    console.log("\nLooking up non-existent invoice:");
    try {
      await client.lookupInvoice({
        payment_hash: "non_existent_payment_hash",
      });
    } catch (error) {
      console.log("Received expected NOT_FOUND error:");
      console.log(formatError(error));

      // Demonstrate the specific handling for NOT_FOUND
      if (
        error instanceof NIP47ClientError &&
        error.code === NIP47ErrorCode.NOT_FOUND
      ) {
        console.log("\nRecommended UI handling for NOT_FOUND:");
        console.log("- Show user-friendly message:", error.getUserMessage());
        console.log("- Offer to create a new invoice instead");
        console.log(
          "- Provide link to transaction history to look for other invoices",
        );
      }
    }

    // Add the new lookupInvoiceExample
    await lookupInvoiceExample(client);

    // Cleanup
    client.disconnect();
    service.disconnect();
    await relay.close();

    console.log("\nError handling demo completed successfully!");
  } catch (error) {
    console.error("Unexpected error during demo:", error);
    client.disconnect();
    service.disconnect();
    await relay.close();
  }
}

// Run the example
main().catch(console.error);
