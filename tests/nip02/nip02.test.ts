import { NostrEvent, NostrKind } from "../../src/types/nostr";
import { NostrRelay } from "../../src/utils/ephemeral-relay";
import {
  createSignedEvent,
  UnsignedEvent,
  validateEvent,
  NostrValidationError,
} from "../../src/nip01/event";
import { generateKeypair, verifySignature } from "../../src/utils/crypto";
import { Nostr } from "../../src/nip01/nostr";

const RELAY_PORT = 8088; // Using a different port for NIP-02 tests
const RELAY_URL = `ws://localhost:${RELAY_PORT}`;

describe("NIP-02: Contact Lists", () => {
  let relay: NostrRelay;
  let client: Nostr;

  let userAPrivKey: string;
  let userAPubKey: string;
  let userBPrivKey: string;
  let userBPubKey: string;
  let userCPubKey: string;
  let _userCPrivKey: string;

  beforeAll(async () => {
    relay = new NostrRelay(RELAY_PORT);
    await relay.start();
    client = new Nostr([RELAY_URL]);
    await client.connectToRelays();

    const keysA = await generateKeypair();
    userAPrivKey = keysA.privateKey;
    userAPubKey = keysA.publicKey;

    const keysB = await generateKeypair();
    userBPrivKey = keysB.privateKey;
    userBPubKey = keysB.publicKey;

    const keysC = await generateKeypair();
    _userCPrivKey = keysC.privateKey;
    userCPubKey = keysC.publicKey;
  });

  afterAll(async () => {
    if (client) {
      client.disconnectFromRelays();
    }
    if (relay) {
      await relay.close();
    }
  });

  describe("Kind 3 Event Creation", () => {
    it("should correctly create a kind 3 event for a contact list", async () => {
      const contactsTags = [
        ["p", userBPubKey, RELAY_URL, "UserB"],
        ["p", userCPubKey, "", "UserC"],
      ];
      const unsignedEvent: UnsignedEvent = {
        kind: NostrKind.Contacts,
        pubkey: userAPubKey,
        created_at: Math.floor(Date.now() / 1000),
        tags: contactsTags,
        content: "",
      };

      const signedEvent = await createSignedEvent(unsignedEvent, userAPrivKey);

      expect(signedEvent.kind).toBe(NostrKind.Contacts);
      expect(signedEvent.pubkey).toBe(userAPubKey);
      expect(signedEvent.tags).toEqual(contactsTags);
      expect(signedEvent.content).toBe("");
      expect(signedEvent.id).toBeDefined();
      expect(signedEvent.id.length).toBe(64);
      expect(signedEvent.sig).toBeDefined();
      expect(signedEvent.sig.length).toBe(128);

      const isValidSig = await verifySignature(
        signedEvent.id,
        signedEvent.sig,
        signedEvent.pubkey,
      );
      expect(isValidSig).toBe(true);
    });
  });

  describe("Kind 3 Event Validation", () => {
    it("should validate a correctly formed kind 3 event", async () => {
      const unsignedEvent: UnsignedEvent = {
        kind: NostrKind.Contacts,
        pubkey: userAPubKey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [["p", userBPubKey]],
        content: "",
      };
      const signedEvent = await createSignedEvent(unsignedEvent, userAPrivKey);
      await expect(validateEvent(signedEvent)).resolves.toBe(true);
    });

    it("should reject kind 3 event with no p tags when validateEvent is strict", async () => {
      const unsignedEvent: UnsignedEvent = {
        kind: NostrKind.Contacts,
        pubkey: userAPubKey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [], // No 'p' tags
        content: "",
      };
      const signedEvent = await createSignedEvent(unsignedEvent, userAPrivKey);
      // NIP-02 states "tags MUST contain a 'p' tag for each followed profile, referring to the followed pubkey"
      // The validateEvent function from nip01/event.ts has specific logic for kind 3.
      await expect(validateEvent(signedEvent)).rejects.toThrow(
        NostrValidationError,
      );
      await expect(validateEvent(signedEvent)).rejects.toThrow(
        "Contact list event should have at least one p tag",
      );
    });

    it("should accept kind 3 event with minimal valid p tag", async () => {
      const unsignedEvent: UnsignedEvent = {
        kind: NostrKind.Contacts,
        pubkey: userAPubKey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [["p", userBPubKey]],
        content: "",
      };
      const signedEvent = await createSignedEvent(unsignedEvent, userAPrivKey);
      await expect(validateEvent(signedEvent)).resolves.toBe(true);
    });
  });

  describe("Relay-dependent NIP-02 features", () => {
    // Helper function to publish an event and wait for OK from at least one relay
    const publishEventAndWait = async (event: NostrEvent) => {
      return new Promise<void>((resolve, reject) => {
        (async () => {
          // IIFE for async operations
          try {
            const response = await client.publishEvent(event, {
              timeout: 2000,
            });

            if (response.success) {
              resolve();
            } else {
              let detailedError = "Publish failed on all relays.";
              if (response.relayResults && response.relayResults.size > 0) {
                const errors = [];
                for (const [url, res] of response.relayResults.entries()) {
                  if (!res.success) {
                    errors.push(
                      `Relay ${url}: ${res.reason || "Unknown error"}`,
                    );
                  }
                }
                if (errors.length > 0) {
                  detailedError = `Publish failed: ${errors.join("; ")}`;
                }
              }
              reject(new Error(detailedError));
            }
          } catch (e) {
            reject(e);
          }
        })();
      });
    };

    it("Fetching Follows: should fetch the list of pubkeys a user follows", async () => {
      const followedPubkeys = [userBPubKey, userCPubKey];
      const contactListEvent = await createSignedEvent(
        {
          kind: NostrKind.Contacts,
          pubkey: userAPubKey,
          created_at: Math.floor(Date.now() / 1000),
          tags: followedPubkeys.map((pk) => [
            "p",
            pk,
            RELAY_URL,
            `User_${pk.substring(0, 3)}`,
          ]),
          content: "",
        },
        userAPrivKey,
      );

      await publishEventAndWait(contactListEvent);

      const fetchedFollows = new Set<string>();
      const subIds = client.subscribe(
        [{ kinds: [NostrKind.Contacts], authors: [userAPubKey], limit: 1 }],
        (event) => {
          event.tags.forEach((tag) => {
            if (tag[0] === "p" && tag[1]) {
              fetchedFollows.add(tag[1]);
            }
          });
        },
        () => {
          // onEOSE
          client.unsubscribe(subIds);
        },
      );

      // Wait for EOSE or timeout
      await new Promise<void>((resolve) => {
        const onEoseSub = client.subscribe(
          [{ kinds: [NostrKind.Contacts], authors: [userAPubKey], limit: 1 }],
          () => {},
          () => {
            client.unsubscribe(onEoseSub);
            resolve();
          },
        );
        setTimeout(() => {
          client.unsubscribe(onEoseSub);
          resolve();
        }, 3000); // Timeout
      });

      expect(fetchedFollows.has(userBPubKey)).toBe(true);
      expect(fetchedFollows.has(userCPubKey)).toBe(true);
      expect(fetchedFollows.size).toBe(followedPubkeys.length);
    });

    it("Finding Followers: should identify which users follow a given pubkey", async () => {
      const targetUserPubKey = userCPubKey;
      const followerAEvent = await createSignedEvent(
        {
          kind: NostrKind.Contacts,
          pubkey: userAPubKey, // User A follows Target
          created_at: Math.floor(Date.now() / 1000),
          tags: [["p", targetUserPubKey]],
          content: "",
        },
        userAPrivKey,
      );

      const followerBEvent = await createSignedEvent(
        {
          kind: NostrKind.Contacts,
          pubkey: userBPubKey, // User B follows Target
          created_at: Math.floor(Date.now() / 1000) + 1, // ensure different event, slightly newer
          tags: [["p", targetUserPubKey]],
          content: "",
        },
        userBPrivKey,
      );

      await publishEventAndWait(followerAEvent);
      await publishEventAndWait(followerBEvent);

      const foundFollowers = new Set<string>();
      const subIds = client.subscribe(
        [{ kinds: [NostrKind.Contacts], "#p": [targetUserPubKey] }],
        (event) => {
          foundFollowers.add(event.pubkey);
        },
        () => {
          // onEOSE
          client.unsubscribe(subIds);
        },
      );

      // Wait for EOSE or timeout
      await new Promise<void>((resolve) => {
        const onEoseSub = client.subscribe(
          [{ kinds: [NostrKind.Contacts], "#p": [targetUserPubKey] }],
          () => {},
          () => {
            client.unsubscribe(onEoseSub);
            resolve();
          },
        );
        setTimeout(() => {
          client.unsubscribe(onEoseSub);
          resolve();
        }, 3000); // Timeout
      });

      expect(foundFollowers.has(userAPubKey)).toBe(true);
      expect(foundFollowers.has(userBPubKey)).toBe(true);
      expect(foundFollowers.size).toBe(2);
    });

    it("Replaceable Event Handling: should consider only the latest kind 3 event", async () => {
      const time1 = Math.floor(Date.now() / 1000) - 100;
      const time2 = Math.floor(Date.now() / 1000);

      const oldFollowsEvent = await createSignedEvent(
        {
          kind: NostrKind.Contacts,
          pubkey: userAPubKey,
          created_at: time1,
          tags: [["p", userBPubKey]],
          content: "",
        },
        userAPrivKey,
      );

      const newFollowsEvent = await createSignedEvent(
        {
          kind: NostrKind.Contacts,
          pubkey: userAPubKey,
          created_at: time2,
          tags: [["p", userCPubKey]], // User A now follows User C
          content: "",
        },
        userAPrivKey,
      );

      await publishEventAndWait(oldFollowsEvent);
      await publishEventAndWait(newFollowsEvent);

      const latestFollows = new Set<string>();
      const subIds = client.subscribe(
        [{ kinds: [NostrKind.Contacts], authors: [userAPubKey], limit: 1 }],
        (event) => {
          latestFollows.clear(); // Ensure only the latest event's tags are considered
          event.tags.forEach((tag) => {
            if (tag[0] === "p" && tag[1]) {
              latestFollows.add(tag[1]);
            }
          });
        },
        () => {
          // onEOSE
          client.unsubscribe(subIds);
        },
      );

      // Wait for EOSE or timeout
      await new Promise<void>((resolve) => {
        const onEoseSub = client.subscribe(
          [{ kinds: [NostrKind.Contacts], authors: [userAPubKey], limit: 1 }],
          () => {},
          () => {
            client.unsubscribe(onEoseSub);
            resolve();
          },
        );
        setTimeout(() => {
          client.unsubscribe(onEoseSub);
          resolve();
        }, 3000); // Timeout
      });

      expect(latestFollows.has(userCPubKey)).toBe(true);
      expect(latestFollows.has(userBPubKey)).toBe(false);
      expect(latestFollows.size).toBe(1);
    });
  });
});
