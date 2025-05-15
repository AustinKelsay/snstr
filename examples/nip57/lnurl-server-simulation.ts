/**
 * NIP-57 Lightning Zaps - LNURL Server Simulation
 *
 * This example demonstrates how to:
 * 1. Set up a simulated LNURL server that supports zaps
 * 2. Process zap requests
 * 3. Generate and verify zap receipts
 *
 * Note: This is a simulation and doesn't interact with real Lightning Network.
 */

import {
  Nostr,
  NostrEvent,
  generateKeypair,
  createZapRequest,
  createZapReceipt,
  validateZapReceipt,
  ZapRequestOptions
} from "../../src";

// Import the function directly from the nip57 module
import { parseLnurlPayResponse } from "../../src/nip57";

import { createSignedEvent, UnsignedEvent } from "../../src/nip01/event";
import { NostrRelay } from "../../src/utils/ephemeral-relay";
import { createServer } from "http";
import { parse as parseUrl } from "url";
import { parse as parseQuery } from "querystring";

// Set up some constants
const RELAY_PORT = 3000;
const LNURL_SERVER_PORT = 3001;
const DEFAULT_RELAY_URL = `ws://localhost:${RELAY_PORT}`;

// Mock of LN infrastructure
class MockLightningWallet {
  private invoices: Map<
    string,
    {
      amount: number;
      description: string;
      paid: boolean;
      preimage: string;
    }
  > = new Map();

  generateInvoice(
    amountMsat: number,
    description: string,
  ): {
    bolt11: string;
    paymentHash: string;
  } {
    // In reality, this would call a Lightning node API
    const paymentHash = Math.random().toString(36).substring(2, 15);
    const preimage = Math.random().toString(36).substring(2, 15);
    const bolt11 = `lnbc${Math.floor(amountMsat / 1000)}n1p...`;

    this.invoices.set(paymentHash, {
      amount: amountMsat,
      description,
      paid: false,
      preimage,
    });

    return { bolt11, paymentHash };
  }

  // Simulate payment
  payInvoice(paymentHash: string): {
    success: boolean;
    preimage?: string;
  } {
    const invoice = this.invoices.get(paymentHash);
    if (!invoice) {
      return { success: false };
    }

    // Mark as paid
    invoice.paid = true;
    this.invoices.set(paymentHash, invoice);

    return {
      success: true,
      preimage: invoice.preimage,
    };
  }

  // Check if an invoice is paid
  isInvoicePaid(paymentHash: string): boolean {
    return this.invoices.get(paymentHash)?.paid || false;
  }

  // Get invoice details
  getInvoiceDetails(paymentHash: string) {
    return this.invoices.get(paymentHash);
  }
}

// Mock LNURL server
class MockLnurlServer {
  private server: any;
  private wallet: MockLightningWallet;
  private nostrClient: Nostr;
  private keypair: { privateKey: string; publicKey: string };
  private pendingZapRequests: Map<
    string,
    {
      zapRequest: NostrEvent;
      paymentHash: string;
    }
  > = new Map();

