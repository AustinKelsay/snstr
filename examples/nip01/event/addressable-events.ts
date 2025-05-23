/**
 * Addressable Events Example (NIP-01)
 *
 * This example demonstrates working with addressable events (kinds 30000-39999)
 * which are parameterized replaceable events that are uniquely identified by a
 * combination of kind, pubkey, and d-tag value.
 *
 * Key concepts:
 * - Creating addressable events with the d-tag
 * - Publishing addressable events
 * - Retrieving the latest version of an addressable event
 * - Understanding how newer events replace older ones
 *
 * How to run:
 * npm run example:addressable
 */

import { Nostr } from "../../../src/nip01/nostr";
import { NostrEvent } from "../../../src/types/nostr";
import { generateKeypair } from "../../../src/utils/crypto";
import {
  createAddressableEvent,
  createSignedEvent,
} from "../../../src/nip01/event";
import { NostrRelay } from "../../../src/utils/ephemeral-relay";

// Create an ephemeral relay for the example
const USE_EPHEMERAL = process.env.USE_PUBLIC_RELAYS !== "true";
const RELAY_PORT = 3334;

// Use the environment variable to determine verbosity
const VERBOSE = process.env.VERBOSE === "true";
const log = (...args: unknown[]) => VERBOSE && console.log(...args);

// Map to track created events (so we can reference them later)
const createdEvents: Map<string, NostrEvent> = new Map();

