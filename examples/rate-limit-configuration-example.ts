/**
 * @fileoverview Rate Limit Configuration Example
 * 
 * This example demonstrates how to configure and manage rate limits
 * in SNSTR to prevent abuse and customize behavior for different use cases.
 */

import { Nostr, NostrOptions } from "../src";

/**
 * Example showing different rate limit configurations for various scenarios
 */
async function rateLimitConfigurationExample() {
  console.log("=== SNSTR Rate Limit Configuration Example ===\n");

  // 1. Conservative Rate Limits (for public services)
  console.log("1. Conservative Rate Limits (for public services):");
  const conservativeOptions: NostrOptions = {
    rateLimits: {
      subscribe: { limit: 20, windowMs: 60000 },  // 20 subscriptions per minute
      publish: { limit: 50, windowMs: 60000 },    // 50 publishes per minute
      fetch: { limit: 100, windowMs: 60000 }      // 100 fetches per minute
    }
  };
  
  const conservativeClient = new Nostr(["wss://relay.nostr.band"], conservativeOptions);
  console.log("Conservative limits:", conservativeClient.getRateLimits());

  // 2. Permissive Rate Limits (for private/trusted environments)
  console.log("\n2. Permissive Rate Limits (for private/trusted environments):");
  const permissiveOptions: NostrOptions = {
    rateLimits: {
      subscribe: { limit: 500, windowMs: 60000 },  // 500 subscriptions per minute
      publish: { limit: 1000, windowMs: 60000 },   // 1000 publishes per minute
      fetch: { limit: 2000, windowMs: 60000 }      // 2000 fetches per minute
    }
  };
  
  const permissiveClient = new Nostr(["wss://relay.nostr.band"], permissiveOptions);
  console.log("Permissive limits:", permissiveClient.getRateLimits());

  // 3. Custom Window Sizes (different time periods)
  console.log("\n3. Custom Window Sizes (different time periods):");
  const customWindowOptions: NostrOptions = {
    rateLimits: {
      subscribe: { limit: 10, windowMs: 10000 },   // 10 subscriptions per 10 seconds
      publish: { limit: 5, windowMs: 5000 },       // 5 publishes per 5 seconds
      fetch: { limit: 100, windowMs: 30000 }       // 100 fetches per 30 seconds
    }
  };
  
  const customClient = new Nostr(["wss://relay.nostr.band"], customWindowOptions);
  console.log("Custom window limits:", customClient.getRateLimits());

  // 4. Dynamic Rate Limit Updates
  console.log("\n4. Dynamic Rate Limit Updates:");
  const dynamicClient = new Nostr(["wss://relay.nostr.band"]);
  console.log("Default limits:", dynamicClient.getRateLimits());
  
  // Update limits during runtime
  dynamicClient.updateRateLimits({
    subscribe: { limit: 200, windowMs: 60000 },
    fetch: { limit: 500, windowMs: 60000 }
  });
  console.log("Updated limits:", dynamicClient.getRateLimits());

  // 5. Rate Limit Management
  console.log("\n5. Rate Limit Management:");
  
  // Reset rate limit counters
  dynamicClient.resetRateLimits();
  console.log("Rate limits reset");
  
  // Demonstrate rate limit error handling
  console.log("\n6. Rate Limit Error Handling:");
  try {
    const testClient = new Nostr(["wss://relay.nostr.band"], {
      rateLimits: {
        subscribe: { limit: 1, windowMs: 60000 } // Very restrictive for demo
      }
    });
    
    await testClient.connectToRelays();
    
    // First subscription should work
    const sub1 = testClient.subscribe([{ kinds: [1], limit: 1 }], () => {});
    console.log("First subscription created:", sub1);
    
    // Second subscription should be rate limited
    try {
      const sub2 = testClient.subscribe([{ kinds: [1], limit: 1 }], () => {});
      console.log("Second subscription created:", sub2);
    } catch (error) {
      console.log("Rate limit error caught:", error instanceof Error ? error.message : String(error));
    }
    
    testClient.disconnectFromRelays();
  } catch (error) {
    console.log("Error in rate limit demo:", error instanceof Error ? error.message : String(error));
  }

  console.log("\n=== Rate Limit Configuration Details ===");
  console.log("• Conservative: For public services with many users");
  console.log("• Permissive:   For private/trusted environments");
  console.log("• Custom:       Tailored time windows for specific needs");
  console.log("• Dynamic:      Runtime updates for changing requirements");
  console.log("• Management:   Tools to monitor and reset limits");
  
  console.log("\n=== Best Practices ===");
  console.log("• Start with conservative limits and adjust based on usage");
  console.log("• Use shorter windows for burst protection");
  console.log("• Monitor rate limit errors in production");
  console.log("• Consider implementing client-side caching to reduce requests");
  console.log("• Use resetRateLimits() when changing user contexts");
}

// Run the example
if (require.main === module) {
  rateLimitConfigurationExample().catch(console.error);
} 