  constructor(
    port: number,
    wallet: MockLightningWallet,
    nostrClient: Nostr,
    keypair: { privateKey: string; publicKey: string },
  ) {
    this.wallet = wallet;
    this.nostrClient = nostrClient;
    this.keypair = keypair;

    // Create HTTP server
    this.server = createServer((req, res) => {
      res.setHeader("Content-Type", "application/json");

      // Parse URL
      const parsedUrl = parseUrl(req.url || "");
      const path = parsedUrl.pathname;

      try {
        // LNURL pay metadata endpoint
        if (path === "/.well-known/lnurlp/user") {
          this.handleLnurlPayMetadata(req, res);
        }
        // Callback endpoint
        else if (path === "/lnurlp/callback") {
          this.handleCallback(req, res, parsedUrl.query || "");
        }
        // Unknown endpoint
        else {
          res.statusCode = 404;
          res.end(JSON.stringify({ status: "ERROR", reason: "Not found" }));
        }
      } catch (error) {
        console.error("Server error:", error);
        res.statusCode = 500;
        res.end(JSON.stringify({ status: "ERROR", reason: "Server error" }));
      }
    });
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(LNURL_SERVER_PORT, () => {
        console.log(`LNURL server listening on port ${LNURL_SERVER_PORT}`);
        resolve();
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        console.log("LNURL server closed");
        resolve();
      });
    });
  }

  // Handler for LNURL pay metadata endpoint
  private handleLnurlPayMetadata(req: any, res: any) {
    // This emulates what a real LNURL server would return
    const response = {
      callback: `http://localhost:${LNURL_SERVER_PORT}/lnurlp/callback`,
      maxSendable: 10000000, // 10,000 sats in millisats
      minSendable: 1000, // 1 sat in millisats
      metadata: JSON.stringify([
        ["text/plain", "Pay to User"],
        ["text/identifier", "user@example.com"],
      ]),
      tag: "payRequest",
      allowsNostr: true,
      nostrPubkey: this.keypair.publicKey,
    };

    res.statusCode = 200;
    res.end(JSON.stringify(response));
  }

  // Handler for callback endpoint
  private async handleCallback(req: any, res: any, queryString: string) {
    // Parse query parameters
    const query = parseQuery(queryString);
    const amount = parseInt(query.amount as string, 10);
    const nostrParam = query.nostr as string;

    // Validate parameters
    if (!amount || isNaN(amount)) {
      res.statusCode = 400;
      res.end(
        JSON.stringify({
          status: "ERROR",
          reason: "Invalid amount",
        }),
      );
      return;
    }

    try {
      // Check if this is a zap request
      if (nostrParam) {
        // Parse the zap request
        const zapRequest = JSON.parse(decodeURIComponent(nostrParam));

        // Validate the kind
        if (zapRequest.kind !== 9734) {
          throw new Error("Not a zap request");
        }

        // Generate an invoice
        const { bolt11, paymentHash } = this.wallet.generateInvoice(
          amount,
          JSON.stringify(zapRequest), // Use zap request as description
        );

        // Store the zap request for later
        this.pendingZapRequests.set(paymentHash, {
          zapRequest,
          paymentHash,
        });

        // Simulate payment after 1 second (in real life, we'd wait for actual payment)
        setTimeout(() => this.handlePayment(paymentHash), 1000);

        // Return the invoice
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            pr: bolt11,
            payment_hash: paymentHash,
          }),
        );
      } else {
        // Regular LNURL pay request (non-zap)
        const { bolt11, paymentHash } = this.wallet.generateInvoice(
          amount,
          "Regular payment",
        );

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            pr: bolt11,
            payment_hash: paymentHash,
          }),
        );
      }
    } catch (error) {
      console.error("Error processing callback:", error);
      res.statusCode = 400;
      res.end(
        JSON.stringify({
          status: "ERROR",
          reason: `Invalid request: ${error instanceof Error ? error.message : String(error)}`,
        }),
      );
    }
  }

  // Handle an invoice payment
  private async handlePayment(paymentHash: string) {
    try {
      // In a real implementation, we would be notified by the LN node
      // Here we simulate a payment
      const payResult = this.wallet.payInvoice(paymentHash);

      if (!payResult.success) {
        console.error(`Payment failed for hash ${paymentHash}`);
        return;
      }

      // Get the pending zap request
      const pendingZap = this.pendingZapRequests.get(paymentHash);
      if (!pendingZap) {
        console.error(`No pending zap request for hash ${paymentHash}`);
        return;
      }

      const { zapRequest } = pendingZap;

      // Extract information from zap request
      const pTag = zapRequest.tags.find((tag) => tag[0] === "p");
      const eTag = zapRequest.tags.find((tag) => tag[0] === "e");
      const aTag = zapRequest.tags.find((tag) => tag[0] === "a");
      zapRequest.tags.find((tag) => tag[0] === "relays");
      const pSenderTag = zapRequest.tags.find((tag) => tag[0] === "P");

      if (!pTag) {
        console.error("Zap request has no p tag");
        return;
      }
      // Create a zap receipt
      const zapReceiptTemplate = createZapReceipt(
        {
          recipientPubkey: pTag[1],
          eventId: eTag?.[1],
          aTag: aTag?.[1],
          bolt11: this.wallet.getInvoiceDetails(paymentHash)?.description || "",
          preimage: payResult.preimage || "",
          zapRequest,
          senderPubkey: pSenderTag?.[1],
        },
        this.keypair.publicKey,
      );

      // Sign the receipt
      const signedZapReceipt = await createSignedEvent(
        {
          ...zapReceiptTemplate,
          pubkey: this.keypair.publicKey,
          created_at: Math.floor(Date.now() / 1000),
        } as UnsignedEvent,
        this.keypair.privateKey,
      );

      // Publish to requested relays - simplify by using our relay directly
      try {
        // Use the ephemeral relay directly
        // Our example is using a fixed port that we know about
        const ephemeralRelay = (global as any).__NOSTR_RELAY_INSTANCE__;
        if (ephemeralRelay) {
          ephemeralRelay.store(signedZapReceipt);
          console.log(`Published zap receipt to ephemeral relay`);
        } else {
          console.error("Could not access ephemeral relay instance");
        }
      } catch (error) {
        console.error(`Error publishing zap receipt:`, error);
      }

      // Remove from pending
      this.pendingZapRequests.delete(paymentHash);
    } catch (error) {
      console.error("Error handling payment:", error);
    }
  }

  getLnurlPayUrl(): string {
    return `http://localhost:${LNURL_SERVER_PORT}/.well-known/lnurlp/user`;
  }
}