async function main() {
  try {
    // 1. Setup client and relay
    log("Setting up relay and client...");
    let client: Nostr;
    let ephemeralRelay: NostrRelay | null = null;

    if (USE_EPHEMERAL) {
      // Use an ephemeral relay for testing
      ephemeralRelay = new NostrRelay(RELAY_PORT);
      await ephemeralRelay.start();
      console.log(`Ephemeral relay started at ${ephemeralRelay.url}`);
      client = new Nostr([ephemeralRelay.url]);
    } else {
      // Use public relays
      client = new Nostr(["wss://relay.damus.io", "wss://relay.nostr.band"]);
      console.log("Using public relays");
    }

    // 2. Generate keys for our user
    const keys = await generateKeypair();
    console.log(`Generated public key: ${keys.publicKey}`);
    client.setPrivateKey(keys.privateKey);

    // Connect to the relay
    await client.connectToRelays();
    console.log("Connected to relays");

    // 3. Create and publish an addressable event (kind 30001)
    console.log("\n--- Creating an initial addressable event ---");
    const articleId = "my-first-post";
    const initialContent = "This is the first version of my article";

    // Create a kind 30001 "article" event with d-tag containing articleId
    const articleEvent = createAddressableEvent(
      30001, // Kind for addressable event
      articleId, // d-tag value that identifies this specific article
      initialContent, // Content
      keys.privateKey, // Private key for signing
      [
        ["title", "My First Article"],
        ["published_at", new Date().toISOString()],
      ], // Additional tags
    );

    // Sign and publish the event
    console.log("Publishing initial article...");
    const signedArticleEvent = await createSignedEvent(
      articleEvent,
      keys.privateKey,
    );
    const publishResult = await client.publishEvent(signedArticleEvent);

    if (publishResult.success && publishResult.event) {
      console.log("✅ Published initial article");
      createdEvents.set("initial", publishResult.event);
    } else {
      console.error("❌ Failed to publish initial article");
    }

    // 4. Demonstrate updating the article with a new version
    console.log("\n--- Updating the article with a new version ---");
    // Small delay to ensure the created_at is different
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const updatedContent =
      "This is the updated version of my article with more content and edits";
    const updatedArticleEvent = createAddressableEvent(
      30001, // Same kind
      articleId, // Same d-tag value (this is what makes it replace the previous version)
      updatedContent,
      keys.privateKey,
      [
        ["title", "My First Article (Updated)"],
        ["published_at", new Date().toISOString()],
        ["updated_at", new Date().toISOString()],
      ],
    );

    console.log("Publishing updated article...");
    const signedUpdatedArticleEvent = await createSignedEvent(
      updatedArticleEvent,
      keys.privateKey,
    );
    const updateResult = await client.publishEvent(signedUpdatedArticleEvent);

    if (updateResult.success && updateResult.event) {
      console.log("✅ Published updated article");
      createdEvents.set("updated", updateResult.event);
    } else {
      console.error("❌ Failed to publish updated article");
    }

    // 5. Retrieve the latest version of the article
    console.log("\n--- Retrieving the latest version of the article ---");
    // Wait a moment for the relay to process the event
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Subscribe to fetch the events first
    console.log("Fetching events via subscription...");
    await new Promise<void>((resolve) => {
      const subIds = client.subscribe(
        [{ kinds: [30001], authors: [keys.publicKey] }],
        (event) => {
          console.log(
            `Received event via subscription: ${event.id.slice(0, 8)}...`,
          );
        },
        () => {
          console.log("EOSE received, subscription complete");
          setTimeout(resolve, 1000); // Wait a bit after EOSE
        },
      );

      // Auto-close subscription after 5 seconds just in case
      setTimeout(() => {
        client.unsubscribe(subIds);
        resolve();
      }, 5000);
    });

    const latestArticle = client.getLatestAddressableEvent(
      30001,
      keys.publicKey,
      articleId,
    );

    if (latestArticle) {
      console.log("✅ Retrieved latest version of the article:");
      console.log(`Content: ${latestArticle.content}`);
      console.log(
        `Created at: ${new Date(latestArticle.created_at * 1000).toLocaleString()}`,
      );

      // Verify it's the updated version
      if (latestArticle.content === updatedContent) {
        console.log("✅ Correctly retrieved the updated version");
      } else {
        console.log("❌ Retrieved the wrong version");
      }
    } else {
      console.error("❌ Failed to retrieve the article");
    }

    // 6. Demonstrate using different d-tag values
    console.log("\n--- Creating multiple articles with different d-tags ---");

    // Create a second article with a different d-tag
    const article2Id = "my-second-post";
    const article2Content =
      "This is my second article with a different identifier";

    const article2Event = createAddressableEvent(
      30001,
      article2Id, // Different d-tag value
      article2Content,
      keys.privateKey,
      [
        ["title", "My Second Article"],
        ["published_at", new Date().toISOString()],
      ],
    );

    console.log("Publishing second article...");
    const signedArticle2Event = await createSignedEvent(
      article2Event,
      keys.privateKey,
    );
    const article2Result = await client.publishEvent(signedArticle2Event);

    if (article2Result.success && article2Result.event) {
      console.log("✅ Published second article");
      createdEvents.set("second", article2Result.event);
    } else {
      console.error("❌ Failed to publish second article");
    }

    // Wait a moment for the relay to process the event
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 7. Retrieve all articles by pubkey
    console.log("\n--- Retrieving all articles by the author ---");
    const allArticles = client.getAddressableEventsByPubkey(keys.publicKey);

    console.log(`Found ${allArticles.length} articles by this author:`);
    allArticles.forEach((article: NostrEvent, index: number) => {
      // Find the d-tag value
      const dTag = article.tags.find((tag: string[]) => tag[0] === "d");
      const dValue = dTag ? dTag[1] : "unknown";

      // Find the title tag
      const titleTag = article.tags.find((tag: string[]) => tag[0] === "title");
      const title = titleTag ? titleTag[1] : "Untitled";

      console.log(`Article ${index + 1}: "${title}" (d-tag: ${dValue})`);
    });

    // 8. Create a different kind of addressable event
    console.log("\n--- Creating a different kind of addressable event ---");

    // Create a kind 30078 "product" event
    const productId = "my-product-123";
    const productEvent = createAddressableEvent(
      30078, // Different kind
      productId,
      JSON.stringify({
        name: "Awesome Product",
        description: "This is an awesome product description",
        price: 100,
        currency: "USD",
      }),
      keys.privateKey,
      [["category", "electronics"]],
    );

    console.log("Publishing product...");
    const signedProductEvent = await createSignedEvent(
      productEvent,
      keys.privateKey,
    );
    const productResult = await client.publishEvent(signedProductEvent);

    if (productResult.success && productResult.event) {
      console.log("✅ Published product");
      createdEvents.set("product", productResult.event);
    } else {
      console.error("❌ Failed to publish product");
    }

    // Wait a moment for the relay to process the event
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 9. Retrieve all events of a specific kind
    console.log("\n--- Retrieving all products (kind 30078) ---");

    // Subscribe to fetch the products first
    console.log("Fetching products via subscription...");
    await new Promise<void>((resolve) => {
      const subIds = client.subscribe(
        [{ kinds: [30078], authors: [keys.publicKey] }],
        (event) => {
          console.log(
            `Received product via subscription: ${event.id.slice(0, 8)}...`,
          );
        },
        () => {
          console.log("EOSE received, subscription complete");
          setTimeout(resolve, 1000); // Wait a bit after EOSE
        },
      );

      // Auto-close subscription after 5 seconds just in case
      setTimeout(() => {
        client.unsubscribe(subIds);
        resolve();
      }, 5000);
    });

    const allProducts = client.getAddressableEventsByKind(30078);

    console.log(`Found ${allProducts.length} products:`);
    allProducts.forEach((product, index) => {
      try {
        const productData = JSON.parse(product.content);
        console.log(
          `Product ${index + 1}: ${productData.name} - $${productData.price} ${productData.currency}`,
        );
      } catch (e) {
        console.log(`Product ${index + 1}: <invalid JSON>`);
      }
    });

    // 10. Demonstrate error handling
    console.log("\n--- Demonstrating error handling ---");

    try {
      // Try to create an addressable event with an invalid kind
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const invalidEvent = createAddressableEvent(
        20000, // Invalid kind for addressable events (must be 30000-39999)
        "invalid-id",
        "This should fail",
        keys.privateKey,
      );
    } catch (error) {
      console.log(
        "✅ Correctly caught error when creating invalid addressable event:",
      );
      if (error instanceof Error) {
        console.log(`  Error: ${error.message}`);
      }
    }

    // Clean up
    console.log("\n--- Cleaning up ---");
    client.disconnectFromRelays();
    if (ephemeralRelay) {
      ephemeralRelay.close();
      console.log("Ephemeral relay closed");
    }
    console.log("Disconnected from relays");

    console.log("\nExample completed successfully! 🎉");
  } catch (error) {
    console.error("Error in addressable events example:", error);
  }
}

main();
