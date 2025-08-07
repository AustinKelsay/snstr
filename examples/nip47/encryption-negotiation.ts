#!/usr/bin/env node

/**
 * NIP-47 Encryption Negotiation Example
 *
 * This example demonstrates how encryption negotiation works in NIP-47,
 * showing how clients and services negotiate between NIP-04 and NIP-44 encryption.
 */

import {
  NostrWalletConnectClient,
  NostrWalletService,
  WalletImplementation,
  NIP47Method,
  NIP47EncryptionScheme,
  NIP47Transaction,
  generateKeypair,
  GetInfoResponseResult,
} from "../../src";

// Minimal wallet implementation
class MinimalWallet implements WalletImplementation {
  async getInfo(): Promise<GetInfoResponseResult> {
    return {
      alias: "Test Wallet",
      methods: [NIP47Method.GET_INFO, NIP47Method.GET_BALANCE],
    };
  }

  async getBalance(): Promise<number> {
    return 50000;
  }

  async payInvoice(): Promise<never> {
    throw new Error("Not implemented");
  }

  async makeInvoice(): Promise<never> {
    throw new Error("Not implemented");
  }

  async lookupInvoice(): Promise<never> {
    throw new Error("Not implemented");
  }

  async listTransactions(): Promise<NIP47Transaction[]> {
    return [];
  }
}

async function demonstrateScenario(
  scenarioName: string,
  serviceEncryption: NIP47EncryptionScheme[],
  clientPreference: NIP47EncryptionScheme,
  expectedEncryption: string,
) {
  console.log(`\n📋 Scenario: ${scenarioName}`);
  console.log(`Service supports: ${serviceEncryption.join(", ")}`);
  console.log(`Client prefers: ${clientPreference}`);
  console.log(`Expected result: ${expectedEncryption}\n`);

  const relayUrl = process.env.RELAY_URL || "ws://localhost:7000";
  const serviceKeys = await generateKeypair();
  const clientKeys = await generateKeypair();

  // Create service
  const service = new NostrWalletService(
    {
      relays: [relayUrl],
      pubkey: serviceKeys.publicKey,
      privkey: serviceKeys.privateKey,
      methods: [NIP47Method.GET_INFO, NIP47Method.GET_BALANCE],
      encryptionSchemes: serviceEncryption,
    },
    new MinimalWallet(),
  );

  await service.init();
  console.log("✅ Service initialized");

  // Create client
  const client = new NostrWalletConnectClient({
    pubkey: serviceKeys.publicKey,
    secret: clientKeys.privateKey,
    relays: [relayUrl],
    preferredEncryption: clientPreference,
  });

  await client.init();
  console.log("✅ Client connected");

  // Perform a request to see which encryption is used
  const balance = await client.getBalance();
  console.log(`✅ Successfully got balance: ${balance} sats`);
  console.log(`🔐 Encryption negotiation successful!`);

  // Clean up
  await client.disconnect();
  await service.disconnect();
}

async function main() {
  console.log("🔐 NIP-47 Encryption Negotiation Example");
  console.log("========================================\n");

  console.log(
    "This example demonstrates various encryption negotiation scenarios:",
  );
  console.log("- Services advertising their supported encryption schemes");
  console.log("- Clients choosing the best available encryption");
  console.log("- Fallback behavior for compatibility\n");

  try {
    // Scenario 1: Both support NIP-44, client prefers NIP-44
    await demonstrateScenario(
      "Modern client with modern service",
      [NIP47EncryptionScheme.NIP44_V2, NIP47EncryptionScheme.NIP04],
      NIP47EncryptionScheme.NIP44_V2,
      "NIP-44 encryption",
    );

    // Scenario 2: Service only supports NIP-04, client prefers NIP-44
    await demonstrateScenario(
      "Modern client with legacy service",
      [NIP47EncryptionScheme.NIP04],
      NIP47EncryptionScheme.NIP44_V2,
      "Falls back to NIP-04",
    );

    // Scenario 3: Service only supports NIP-44, client prefers NIP-04
    await demonstrateScenario(
      "Legacy client preference with modern service",
      [NIP47EncryptionScheme.NIP44_V2, NIP47EncryptionScheme.NIP04],
      NIP47EncryptionScheme.NIP04,
      "Uses NIP-04 as requested",
    );

    // Scenario 4: Service only supports NIP-44
    await demonstrateScenario(
      "NIP-44 only service",
      [NIP47EncryptionScheme.NIP44_V2],
      NIP47EncryptionScheme.NIP04,
      "Upgrades to NIP-44",
    );

    console.log("\n✨ All scenarios completed successfully!");
    console.log("\n📝 Key Takeaways:");
    console.log(
      "1. Services advertise supported encryption in their info events",
    );
    console.log(
      "2. Clients can express preference but must support what service offers",
    );
    console.log(
      "3. NIP-44 provides better security when both parties support it",
    );
    console.log("4. NIP-04 remains supported for backward compatibility");
    console.log("5. The protocol gracefully handles all combinations");
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

// Run the example
main();
