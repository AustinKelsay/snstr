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

import { Nostr, RelayEvent, Filter, NostrEvent } from "../src"; // Adjust path based on your project structure

const USER_PUBKEY =
  "6260f29fa75c91aaa292f082e5e87b438d2ab4fdf96af398567b01802ee2fcd4";
const RELAYS = ["wss://relay.damus.io", "wss://relay.nostr.band"]; // Add more or change as needed

async function getFollows(client: Nostr, pubkey: string): Promise<Set<string>> {
  return new Promise((resolve) => {
    const follows = new Set<string>();
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
      event.tags.forEach((tag) => {
        if (tag[0] === "p" && tag[1]) {
          follows.add(tag[1]);
        }
      });
    };

    const onEOSE = () => {
      console.log(`EOSE received for ${pubkey}'s follows subscription.`);
      if (subId) {
        client.unsubscribe(subId);
      }
      resolve(follows);
    };

    subId = client.subscribe(filters, onEvent, onEOSE);

    // Timeout to prevent hanging indefinitely if EOSE is not received or relay is slow
    setTimeout(() => {
      if (subId) {
        console.warn(
          "Timeout reached for follows subscription. Unsubscribing.",
        );
        client.unsubscribe(subId);
      }
      resolve(follows); // Resolve with whatever was found
    }, 15000); // 15 seconds timeout
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
  const client = new Nostr(RELAYS);

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
    console.log(`\n--- ${USER_PUBKEY} follows (${userFollows.size}) ---`);
    userFollows.forEach((follow) => console.log(follow));

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
    console.log("Disconnected.");
  }
}

main().catch(console.error);