async function main() {
  console.log("NIP-57 Lightning Zaps - LNURL Server Simulation");
  console.log("-------------------------------------------------\n");

  // Set up an ephemeral relay for testing
  const relay = new NostrRelay(RELAY_PORT);

  // Store relay reference for later use
  (global as any).__NOSTR_RELAY_INSTANCE__ = relay;

  await relay.start();
  console.log(`🔌 Ephemeral relay started at ${DEFAULT_RELAY_URL}\n`);

  // Generate keypairs for the example
  const senderKeypair = await generateKeypair();
  const recipientKeypair = await generateKeypair();
  const lnurlServerKeypair = await generateKeypair();

  console.log(`🔑 Sender pubkey: ${senderKeypair.publicKey.slice(0, 8)}...`);
  console.log(
    `🔑 Recipient pubkey: ${recipientKeypair.publicKey.slice(0, 8)}...`,
  );
  console.log(
    `🔑 LNURL server pubkey: ${lnurlServerKeypair.publicKey.slice(0, 8)}...\n`,
  );

  // Initialize Nostr clients
  const senderClient = new Nostr([DEFAULT_RELAY_URL]);
  await senderClient.setPrivateKey(senderKeypair.privateKey);
  await senderClient.connectToRelays();

  const recipientClient = new Nostr([DEFAULT_RELAY_URL]);
  await recipientClient.setPrivateKey(recipientKeypair.privateKey);
  await recipientClient.connectToRelays();

  const lnurlServerClient = new Nostr([DEFAULT_RELAY_URL]);
  await lnurlServerClient.connectToRelays();

  console.log("✅ Connected to relay\n");

  // Create a mock Lightning wallet
  const lightningWallet = new MockLightningWallet();

  // Create a mock LNURL server
  const lnurlServer = new MockLnurlServer(
    LNURL_SERVER_PORT,
    lightningWallet,
    lnurlServerClient,
    lnurlServerKeypair,
  );

  await lnurlServer.start();
  console.log(`✅ LNURL server started\n`);

  // Get the LNURL pay URL
  const lnurlPayUrl = lnurlServer.getLnurlPayUrl();
  console.log(`🔗 LNURL pay URL: ${lnurlPayUrl}\n`);

  // Create a text note to zap
  console.log("Publishing a note to zap...");
  const noteEvent = await recipientClient.publishTextNote(
    "This is a test note. Send me sats!",
  );
  console.log(`📝 Published note with ID: ${noteEvent?.id?.slice(0, 8)}...\n`);

  // Subscribe to zap receipts
  console.log("Subscribing to zap receipts...");
  const subId = recipientClient.subscribe(
    [{ kinds: [9735], "#p": [recipientKeypair.publicKey] }],
    (event, relayUrl) => {
      console.log(`Received zap receipt from ${relayUrl}...`);

      // Validate the zap receipt
      const validation = validateZapReceipt(
        event,
        lnurlServerKeypair.publicKey,
      );

      if (validation.valid) {
        console.log(`✅ Valid zap receipt:`);
        console.log(`   Amount: ${validation.amount} millisats`);
        console.log(`   Sender: ${validation.sender?.slice(0, 8)}...`);
        console.log(`   Recipient: ${validation.recipient?.slice(0, 8)}...`);
        if (validation.eventId) {
          console.log(`   Event ID: ${validation.eventId.slice(0, 8)}...`);
        }
        if (validation.content) {
          console.log(`   Comment: ${validation.content}`);
        }
      } else {
        console.error(`❌ Invalid zap receipt: ${validation.message}`);
      }
    },
  );

  console.log("✅ Subscribed to zap receipts\n");

  // Simulation of a client fetching LNURL metadata
  console.log("Fetching LNURL metadata...");
  const response = await fetch(lnurlPayUrl);
  const lnurlData = await response.json();
  console.log("✅ Received LNURL metadata\n");

  // Parse the response
  const lnurlPayResponse = parseLnurlPayResponse(lnurlData);
  if (!lnurlPayResponse) {
    console.error("Invalid LNURL pay response");
    return;
  }

  if (!lnurlPayResponse.allowsNostr || !lnurlPayResponse.nostrPubkey) {
    console.error("LNURL server does not support zaps");
    return;
  }

  console.log(
    `✅ LNURL server supports zaps with pubkey: ${lnurlPayResponse.nostrPubkey.slice(0, 8)}...\n`,
  );

  // Create a zap request
  console.log("Creating a zap request...");
  const amount = 5000000; // 5000 sats

  const zapRequestOptions: ZapRequestOptions = {
    recipientPubkey: recipientKeypair.publicKey,
    eventId: noteEvent?.id,
    amount,
    relays: [DEFAULT_RELAY_URL],
    content: "Testing the NIP-57 implementation! Here's 5000 sats.",
  };

  const zapRequestTemplate = createZapRequest(
    zapRequestOptions,
    senderKeypair.publicKey,
  );

  // Sign the zap request with createSignedEvent instead of signEvent
  const signedZapRequest = await createSignedEvent(
    {
      ...zapRequestTemplate,
      pubkey: senderKeypair.publicKey,
      created_at: Math.floor(Date.now() / 1000),
    } as UnsignedEvent,
    senderKeypair.privateKey,
  );

  console.log(
    `⚡ Created zap request with ID: ${signedZapRequest.id.slice(0, 8)}...\n`,
  );

  // Send the zap request to the LNURL server
  console.log("Sending zap request to LNURL server...");

  // Build the callback URL
  const callbackUrl = new URL(lnurlPayResponse.callback);
  callbackUrl.searchParams.append("amount", amount.toString());
  callbackUrl.searchParams.append(
    "nostr",
    encodeURIComponent(JSON.stringify(signedZapRequest)),
  );

  console.log(`🔗 Callback URL: ${callbackUrl}\n`);

  // Send the request
  const invoiceResponse = await fetch(callbackUrl.toString());
  const invoiceData = await invoiceResponse.json();

  if (invoiceData.status === "ERROR") {
    console.error(`❌ Error from LNURL server: ${invoiceData.reason}`);
    return;
  }

  console.log("✅ Received invoice from LNURL server");
  console.log(`⚡ Invoice: ${invoiceData.pr.slice(0, 30)}...`);
  console.log(`🔑 Payment hash: ${invoiceData.payment_hash}\n`);

  // In a real app, the user would pay the invoice
  // Here, our mock LNURL server will automatically "pay" it

  console.log("Waiting for payment to be processed...");
  console.log(
    "(The mock server will automatically simulate payment in 1 second)\n",
  );

  // Wait for the zap receipt to be received
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Clean up
  console.log("\nCleaning up...");
  recipientClient.unsubscribe(subId);
  await senderClient.disconnectFromRelays();
  await recipientClient.disconnectFromRelays();
  await lnurlServerClient.disconnectFromRelays();
  await relay.close();
  await lnurlServer.close();

  console.log("\n✅ Example completed.");
}

main().catch((error) => {
  console.error("Error in example:", error);
  process.exit(1);
});
