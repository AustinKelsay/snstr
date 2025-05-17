/**
 * NIP-57 Description Hash Validation Example
 *
 * This example demonstrates how the validateZapReceipt function
 * verifies that the description hash in the bolt11 invoice
 * matches the SHA-256 hash of the zap request JSON.
 */

import {
  generateKeypair,
  createZapRequest,
  createZapReceipt,
  validateZapReceipt,
} from "../../src";
import { createSignedEvent, UnsignedEvent } from "../../src/nip01/event";
import * as utils from "../../src/nip57/utils";
import * as crypto from "../../src/utils/crypto";

// Define types for our mocks and utility functions
interface Bolt11InvoiceData {
  paymentHash: string;
  descriptionHash?: string;
  amount: string;
  [key: string]: unknown;
}

// Type for the original invoice parsing function
type ParseBolt11InvoiceFunction = (bolt11: string) => Bolt11InvoiceData | null;

// Store original parseBolt11Invoice function to restore later
const originalParseBolt11Invoice =
  utils.parseBolt11Invoice as ParseBolt11InvoiceFunction;

// Variable to hold the description hash for the current test case
// null: means the invoice mock should return no description hash
// string: means the invoice mock should return this specific description hash
let currentDescriptionHashForMock: string | null | undefined = undefined;

// Mock the bolt11 parser to use the dynamically set description hash
function configuredMockParseBolt11Invoice(bolt11: string): Bolt11InvoiceData | null {
  console.log(`Parsing invoice: ${bolt11}`);

  // For the "missing_hash" case or if currentDescriptionHashForMock is explicitly null
  if (bolt11.includes("_missing_hash_") || currentDescriptionHashForMock === null) {
    return {
      paymentHash: "payment_hash_123",
      // No descriptionHash field
      amount: "1000000",
    };
  }

  return {
    paymentHash: "payment_hash_123",
    descriptionHash: currentDescriptionHashForMock, // Use the configured hash
    amount: "1000000",
  };
}

// Create mocks
const INVALID_HASH =
  "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

