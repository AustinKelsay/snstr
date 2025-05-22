/**
 * NIP-57 Lightning Zaps - ZapClient Example
 *
 * This example demonstrates how to use the NostrZapClient for:
 * 1. Fetching zaps received by a user
 * 2. Calculating detailed zap statistics
 * 3. Working with zap splits
 * 4. Validating zap receipts
 *
 * This example uses a signet Lightning address (snstrtest@vlt.ge) to demonstrate
 * real-world interaction with Lightning Network without using real money.
 */

import {
  Nostr,
  NostrEvent,
  generateKeypair,
  NostrZapClient,
  createZapRequest,
  validateZapReceipt,
} from "../../src";

import { createSignedEvent } from "../../src/nip01/event";
import { NostrRelay } from "../../src/utils/ephemeral-relay";
import {
  fetchLnurlPayMetadata,
  buildZapCallbackUrl,
} from "../../src/nip57/utils";

// Lightning address for testing on signet
const SIGNET_LIGHTNING_ADDRESS = "snstrtest@vlt.ge";

// Add timeout protection to prevent hanging
const TIMEOUT = 60000; // 60 seconds

async function main() {
  // Set a timeout to prevent the program from hanging
  const timeoutId = setTimeout(() => {
    console.error("Timeout: example took too long to complete. Exiting...");
    process.exit(1);
  }, TIMEOUT);

  let relay: NostrRelay | null = null;
  let client: Nostr | null = null;

  try {
    console.log("NIP-57 ZapClient Example with Signet Lightning Address");
    console.log("----------------------------------------------------\n");

    // Set up an ephemeral relay for testing
    relay = new NostrRelay(3000);
    await relay.start();
    console.log(`🔌 Ephemeral relay started at ${relay.url}\n`);

    // Generate keypairs for our example
    console.log("Generating keypairs...");
    const alice = await generateKeypair();
    const bob = await generateKeypair();
    const charlie = await generateKeypair();

    console.log(`🔑 Alice pubkey: ${alice.publicKey.slice(0, 8)}...`);
    console.log(`🔑 Bob pubkey: ${bob.publicKey.slice(0, 8)}...`);
    console.log(`🔑 Charlie pubkey: ${charlie.publicKey.slice(0, 8)}...\n`);

    // Initialize a Nostr client for Alice
    client = new Nostr([relay.url]);
    await client.setPrivateKey(alice.privateKey);
    await client.connectToRelays();
    console.log("✅ Connected to relay\n");

    // Create the ZapClient
    const zapClient = new NostrZapClient({
      client,
      defaultRelays: [relay.url],
    });

    // Create some notes for Bob and Charlie
    console.log("Creating test notes...");

    // Bob's regular note
    const bobNote = await createSignedEvent(
      {
        kind: 1,
        content: "Bob's regular note",
        tags: [],
        pubkey: bob.publicKey,
        created_at: Math.floor(Date.now() / 1000 - 3600), // One hour ago
      },
      bob.privateKey,
    );

    // Charlie's note with zap split
    const charlieNote = await createSignedEvent(
      {
        kind: 1,
        content: "Charlie's note with zap split",
        tags: [
          ["zap", bob.publicKey, relay.url, "1"], // 25% to Bob
          ["zap", alice.publicKey, relay.url, "3"], // 75% to Alice
        ],
        pubkey: charlie.publicKey,
        created_at: Math.floor(Date.now() / 1000 - 1800), // 30 minutes ago
      },
      charlie.privateKey,
    );

    // Store the notes in the relay
    relay.store(bobNote);
    relay.store(charlieNote);
    console.log(`📝 Created Bob's note with ID: ${bobNote.id.slice(0, 8)}...`);
    console.log(
      `📝 Created Charlie's note with ID: ${charlieNote.id.slice(0, 8)}...\n`,
    );

    // Fetch LNURL metadata to get the LNURL server pubkey
    console.log(`Fetching LNURL metadata for ${SIGNET_LIGHTNING_ADDRESS}...`);
    const lnurlMetadata = await fetchLnurlPayMetadata(SIGNET_LIGHTNING_ADDRESS);

    if (
      !lnurlMetadata ||
      !lnurlMetadata.allowsNostr ||
      !lnurlMetadata.nostrPubkey
    ) {
      throw new Error(
        "Failed to fetch valid LNURL metadata or the service does not support zaps",
      );
    }

    const lnurlServerPubkey = lnurlMetadata.nostrPubkey;
    console.log(
      `✅ LNURL server supports zaps with pubkey: ${lnurlServerPubkey.slice(0, 8)}...\n`,
    );

    // Create a real zap for Bob's note
    console.log("Creating a real zap request for Bob's note...");

    const zapRequestTemplate = createZapRequest(
      {
        recipientPubkey: bob.publicKey,
        eventId: bobNote.id,
        amount: 10000, // 10 sats
        relays: [relay.url],
        content: "Testing the NIP-57 implementation with signet!",
      },
      alice.publicKey,
    );

    const eventToSign = {
      ...zapRequestTemplate,
      pubkey: alice.publicKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: zapRequestTemplate.tags ?? [],
    };

    const aliceZapRequest = await createSignedEvent(
      eventToSign,
      alice.privateKey,
    );

    console.log(
      `✅ Created zap request with ID: ${aliceZapRequest.id.slice(0, 8)}...\n`,
    );

    // Get the callback URL from the LNURL metadata
    const callbackUrl = lnurlMetadata.callback;

    console.log("Building callback URL...");

    // Build the full callback URL with the zap request
    const zapCallbackUrl = buildZapCallbackUrl(
      callbackUrl,
      JSON.stringify(aliceZapRequest),
      10000, // 10 sats in millisats
    );

    console.log("Fetching invoice from LNURL server...");

    try {
      // Send the request to get an invoice
      const response = await fetch(zapCallbackUrl);
      const data = await response.json();

      console.log("Full response from LNURL server:", data);

      if (data.status === "ERROR") {
        throw new Error(`Error from LNURL server: ${data.reason}`);
      }

      console.log(`✅ Received invoice: ${data.pr.slice(0, 30)}...\n`);

      // In a real application, you would now pay this invoice
      // For this example, we'll simulate a payment
      console.log(
        "In a real app, you would pay this invoice with a Lightning wallet",
      );
      console.log(
        "Since this is a signet address, no real payment is required.\n",
      );

      // Manually create a simulated zap receipt for demonstration purposes
      console.log("Creating a simulated zap receipt...");

      // For demonstration purposes only - in reality, the LNURL server would create and sign this
      const zapReceiptTemplate = {
        kind: 9735, // Zap receipt kind
        pubkey: lnurlServerPubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ["p", bob.publicKey],
          ["e", bobNote.id],
          ["bolt11", data.pr],
          ["description", JSON.stringify(aliceZapRequest)],
        ],
        content: "",
        id: "", // Will be calculated
        sig: "", // Will be calculated
      };

      // NOTE: In reality, we can't sign on behalf of the LNURL server
      // This is just for demonstration purposes to simulate a receipt
      // Instead of trying to sign, we'll create a manual event object

      const simZapReceipt: NostrEvent = {
        ...zapReceiptTemplate,
        id: "simulated_zap_receipt_id",
        sig: "simulated_signature",
      };

      // Store the simulated zap receipt in the relay
      relay.store(simZapReceipt);
      console.log(`⚡ Stored simulated zap receipt in relay\n`);

      // Wait a bit for the relay to process
      console.log("Waiting for relay to process...");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Now demonstrate zap split functionality
      console.log("\n3. ZAP SPLITS");
      console.log("------------");

      console.log("Analyzing zap split in Charlie's note...");
      const splitInfo = zapClient.parseZapSplit(charlieNote);

      console.log("Zap split configuration:");
      let totalWeight = 0;
      for (const split of splitInfo) {
        totalWeight += split.weight;
      }

      for (const split of splitInfo) {
        const percentage = Math.round((split.weight / totalWeight) * 100);
        console.log(`  👤 ${split.pubkey.slice(0, 8)}... (${percentage}%)`);
      }

      // Calculate actual amounts for a 1000 sat zap
      const totalZapAmount = 1000000; // 1000 sats in millisats
      const splitAmounts = zapClient.calculateZapSplitAmounts(
        totalZapAmount,
        splitInfo,
      );

      console.log(
        `\nIf Charlie's note receives a ${totalZapAmount / 1000} sat zap, it will be split as:`,
      );
      for (const amount of splitAmounts) {
        console.log(
          `  💰 ${amount.pubkey.slice(0, 8)}... gets ${amount.amount / 1000} sats via ${amount.relay}`,
        );
      }

      // Validate the simulated zap receipt
      console.log("\nValidating the simulated zap receipt:");
      const validationResult = validateZapReceipt(
        simZapReceipt,
        lnurlServerPubkey,
      );
      console.log(
        `Validation result: ${JSON.stringify(validationResult, null, 2)}`,
      );
      console.log(
        "\nNote: In a real application, the LNURL server would create and sign the zap receipt",
      );
      console.log(
        "The validation would fail for our simulated receipt because we cannot properly sign it",
      );
    } catch (error) {
      console.error("Error interacting with LNURL server:", error);
    }
  } catch (error) {
    console.error("Error in example:", error);
  } finally {
    // Clean up
    console.log("\nCleaning up resources...");
    if (client) {
      await client.disconnectFromRelays();
    }
    if (relay) {
      await relay.close();
    }

    // Clear the timeout
    clearTimeout(timeoutId);

    console.log("✅ Example completed.");
  }
}

main().catch((error) => {
  console.error("Fatal error in example:", error);
  process.exit(1);
});
