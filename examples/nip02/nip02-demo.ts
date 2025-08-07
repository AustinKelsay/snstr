/**
 * NIP-02 Follows and Followers Example
 *
 * This example demonstrates how to fetch a user's follow list (contacts)
 * and how to find users who follow a given pubkey using NIP-02 (kind 3 events).
 *
 * Key concepts:
 * - Subscribing to kind 3 events for a specific author (to get their follow list).
 * - Subscribing to kind 3 events that tag a specific pubkey (to find followers).
 * - Handling replaceable events (limit: 1 for author-specific kind 3).
 */

import { Nostr } from "../../src/nip01/nostr";
import {
  RelayEvent,
  Filter,
  NostrEvent,
  ContactsEvent,
} from "../../src/types/nostr";
import { parseContactsFromEvent, Contact } from "../../src/nip02";
import { NostrRelay } from "../../src/utils/ephemeral-relay";

const USER_PUBKEY =
  "6260f29fa75c91aaa292f082e5e87b438d2ab4fdf96af398567b01802ee2fcd4";
const PUBLIC_RELAYS = ["wss://relay.damus.io", "wss://relay.nostr.band"];
const USE_EPHEMERAL = process.env.USE_PUBLIC_RELAYS !== "true";
const RELAY_PORT = 0;

async function getFollows(client: Nostr, pubkey: string): Promise<Contact[]> {
  // Return type changed
  return new Promise((resolve) => {
    let foundContacts: Contact[] = []; // Changed from Set<string> to Contact[]
    console.log(`\nFetching follows for pubkey: ${pubkey}...`);

    const filters: Filter[] = [
      {
        kinds: [3], // NIP-02 Contact List
        authors: [pubkey],
        limit: 1, // Kind 3 is replaceable, we only need the latest one
      },
    ];

    let subId: string[] | null = null;
    const onEvent = (event: NostrEvent, relay: string) => {
      console.log(
        `Received kind 3 event from ${relay} for ${pubkey}'s follows.`,
      );
      if (event.kind === 3) {
        // Use the new parseContactsFromEvent function
        foundContacts = parseContactsFromEvent(event as ContactsEvent);
      } else {
        console.warn(
          `Received non-kind-3 event in getFollows: ${event.id}, kind: ${event.kind}`,
        );
      }
      // Since kind 3 is replaceable and limit is 1, we can resolve and unsubscribe after the first valid event.
      // However, EOSE is a more robust signal for completion from the relay's perspective.
      // For simplicity with limit:1, one might resolve here, but let's stick to EOSE or timeout.
    };

    const onEOSE = () => {
      console.log(`EOSE received for ${pubkey}'s follows subscription.`);
      if (subId) {
        client.unsubscribe(subId);
        subId = null; // Explicitly mark as unsubscribed
      }
      resolve(foundContacts);
    };

    subId = client.subscribe(filters, onEvent, onEOSE);

    setTimeout(() => {
      if (subId) {
        // If subId is still set, it means EOSE hasn't fired or unsubscribed yet
        console.warn(
          "Timeout reached for follows subscription. Unsubscribing.",
        );
        client.unsubscribe(subId);
        subId = null;
      }
      resolve(foundContacts);
    }, 15000);
  });
}

async function getFollowers(
  client: Nostr,
  pubkey: string,
): Promise<Set<string>> {
  return new Promise((resolve) => {
    const followers = new Set<string>();
    console.log(`\nFetching followers of pubkey: ${pubkey}...`);

    const filters: Filter[] = [
      {
        kinds: [3], // NIP-02 Contact List
        "#p": [pubkey], // Events that tag the user's pubkey in a 'p' tag
        // No limit here, as many users could follow them
      },
    ];

    let subId: string[] | null = null;

    const onEvent = (event: NostrEvent, relay: string) => {
      console.log(
        `Received kind 3 event from ${relay}, author ${event.pubkey} might follow ${pubkey}.`,
      );
      // The author of this event is a potential follower
      followers.add(event.pubkey);
    };

    const onEOSE = () => {
      console.log(`EOSE received for ${pubkey}'s followers subscription.`);
      if (subId) {
        client.unsubscribe(subId);
      }
      resolve(followers);
    };

    subId = client.subscribe(filters, onEvent, onEOSE);

    // Timeout to prevent hanging indefinitely
    setTimeout(() => {
      if (subId) {
        console.warn(
          "Timeout reached for followers subscription. Unsubscribing.",
        );
        client.unsubscribe(subId);
      }
      resolve(followers); // Resolve with whatever was found
    }, 30000); // 30 seconds timeout, as this can be many events
  });
}

async function main() {
  let client: Nostr;
  let ephemeralRelay: NostrRelay | null = null;

  if (USE_EPHEMERAL) {
    console.log("Starting ephemeral relay...");
    ephemeralRelay = new NostrRelay(RELAY_PORT);
    await ephemeralRelay.start();
    console.log(`Ephemeral relay started at ${ephemeralRelay.url}`);
    client = new Nostr([ephemeralRelay.url]);
  } else {
    client = new Nostr(PUBLIC_RELAYS);
  }

  client.on(RelayEvent.Connect, (relayUrl) => {
    console.log(`Connected to ${relayUrl}`);
  });

  client.on(RelayEvent.Error, (relayUrl, error) => {
    console.error(`Error from ${relayUrl}:`, error);
  });

  client.on(RelayEvent.Notice, (relayUrl, notice) => {
    console.warn(`Notice from ${relayUrl}: ${notice}`);
  });

  try {
    await client.connectToRelays();

    const userFollows = await getFollows(client, USER_PUBKEY);
    console.log(`\n--- ${USER_PUBKEY} follows (${userFollows.length}) ---`);
    userFollows.forEach((contact) => {
      let contactDetails = `Pubkey: ${contact.pubkey}`;
      if (contact.petname) {
        contactDetails += `, Petname: ${contact.petname}`;
      }
      if (contact.relayUrl) {
        contactDetails += `, Relay: ${contact.relayUrl}`;
      }
      console.log(contactDetails);
    });

    const userFollowers = await getFollowers(client, USER_PUBKEY);
    console.log(
      `\n--- ${USER_PUBKEY} is followed by (${userFollowers.size}) ---`,
    );
    userFollowers.forEach((follower) => console.log(follower));
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    console.log("\nDisconnecting from relays...");
    client.disconnectFromRelays();
    if (ephemeralRelay) {
      await ephemeralRelay.close();
    }
    console.log("Disconnected.");
  }
}

main().catch(console.error);