async function main() {
  console.log("NIP-57 Description Hash Validation Example");
  console.log("------------------------------------------\n");

  // Generate keypairs for our example
  console.log("Generating keypairs...");
  const senderKeypair = await generateKeypair();
  const recipientKeypair = await generateKeypair();
  const lnurlServerKeypair = await generateKeypair();

  console.log(`Sender: ${senderKeypair.publicKey.slice(0, 8)}...`);
  console.log(`Recipient: ${recipientKeypair.publicKey.slice(0, 8)}...`);
  console.log(`LNURL Server: ${lnurlServerKeypair.publicKey.slice(0, 8)}...\n`);

  try {
    // Override the parseBolt11Invoice functions with our mock
    // We are no longer mocking crypto.sha256Hex
    (
      utils as { parseBolt11Invoice: ParseBolt11InvoiceFunction }
    ).parseBolt11Invoice = configuredMockParseBolt11Invoice;

    // Example 1: Valid case - Hash matches
    console.log("EXAMPLE 1: VALID ZAP RECEIPT (hashes match)");
    console.log("------------------------------------------");

    // Create a valid zap request
    const validZapRequestTemplate = createZapRequest(
      {
        recipientPubkey: recipientKeypair.publicKey,
        amount: 1000000,
        relays: ["wss://relay.example.com"],
        eventId: "valid_event_id",
        content: "valid_zap_request", // This will generate our valid hash
      },
      senderKeypair.publicKey,
    );

    const validZapRequest = await createSignedEvent(
      {
        ...validZapRequestTemplate,
        pubkey: senderKeypair.publicKey,
        created_at: Math.floor(Date.now() / 1000),
      } as UnsignedEvent,
      senderKeypair.privateKey,
    );

    // Configure mockParseBolt11Invoice for the valid case
    // The actual hash will be calculated by the real crypto.sha256Hex inside validateZapReceipt
    // So, the mock invoice parser must return this same hash.
    // NIP-57 specifies hashing the JSON stringification of the zap request event.
    currentDescriptionHashForMock = crypto.sha256Hex(JSON.stringify(validZapRequest));
    console.log(`Mock invoice will use descriptionHash: ${currentDescriptionHashForMock.substring(0,15)}...`);

    // Create a valid zap receipt
    const validZapReceiptTemplate = createZapReceipt(
      {
        recipientPubkey: recipientKeypair.publicKey,
        eventId: "valid_event_id",
        bolt11: "lnbc1000n1_valid_invoice",
        zapRequest: validZapRequest,
      },
      lnurlServerKeypair.publicKey,
    );

    const validZapReceipt = await createSignedEvent(
      {
        ...validZapReceiptTemplate,
        pubkey: lnurlServerKeypair.publicKey,
        created_at: Math.floor(Date.now() / 1000),
      } as UnsignedEvent,
      lnurlServerKeypair.privateKey,
    );

    // Validate the zap receipt
    console.log("Validating zap receipt with matching description hash...");
    const validResult = validateZapReceipt(
      validZapReceipt,
      lnurlServerKeypair.publicKey,
    );

    console.log(
      `\nValidation result: ${validResult.valid ? "VALID ✅" : "INVALID ❌"}`,
    );
    if (validResult.valid) {
      console.log(`Amount: ${validResult.amount} millisats`);
      console.log(`Sender: ${validResult.sender?.slice(0, 8)}...`);
      console.log(`Recipient: ${validResult.recipient?.slice(0, 8)}...`);
    } else {
      console.log(`Error: ${validResult.message}`);
    }

    // Example 2: Invalid case - Hash doesn't match
    console.log("\n\nEXAMPLE 2: INVALID ZAP RECEIPT (hashes don't match)");
    console.log("--------------------------------------------------");

    // Configure mockParseBolt11Invoice for the invalid (mismatched hash) case
    // The real crypto.sha256Hex will calculate the actual hash of invalidZapRequest.
    // The mock invoice parser needs to return a *different* hash.
    currentDescriptionHashForMock = INVALID_HASH; // Predefined invalid hash constant
    console.log(`Mock invoice will use descriptionHash: ${currentDescriptionHashForMock.substring(0,15)}... (deliberately wrong for this test)`);

    // Create an invalid zap request
    const invalidZapRequestTemplate = createZapRequest(
      {
        recipientPubkey: recipientKeypair.publicKey,
        amount: 1000000,
        relays: ["wss://relay.example.com"],
        eventId: "invalid_event_id",
        content: "invalid_zap_request", // This will generate a different hash
      },
      senderKeypair.publicKey,
    );

    const invalidZapRequest = await createSignedEvent(
      {
        ...invalidZapRequestTemplate,
        pubkey: senderKeypair.publicKey,
        created_at: Math.floor(Date.now() / 1000),
      } as UnsignedEvent,
      senderKeypair.privateKey,
    );

    // Create an invalid zap receipt
    const invalidZapReceiptTemplate = createZapReceipt(
      {
        recipientPubkey: recipientKeypair.publicKey,
        eventId: "invalid_event_id",
        bolt11: "lnbc1000n1_invalid_invoice",
        zapRequest: invalidZapRequest,
      },
      lnurlServerKeypair.publicKey,
    );

    const invalidZapReceipt = await createSignedEvent(
      {
        ...invalidZapReceiptTemplate,
        pubkey: lnurlServerKeypair.publicKey,
        created_at: Math.floor(Date.now() / 1000),
      } as UnsignedEvent,
      lnurlServerKeypair.privateKey,
    );

    // Validate the invalid zap receipt
    console.log("Validating zap receipt with mismatched description hash...");
    const invalidResult = validateZapReceipt(
      invalidZapReceipt,
      lnurlServerKeypair.publicKey,
    );

    console.log(
      `\nValidation result: ${invalidResult.valid ? "VALID ✅" : "INVALID ❌"}`,
    );
    if (invalidResult.valid) {
      console.log(`Amount: ${invalidResult.amount} millisats`);
      console.log(`Sender: ${invalidResult.sender?.slice(0, 8)}...`);
      console.log(`Recipient: ${invalidResult.recipient?.slice(0, 8)}...`);
    } else {
      console.log(`Error: ${invalidResult.message}`);
    }

    // Example 3: Missing description hash
    console.log(
      "\n\nEXAMPLE 3: INVALID ZAP RECEIPT (missing description hash)",
    );
    console.log("----------------------------------------------------------");

    // Configure mockParseBolt11Invoice for the missing hash case
    currentDescriptionHashForMock = null; // Signal mock to omit descriptionHash
    console.log("Mock invoice will not include a descriptionHash.");

    // Create a zap receipt with a bolt11 invoice missing a description hash
    const missingHashZapReceiptTemplate = createZapReceipt(
      {
        recipientPubkey: recipientKeypair.publicKey,
        eventId: "valid_event_id", // Use the same event ID as the valid case
        bolt11: "lnbc1000n1_missing_hash_invoice",
        zapRequest: validZapRequest,
      },
      lnurlServerKeypair.publicKey,
    );

    const missingHashZapReceipt = await createSignedEvent(
      {
        ...missingHashZapReceiptTemplate,
        pubkey: lnurlServerKeypair.publicKey,
        created_at: Math.floor(Date.now() / 1000),
      } as UnsignedEvent,
      lnurlServerKeypair.privateKey,
    );

    // Validate the zap receipt
    console.log("Validating zap receipt with missing description hash...");
    const missingHashResult = validateZapReceipt(
      missingHashZapReceipt,
      lnurlServerKeypair.publicKey,
    );

    console.log(
      `\nValidation result: ${missingHashResult.valid ? "VALID ✅" : "INVALID ❌"}`,
    );
    if (missingHashResult.valid) {
      console.log(`Amount: ${missingHashResult.amount} millisats`);
      console.log(`Sender: ${missingHashResult.sender?.slice(0, 8)}...`);
      console.log(`Recipient: ${missingHashResult.recipient?.slice(0, 8)}...`);
    } else {
      console.log(`Error: ${missingHashResult.message}`);
    }
  } finally {
    // Restore original functions with proper typings
    (
      utils as { parseBolt11Invoice: ParseBolt11InvoiceFunction }
    ).parseBolt11Invoice = originalParseBolt11Invoice;
    // No need to restore crypto.sha256Hex as it wasn't mocked
  }

  console.log("\n✅ Example completed");
}

main().catch((error) => {
  console.error("Error in example:", error);
  process.exit(1);
});
