/**
 * Replaceable Events Example (NIP-01)
 * 
 * This example demonstrates working with replaceable events (kinds 0, 3, 10000-19999)
 * which are events where only the latest event for each combination of kind and pubkey
 * should be stored by relays.
 * 
 * Key concepts:
 * - Creating replaceable events
 * - Publishing replaceable events
 * - Retrieving the latest version of a replaceable event
 * - Understanding how newer events replace older ones
 * 
 * How to run:
 * npm run example:replaceable
 */

import { Nostr, NostrEvent, generateKeypair } from "../../src";
import { createEvent, createSignedEvent } from "../../src/utils/event";
import { NostrRelay } from "../../src/utils/ephemeral-relay";

// Create an ephemeral relay for the example
const USE_EPHEMERAL = process.env.USE_PUBLIC_RELAYS !== "true";
const RELAY_PORT = 3335;

// Use the environment variable to determine verbosity
const VERBOSE = process.env.VERBOSE === "true";
const log = (...args: any[]) => VERBOSE && console.log(...args);

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

    // 3. Create and publish a metadata event (kind 0)
    console.log("\n--- Creating an initial metadata event (kind 0) ---");
    const initialMetadata = {
      name: "Test User",
      about: "This is my initial profile",
      picture: "https://example.com/avatar.jpg"
    };
    
    // Create a kind 0 metadata event
    const metadataEvent = createEvent(
      {
        kind: 0,
        content: JSON.stringify(initialMetadata),
        tags: []
      },
      keys.publicKey
    );
    
    // Sign and publish the event
    console.log("Publishing initial metadata...");
    const signedMetadataEvent = await createSignedEvent(metadataEvent, keys.privateKey);
    const publishResult = await client.publishEvent(signedMetadataEvent);
    
    if (publishResult.success && publishResult.event) {
      console.log("✅ Published initial metadata");
      createdEvents.set("initial", publishResult.event);
    } else {
      console.error("❌ Failed to publish initial metadata");
    }

    // 4. Demonstrate updating the metadata with a new version
    console.log("\n--- Updating the metadata with a new version ---");
    // Small delay to ensure the created_at is different
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const updatedMetadata = {
      name: "Test User (Updated)",
      about: "This is my updated profile with more information",
      picture: "https://example.com/new-avatar.jpg",
      website: "https://example.com",
      nip05: "_@example.com"
    };
    
    const updatedMetadataEvent = createEvent(
      {
        kind: 0, // Same kind
        content: JSON.stringify(updatedMetadata),
        tags: []
      },
      keys.publicKey
    );
    
    console.log("Publishing updated metadata...");
    const signedUpdatedMetadataEvent = await createSignedEvent(updatedMetadataEvent, keys.privateKey);
    const updateResult = await client.publishEvent(signedUpdatedMetadataEvent);
    
    if (updateResult.success && updateResult.event) {
      console.log("✅ Published updated metadata");
      createdEvents.set("updated", updateResult.event);
    } else {
      console.error("❌ Failed to publish updated metadata");
    }

    // 5. Retrieve the latest version of the metadata
    console.log("\n--- Retrieving the latest version of the metadata ---");
    // Wait a moment for the relay to process the event
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const latestMetadata = client.getLatestReplaceableEvent(keys.publicKey, 0);
    
    if (latestMetadata) {
      console.log("✅ Retrieved latest version of the metadata:");
      console.log(`Content: ${latestMetadata.content}`);
      console.log(`Created at: ${new Date(latestMetadata.created_at * 1000).toLocaleString()}`);
      
      // Verify it's the updated version
      if (latestMetadata.content === JSON.stringify(updatedMetadata)) {
        console.log("✅ Correctly retrieved the updated version");
      } else {
        console.log("❌ Retrieved the wrong version");
      }
    } else {
      console.error("❌ Failed to retrieve the metadata");
    }

    // 6. Create a contact list (kind 3)
    console.log("\n--- Creating a contact list (kind 3) ---");
    
    // Create a kind 3 contact list event
    const initialContactList = createEvent(
      {
        kind: 3,
        content: "", // Usually empty for contact lists
        tags: [
          ["p", "32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245", "ws://example1.com", "friend1"],
          ["p", "7e9cdc033bd3d19be3564b1d5fb43318151b7f4d27553aca24966a7f68eb5367", "ws://example2.com", "friend2"]
        ]
      },
      keys.publicKey
    );
    
    console.log("Publishing initial contact list...");
    const signedInitialContactList = await createSignedEvent(initialContactList, keys.privateKey);
    const contactListResult = await client.publishEvent(signedInitialContactList);
    
    if (contactListResult.success && contactListResult.event) {
      console.log("✅ Published initial contact list");
      createdEvents.set("contactList", contactListResult.event);
    } else {
      console.error("❌ Failed to publish contact list");
    }

    // 7. Update the contact list
    console.log("\n--- Updating the contact list ---");
    // Small delay to ensure the created_at is different
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const updatedContactList = createEvent(
      {
        kind: 3,
        content: "",
        tags: [
          ["p", "32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245", "ws://example1.com", "friend1"],
          ["p", "7e9cdc033bd3d19be3564b1d5fb43318151b7f4d27553aca24966a7f68eb5367", "ws://example2.com", "friend2"],
          ["p", "a7ddedd2e8a96ea524ccd5a0d6d4e8f80c434172ba388b263d98ca5d16b79d81", "ws://example3.com", "friend3"]
        ]
      },
      keys.publicKey
    );
    
    console.log("Publishing updated contact list...");
    const signedUpdatedContactList = await createSignedEvent(updatedContactList, keys.privateKey);
    const updatedContactListResult = await client.publishEvent(signedUpdatedContactList);
    
    if (updatedContactListResult.success && updatedContactListResult.event) {
      console.log("✅ Published updated contact list");
      createdEvents.set("updatedContactList", updatedContactListResult.event);
    } else {
      console.error("❌ Failed to publish updated contact list");
    }

    // 8. Retrieve the latest version of the contact list
    console.log("\n--- Retrieving the latest version of the contact list ---");
    // Wait a moment for the relay to process the event
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const latestContactList = client.getLatestReplaceableEvent(keys.publicKey, 3);
    
    if (latestContactList) {
      console.log("✅ Retrieved latest version of the contact list:");
      console.log(`Number of contacts: ${latestContactList.tags.filter(tag => tag[0] === 'p').length}`);
      console.log(`Created at: ${new Date(latestContactList.created_at * 1000).toLocaleString()}`);
      
      // Verify it's the updated version
      if (latestContactList.tags.length === 3) {
        console.log("✅ Correctly retrieved the updated version with 3 contacts");
      } else {
        console.log("❌ Retrieved the wrong version");
      }
    } else {
      console.error("❌ Failed to retrieve the contact list");
    }

    // 9. Create a custom replaceable event (kind 10000+)
    console.log("\n--- Creating a custom replaceable event (kind 10002) ---");
    
    // Create a kind 10002 read/write relay list
    const initialRelayList = createEvent(
      {
        kind: 10002,
        content: "",
        tags: [
          ["r", "wss://relay1.example.com", "read"],
          ["r", "wss://relay2.example.com", "write"]
        ]
      },
      keys.publicKey
    );
    
    console.log("Publishing initial relay list...");
    const signedInitialRelayList = await createSignedEvent(initialRelayList, keys.privateKey);
    const relayListResult = await client.publishEvent(signedInitialRelayList);
    
    if (relayListResult.success && relayListResult.event) {
      console.log("✅ Published initial relay list");
      createdEvents.set("relayList", relayListResult.event);
    } else {
      console.error("❌ Failed to publish relay list");
    }

    // 10. Update the relay list
    console.log("\n--- Updating the relay list ---");
    // Small delay to ensure the created_at is different
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const updatedRelayList = createEvent(
      {
        kind: 10002,
        content: "",
        tags: [
          ["r", "wss://relay1.example.com", "read"],
          ["r", "wss://relay2.example.com", "write"],
          ["r", "wss://relay3.example.com", "read", "write"]
        ]
      },
      keys.publicKey
    );
    
    console.log("Publishing updated relay list...");
    const signedUpdatedRelayList = await createSignedEvent(updatedRelayList, keys.privateKey);
    const updatedRelayListResult = await client.publishEvent(signedUpdatedRelayList);
    
    if (updatedRelayListResult.success && updatedRelayListResult.event) {
      console.log("✅ Published updated relay list");
      createdEvents.set("updatedRelayList", updatedRelayListResult.event);
    } else {
      console.error("❌ Failed to publish updated relay list");
    }

    // 11. Retrieve the latest version of the relay list
    console.log("\n--- Retrieving the latest version of the relay list ---");
    // Wait a moment for the relay to process the event
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const latestRelayList = client.getLatestReplaceableEvent(keys.publicKey, 10002);
    
    if (latestRelayList) {
      console.log("✅ Retrieved latest version of the relay list:");
      console.log(`Number of relays: ${latestRelayList.tags.filter(tag => tag[0] === 'r').length}`);
      console.log(`Created at: ${new Date(latestRelayList.created_at * 1000).toLocaleString()}`);
      
      // Verify it's the updated version
      if (latestRelayList.tags.length === 3) {
        console.log("✅ Correctly retrieved the updated version with 3 relays");
      } else {
        console.log("❌ Retrieved the wrong version");
      }
    } else {
      console.error("❌ Failed to retrieve the relay list");
    }

    // Clean up resources
    console.log("\n--- Cleaning up ---");
    client.disconnectFromRelays();
    if (ephemeralRelay) {
      ephemeralRelay.close();
      console.log("Closed ephemeral relay");
    }
    
    console.log("\n🎉 Example completed successfully!");
    
  } catch (error) {
    console.error("Error in replaceable events example:", error);
  }
}

// Run the example
main(); 