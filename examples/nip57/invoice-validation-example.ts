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
  validateZapReceipt
} from "../../src";
import { createSignedEvent, UnsignedEvent } from "../../src/nip01/event";
import * as utils from "../../src/nip57/utils";
import * as crypto from "../../src/utils/crypto";

// Create mocks
const VALID_HASH =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const INVALID_HASH =
  "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

// Store original functions to restore later
const originalParseBolt11Invoice = utils.parseBolt11Invoice;
const originalSha256Hex = crypto.sha256Hex;

// Mock the bolt11 parser
function mockParseBolt11Invoice(bolt11: string) {
  console.log(`Parsing invoice: ${bolt11}`);

  if (bolt11 === "lnbc1000n1_missing_hash_invoice") {
    return {
      paymentHash: "payment_hash_123",
      // No descriptionHash field
      amount: "1000000",
    };
  }

  return {
    paymentHash: "payment_hash_123",
    descriptionHash: VALID_HASH,
    amount: "1000000",
  };
}

// Mock the SHA-256 function for the valid case
function mockSha256HexValid(data: string | Uint8Array): string {
  console.log(
    `Calculating hash for: ${typeof data === "string" ? data.substring(0, 30) : "byte array"}...`,
  );
  return VALID_HASH;
}

// Mock the SHA-256 function for the invalid case
function mockSha256HexInvalid(data: string | Uint8Array): string {
  console.log(
    `Calculating hash for: ${typeof data === "string" ? data.substring(0, 30) : "byte array"}...`,
  );
  return INVALID_HASH;
}

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
    // Override the functions with our mocks
    (utils as any).parseBolt11Invoice = mockParseBolt11Invoice;
    (crypto as any).sha256Hex = mockSha256HexValid;

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

    // Override the sha256 function with our invalid mock
    (crypto as any).sha256Hex = mockSha256HexInvalid;

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

    // Reset sha256 to valid function to isolate the description hash issue
    (crypto as any).sha256Hex = mockSha256HexValid;

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
    // Restore original functions
    (utils as any).parseBolt11Invoice = originalParseBolt11Invoice;
    (crypto as any).sha256Hex = originalSha256Hex;
  }

  console.log("\n✅ Example completed");
}

main().catch((error) => {
  console.error("Error in example:", error);
  process.exit(1);
});
