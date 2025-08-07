#!/usr/bin/env node

/**
 * NIP-47 with NIP-44 Encryption Example
 *
 * This example demonstrates how to use NIP-44 encryption with NIP-47 (Nostr Wallet Connect).
 * NIP-44 provides versioned, encrypted communication using ChaCha20 and HMAC-SHA256,
 * offering better security properties than NIP-04.
 */

import {
  NostrWalletConnectClient,
  NostrWalletService,
  WalletImplementation,
  NIP47Method,
  NIP47NotificationType,
  NIP47EncryptionScheme,
  NIP47Transaction,
  NIP47Error,
  NIP47ErrorCode,
  TransactionType,
  generateKeypair,
  generateNWCURL,
  GetInfoResponseResult,
  PaymentResponseResult,
  MakeInvoiceResponseResult,
} from "../../src";
import { randomUUID } from "crypto";

// Simple in-memory wallet implementation for demonstration
class DemoWalletImplementation implements WalletImplementation {
  private balance: number = 100000000; // 1 BTC in sats
  private invoices: Map<string, MakeInvoiceResponseResult> = new Map();

  async getInfo(): Promise<GetInfoResponseResult> {
    return {
      alias: "NIP-44 Demo Wallet",
      color: "#00ff00",
      pubkey:
        "0000000000000000000000000000000000000000000000000000000000000000",
      network: "testnet",
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
    invoice: string,
    amount?: number,
    maxfee?: number,
  ): Promise<PaymentResponseResult> {
    // Simulate payment
    const paymentAmount = amount || 10000; // Default 10k sats
    const fees = maxfee || 100;

    if (this.balance < paymentAmount + fees) {
      const error: NIP47Error = {
        code: NIP47ErrorCode.INSUFFICIENT_BALANCE,
        message: "Not enough funds",
      };
      throw error;
    }

    this.balance -= paymentAmount + fees;

    return {
      preimage:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      payment_hash:
        "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
      amount: paymentAmount,
      fees_paid: fees,
    };
  }

  async makeInvoice(
    amount: number,
    description: string,
    description_hash?: string,
    expiry?: number,
  ): Promise<MakeInvoiceResponseResult> {
    // Generate a proper UUID for the payment hash to ensure uniqueness
    const payment_hash = randomUUID();
    const invoice = {
      invoice: `lnbc${amount}n1p${payment_hash.substring(0, 10)}`,
      payment_hash,
      amount,
      created_at: Math.floor(Date.now() / 1000),
      expires_at: Math.floor(Date.now() / 1000) + (expiry || 3600),
      description,
      description_hash,
    };

    this.invoices.set(payment_hash, invoice);
    return invoice;
  }

  async lookupInvoice(params: {
    payment_hash?: string;
    invoice?: string;
  }): Promise<NIP47Transaction> {
    const invoice = params.payment_hash
      ? this.invoices.get(params.payment_hash)
      : Array.from(this.invoices.values()).find(
          (i) => i.invoice === params.invoice,
        );

    if (!invoice) {
      const error: NIP47Error = {
        code: NIP47ErrorCode.NOT_FOUND,
        message: "Invoice not found",
      };
      throw error;
    }

    return {
      type: TransactionType.INCOMING,
      invoice: invoice.invoice,
      payment_hash: invoice.payment_hash,
      amount: invoice.amount,
      fees_paid: 0,
      created_at: invoice.created_at,
      expires_at: invoice.expires_at,
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
    // Return some demo transactions
    return [
      {
        type: TransactionType.INCOMING,
        payment_hash:
          "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
        amount: 50000,
        fees_paid: 0,
        created_at: Math.floor(Date.now() / 1000) - 86400,
        settled_at: Math.floor(Date.now() / 1000) - 86400,
      },
      {
        type: TransactionType.OUTGOING,
        payment_hash:
          "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
        amount: 25000,
        fees_paid: 50,
        created_at: Math.floor(Date.now() / 1000) - 172800,
        settled_at: Math.floor(Date.now() / 1000) - 172800,
      },
    ];
  }
}

async function main() {
  console.log("🔐 NIP-47 with NIP-44 Encryption Example\n");

  // Generate keypairs for service and client
  const serviceKeys = await generateKeypair();
  const clientKeys = await generateKeypair();

  console.log("📝 Generated Keys:");
  console.log(`Service Public Key: ${serviceKeys.publicKey}`);
  console.log(`Client Public Key: ${clientKeys.publicKey}\n`);

  // Use a local relay (you can change this to any relay URL)
  const relayUrl = process.env.RELAY_URL || "ws://localhost:7000";
  console.log(`📡 Using relay: ${relayUrl}\n`);

  // Create wallet service with NIP-44 support
  console.log("🏦 Creating wallet service with NIP-44 encryption support...");
  const service = new NostrWalletService(
    {
      relays: [relayUrl],
      pubkey: serviceKeys.publicKey,
      privkey: serviceKeys.privateKey,
      methods: Object.values(NIP47Method).filter(
        (m) => m !== NIP47Method.UNKNOWN,
      ),
      notificationTypes: Object.values(NIP47NotificationType),
      // Explicitly support both NIP-04 and NIP-44 for maximum compatibility
      encryptionSchemes: [
        NIP47EncryptionScheme.NIP44_V2,
        NIP47EncryptionScheme.NIP04,
      ],
    },
    new DemoWalletImplementation(),
  );

  await service.init();
  console.log("✅ Wallet service initialized\n");

  // Generate NWC URL
  const nwcOptions = {
    pubkey: serviceKeys.publicKey,
    secret: clientKeys.privateKey,
    relays: [relayUrl],
  };
  const nwcUrl = generateNWCURL(nwcOptions);
  console.log("🔗 NWC URL (share this with clients):");
  console.log(nwcUrl);
  console.log();

  // Create client preferring NIP-44 encryption
  console.log("📱 Creating client with NIP-44 preference...");
  const client = new NostrWalletConnectClient({
    ...nwcOptions,
    preferredEncryption: NIP47EncryptionScheme.NIP44_V2, // Prefer NIP-44
  });

  await client.init();
  console.log("✅ Client connected and discovered service capabilities\n");

  // Check encryption support
  console.log("🔍 Checking service capabilities...");
  const info = await client.getInfo();
  if (info) {
    console.log(`Service Name: ${info.alias}`);
    console.log(`Supported Methods: ${info.methods.join(", ")}`);
    console.log(
      `Supported Encryption: ${info.encryption?.join(", ") || "NIP-04 only"}`,
    );
    console.log();
  }

  // Perform wallet operations with NIP-44 encryption
  console.log("💰 Performing wallet operations with NIP-44 encryption...\n");

  // Get balance
  const balance = await client.getBalance();
  console.log(`Balance: ${balance.toLocaleString()} sats`);

  // Create invoice
  const invoice = await client.makeInvoice(25000, "Demo payment with NIP-44");
  console.log(`\nCreated invoice: ${invoice?.invoice?.substring(0, 30)}...`);
  console.log(`Amount: ${invoice?.amount} sats`);

  // Simulate payment
  console.log("\nSimulating payment...");
  const payment = await client.payInvoice("lnbc10000n1pdummy");
  console.log(`Payment successful!`);
  console.log(`Preimage: ${payment?.preimage?.substring(0, 20)}...`);
  console.log(`Fees paid: ${payment?.fees_paid} sats`);

  // Get updated balance
  const newBalance = await client.getBalance();
  console.log(`\nNew balance: ${newBalance.toLocaleString()} sats`);

  // List recent transactions
  const txList = await client.listTransactions({ limit: 5 });
  console.log(`\nRecent transactions: ${txList?.transactions.length || 0}`);
  txList?.transactions.forEach((tx, i) => {
    console.log(`  ${i + 1}. ${tx.type} - ${tx.amount} sats`);
  });

  // Set up notification handler
  console.log("\n📬 Setting up notification handler...");
  client.onNotification(
    NIP47NotificationType.PAYMENT_RECEIVED,
    (notification) => {
      console.log("💸 Payment received notification!");
      const tx = notification.notification as NIP47Transaction;
      console.log(`Amount: ${tx.amount} sats`);
    },
  );

  // Simulate sending a notification
  console.log("Simulating payment notification...");

  // Create a properly typed transaction object
  const paymentNotification: NIP47Transaction = {
    type: TransactionType.INCOMING,
    payment_hash: "notification_test_hash",
    amount: 5000,
    fees_paid: 0,
    created_at: Math.floor(Date.now() / 1000),
  };

  // Type guard to validate NIP47Transaction structure
  function isValidNIP47Transaction(obj: unknown): obj is NIP47Transaction {
    return (
      typeof obj === "object" &&
      obj !== null &&
      "type" in obj &&
      "payment_hash" in obj &&
      "amount" in obj &&
      "fees_paid" in obj &&
      "created_at" in obj
    );
  }

  // Convert to Record<string, unknown> with validation
  if (!isValidNIP47Transaction(paymentNotification)) {
    throw new Error("Invalid payment notification structure");
  }

  // Safe conversion after validation - spread to create a new object
  const notificationData: Record<string, unknown> = { ...paymentNotification };

  await service.sendNotification(
    clientKeys.publicKey,
    NIP47NotificationType.PAYMENT_RECEIVED,
    notificationData,
  );

  // Wait for notification to be processed
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Clean up
  console.log("\n🧹 Cleaning up...");
  await client.disconnect();
  await service.disconnect();
  console.log("✅ Disconnected successfully");

  console.log("\n✨ NIP-44 encryption example completed!");
  console.log("\nKey benefits of NIP-44 over NIP-04:");
  console.log("- Versioned protocol for future improvements");
  console.log("- Better padding for improved privacy");
  console.log("- ChaCha20 encryption (more secure than AES)");
  console.log("- HMAC authentication prevents tampering");
  console.log("- Larger nonce space reduces collision risk");
}

// Run the example
main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
