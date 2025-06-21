import { NostrRemoteSignerBunker } from "../../src/nip46";
import { generateKeypair } from "../../src/utils/crypto";

/**
 * Example demonstrating how to configure custom rate limiting for NIP-46 bunker
 * 
 * This example shows how you can customize the rate limiter settings based on
 * your deployment needs - whether you need stricter limits for public services
 * or more relaxed limits for private/trusted environments.
 */

async function main() {
  // Generate keypairs for the example
  const userKeypair = await generateKeypair();
  const signerKeypair = await generateKeypair();

  console.log("=== NIP-46 Custom Rate Limiter Configuration Example ===\n");

  // Example 1: Conservative/Public Service Configuration
  console.log("1. Conservative Rate Limiter (for public services):");
  const _conservativeBunker = new NostrRemoteSignerBunker({
    userPubkey: userKeypair.publicKey,
    signerPubkey: signerKeypair.publicKey,
    relays: ["wss://relay.damus.io", "wss://nos.lol"],
    rateLimitConfig: {
      maxRequestsPerMinute: 30,    // Lower minute limit
      maxRequestsPerHour: 500,     // Lower hour limit
      burstSize: 3,                // Smaller burst allowance
      cleanupIntervalMs: 60000     // More frequent cleanup
    },
    debug: true
  });

  // Example 2: Moderate Configuration (default-like)
  console.log("2. Moderate Rate Limiter (balanced):");
  const _moderateBunker = new NostrRemoteSignerBunker({
    userPubkey: userKeypair.publicKey,
    signerPubkey: signerKeypair.publicKey,
    relays: ["wss://relay.damus.io", "wss://nos.lol"],
    rateLimitConfig: {
      maxRequestsPerMinute: 60,    // Standard minute limit
      maxRequestsPerHour: 1000,    // Standard hour limit
      burstSize: 10,               // Standard burst allowance
      cleanupIntervalMs: 300000    // Standard cleanup interval (5 minutes)
    },
    debug: true
  });

  // Example 3: Permissive/Private Configuration
  console.log("3. Permissive Rate Limiter (for private/trusted environments):");
  const _permissiveBunker = new NostrRemoteSignerBunker({
    userPubkey: userKeypair.publicKey,
    signerPubkey: signerKeypair.publicKey,
    relays: ["wss://relay.damus.io", "wss://nos.lol"],
    rateLimitConfig: {
      maxRequestsPerMinute: 120,   // Higher minute limit
      maxRequestsPerHour: 5000,    // Higher hour limit
      burstSize: 25,               // Larger burst allowance
      cleanupIntervalMs: 600000    // Less frequent cleanup (10 minutes)
    },
    debug: true
  });

  // Example 4: Using default configuration (no rateLimitConfig provided)
  console.log("4. Default Rate Limiter (when no config is provided):");
  const _defaultBunker = new NostrRemoteSignerBunker({
    userPubkey: userKeypair.publicKey,
    signerPubkey: signerKeypair.publicKey,
    relays: ["wss://relay.damus.io", "wss://nos.lol"],
    // No rateLimitConfig provided - uses defaults
    debug: true
  });

  console.log("\n=== Rate Limiter Configuration Details ===");
  console.log("Conservative: 30/min, 500/hour, burst=3");
  console.log("Moderate:     60/min, 1000/hour, burst=10 (default)");
  console.log("Permissive:   120/min, 5000/hour, burst=25");
  console.log("Default:      60/min, 1000/hour, burst=10 (when no config)");

  console.log("\n=== Usage Scenarios ===");
  console.log("Conservative: Public services, untrusted clients, resource-constrained");
  console.log("Moderate:     General purpose, typical applications");
  console.log("Permissive:   Private networks, trusted clients, high-throughput needs");
  console.log("Default:      When you don't need custom rate limiting");

  console.log("\n=== All bunkers created successfully! ===");
  console.log("Rate limiter configurations are applied at construction time.");
  console.log("The bunkers are ready to start() with their respective rate limits.");
}

if (require.main === module) {
  main().catch(console.error);
}

export { main }; 