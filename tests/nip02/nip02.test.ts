import { NostrEvent, NostrKind, ContactsEvent } from "../../src/types/nostr";
import { NostrRelay } from "../../src/utils/ephemeral-relay";
import {
  createSignedEvent,
  UnsignedEvent,
  validateEvent,
  NostrValidationError,
} from "../../src/nip01/event";
import { generateKeypair, verifySignature } from "../../src/utils/crypto";
import { Nostr } from "../../src/nip01/nostr";
import {
  createContactListEvent,
  parseContactsFromEvent,
  Contact,
} from "../../src/nip02";

const RELAY_PORT = 8088; // Using a different port for NIP-02 tests
const RELAY_URL = `ws://localhost:${RELAY_PORT}`;

describe("NIP-02: Contact Lists", () => {
  let relay: NostrRelay;
  let client: Nostr;

  let userAPrivKey: string;
  let userAPubKey: string;
  let userBPubKey: string;
  let userCPubKey: string;
  let _userCPrivKey: string;

  const contactB: Contact = { pubkey: "" };
  const contactC: Contact = { pubkey: "" };
  const contactBWithDetails: Contact = {
    pubkey: "",
    relayUrl: RELAY_URL,
    petname: "UserB_Pet",
  };
  const contactCWithDetails: Contact = {
    pubkey: "",
    relayUrl: RELAY_URL,
    petname: "UserC_Pet",
  };

  beforeAll(async () => {
    relay = new NostrRelay(RELAY_PORT);
    await relay.start();
    client = new Nostr([RELAY_URL]);
    await client.connectToRelays();

    const keysA = await generateKeypair();
    userAPrivKey = keysA.privateKey;
    userAPubKey = keysA.publicKey;

    const keysB = await generateKeypair();
    userBPubKey = keysB.publicKey;
    contactB.pubkey = userBPubKey;
    contactBWithDetails.pubkey = userBPubKey;

    const keysC = await generateKeypair();
    _userCPrivKey = keysC.privateKey;
    userCPubKey = keysC.publicKey;
    contactC.pubkey = userCPubKey;
    contactCWithDetails.pubkey = userCPubKey;
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
    it("should correctly create a kind 3 event with basic contacts (pubkey only)", async () => {
      const contactsToFollow: Contact[] = [contactB, contactC];
      const unsignedEventTemplate = createContactListEvent(
        contactsToFollow,
        "",
      );

      const unsignedEvent: UnsignedEvent = {
        ...unsignedEventTemplate,
        pubkey: userAPubKey,
      };

      const signedEvent = await createSignedEvent(unsignedEvent, userAPrivKey);

      expect(signedEvent.kind).toBe(NostrKind.Contacts);
      expect(signedEvent.pubkey).toBe(userAPubKey);
      contactsToFollow.forEach((contact) => {
        expect(signedEvent.tags).toEqual(
          expect.arrayContaining([
            expect.arrayContaining(["p", contact.pubkey]),
          ]),
        );
        const tag = signedEvent.tags.find(
          (t) => t[0] === "p" && t[1] === contact.pubkey,
        );
        expect(tag).toBeDefined();
        expect(tag?.length).toBe(2);
      });
      expect(signedEvent.tags.filter((t) => t[0] === "p").length).toBe(
        contactsToFollow.length,
      );
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

    it("should correctly create a kind 3 event with contacts including relay and petname", async () => {
      const contactsToFollow: Contact[] = [
        contactBWithDetails,
        { pubkey: contactC.pubkey, petname: "PetC" },
      ];
      const unsignedEventTemplate = createContactListEvent(
        contactsToFollow,
        "Content here",
      );

      const unsignedEvent: UnsignedEvent = {
        ...unsignedEventTemplate,
        pubkey: userAPubKey,
      };
      const signedEvent = await createSignedEvent(unsignedEvent, userAPrivKey);

      expect(signedEvent.kind).toBe(NostrKind.Contacts);
      expect(signedEvent.pubkey).toBe(userAPubKey);
      expect(signedEvent.content).toBe("Content here");

      const tagB = signedEvent.tags.find(
        (t) => t[0] === "p" && t[1] === contactBWithDetails.pubkey,
      );
      expect(tagB).toEqual([
        "p",
        contactBWithDetails.pubkey,
        contactBWithDetails.relayUrl,
        contactBWithDetails.petname,
      ]);

      const tagC = signedEvent.tags.find(
        (t) => t[0] === "p" && t[1] === contactC.pubkey,
      );
      expect(tagC).toEqual(["p", contactC.pubkey, "", "PetC"]);

      expect(signedEvent.tags.filter((t) => t[0] === "p").length).toBe(
        contactsToFollow.length,
      );
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

    it("should correctly create a kind 3 event with contact including only relay", async () => {
      const contactWithOnlyRelay: Contact = {
        pubkey: userBPubKey,
        relayUrl: RELAY_URL,
      };
      const contactsToFollow: Contact[] = [contactWithOnlyRelay];
      const unsignedEventTemplate = createContactListEvent(contactsToFollow);
      const unsignedEvent: UnsignedEvent = {
        ...unsignedEventTemplate,
        pubkey: userAPubKey,
      };
      const signedEvent = await createSignedEvent(unsignedEvent, userAPrivKey);

      const tagB = signedEvent.tags.find(
        (t) => t[0] === "p" && t[1] === userBPubKey,
      );
      expect(tagB).toEqual(["p", userBPubKey, RELAY_URL]);
    });

    it("should validate a correctly formed kind 3 event (created with new Contact structure)", async () => {
      const unsignedEventTemplate = createContactListEvent([contactB]);
      const unsignedEvent: UnsignedEvent = {
        ...unsignedEventTemplate,
        pubkey: userAPubKey,
      };
      const signedEvent = await createSignedEvent(unsignedEvent, userAPrivKey);
      await expect(validateEvent(signedEvent)).resolves.toBe(true);
    });

    it("should reject kind 3 event with no p tags when validateEvent is strict (using empty Contact array)", async () => {
      const unsignedEventTemplate = createContactListEvent([]);
      const unsignedEvent: UnsignedEvent = {
        ...unsignedEventTemplate,
        pubkey: userAPubKey,
        created_at: Math.floor(Date.now() / 1000),
      };
      const signedEvent = await createSignedEvent(unsignedEvent, userAPrivKey);
      await expect(validateEvent(signedEvent)).rejects.toThrow(
        NostrValidationError,
      );
      await expect(validateEvent(signedEvent)).rejects.toThrow(
        "Contact list event should have at least one p tag",
      );
    });

    it("should accept kind 3 event with minimal valid p tag (using Contact array)", async () => {
      const unsignedEventTemplate = createContactListEvent([contactB]);
      const unsignedEvent: UnsignedEvent = {
        ...unsignedEventTemplate,
        pubkey: userAPubKey,
      };
      const signedEvent = await createSignedEvent(unsignedEvent, userAPrivKey);
      await expect(validateEvent(signedEvent)).resolves.toBe(true);
    });
  });

  describe("parseContactsFromEvent Validation", () => {
    const baseEvent: Omit<ContactsEvent, "tags" | "content"> = {
      kind: NostrKind.Contacts,
      pubkey: userAPubKey, // Or any valid pubkey
      created_at: Math.floor(Date.now() / 1000),
      id: "testeventid", // Mock ID, not validated by parseContactsFromEvent
      sig: "testeventsig", // Mock Sig, not validated by parseContactsFromEvent
    };

    it("should return an empty array for an event with no p tags", () => {
      const event: ContactsEvent = {
        ...baseEvent,
        tags: [["e", "someid"]],
        content: "",
      };
      const contacts = parseContactsFromEvent(event);
      expect(contacts).toEqual([]);
    });

    it("should ignore p tags with invalidly formatted pubkeys", () => {
      const validPk = userBPubKey;
      const event: ContactsEvent = {
        ...baseEvent,
        tags: [
          ["p", "short"], // Invalid: too short
          ["p", "123456789012345678901234567890123456789012345678901234567890abcdX"], // Invalid: non-hex character
          ["p", validPk, "ws://relay.com", "Valid Contact"], // Valid
          ["p", "toolong123456789012345678901234567890123456789012345678901234567890abcde"], // Invalid: too long
        ],
        content: "",
      };
      const contacts = parseContactsFromEvent(event);
      expect(contacts.length).toBe(1);
      expect(contacts[0]?.pubkey).toBe(validPk);
      expect(contacts[0]?.petname).toBe("Valid Contact");
    });

    it("should correctly parse valid pubkeys and handle various relay URL and petname combinations", () => {
      const event: ContactsEvent = {
        ...baseEvent,
        tags: [
          ["p", userBPubKey], // Pubkey only
          ["p", userCPubKey, "ws://valid.relay.com"], // Pubkey and valid relay
          ["p", userAPubKey, "wss://another.valid.relay.com", "PetA"], // Pubkey, valid relay, petname
          ["p", "0000000000000000000000000000000000000000000000000000000000000001", "", "PetB"], // Pubkey, empty relay, petname
        ],
        content: "",
      };
      const contacts = parseContactsFromEvent(event);
      expect(contacts.length).toBe(4);
      expect(contacts.find(c => c.pubkey === userBPubKey)?.relayUrl).toBeUndefined();
      expect(contacts.find(c => c.pubkey === userBPubKey)?.petname).toBeUndefined();

      expect(contacts.find(c => c.pubkey === userCPubKey)?.relayUrl).toBe("ws://valid.relay.com");
      expect(contacts.find(c => c.pubkey === userCPubKey)?.petname).toBeUndefined();
      
      expect(contacts.find(c => c.pubkey === userAPubKey)?.relayUrl).toBe("wss://another.valid.relay.com");
      expect(contacts.find(c => c.pubkey === userAPubKey)?.petname).toBe("PetA");

      expect(contacts.find(c => c.pubkey === "0000000000000000000000000000000000000000000000000000000000000001")?.relayUrl).toBeUndefined();
      expect(contacts.find(c => c.pubkey === "0000000000000000000000000000000000000000000000000000000000000001")?.petname).toBe("PetB");
    });

    it("should set relayUrl to undefined for invalidly formatted relay URLs", () => {
      const pk1 = userBPubKey; 
      const pk2 = userCPubKey;
      const event: ContactsEvent = {
        ...baseEvent,
        tags: [
          ["p", pk1, "http://invalid.com", "UserWithHttpRelay"], // Invalid scheme
          ["p", pk2, "ftp://another.invalid.com"], // Invalid scheme
          ["p", userAPubKey, "justarandomstring", "UserWithRandomRelay"], // Invalid format
          ["p", "0000000000000000000000000000000000000000000000000000000000000002", "ws://valid.but.different.com"], // Valid for comparison
        ],
        content: "",
      };
      const contacts = parseContactsFromEvent(event);
      expect(contacts.length).toBe(4); 
      
      const contact1 = contacts.find(c => c.pubkey === pk1);
      expect(contact1).toBeDefined();
      expect(contact1?.relayUrl).toBeUndefined();
      expect(contact1?.petname).toBe("UserWithHttpRelay");

      const contact2 = contacts.find(c => c.pubkey === pk2);
      expect(contact2).toBeDefined();
      expect(contact2?.relayUrl).toBeUndefined();
      expect(contact2?.petname).toBeUndefined(); 

      const contact3 = contacts.find(c => c.pubkey === userAPubKey);
      expect(contact3).toBeDefined();
      expect(contact3?.relayUrl).toBeUndefined();
      expect(contact3?.petname).toBe("UserWithRandomRelay");

      const contact4 = contacts.find(c => c.pubkey === "0000000000000000000000000000000000000000000000000000000000000002");
      expect(contact4).toBeDefined();
      expect(contact4?.relayUrl).toBe("ws://valid.but.different.com");
    });

    it("should still parse petnames even if relayUrl is invalid or absent", () => {
      const event: ContactsEvent = {
          ...baseEvent,
          tags: [
              ["p", userBPubKey, "invalid-relay-url", "PetB"],
              ["p", userCPubKey, null as any, "PetC"], 
              ["p", userAPubKey, undefined as any, "PetA"], 
              ["p", "0000000000000000000000000000000000000000000000000000000000000003", "", "PetD"], // Corrected: Empty string for relay, "PetD" is petname
          ],
          content: "",
      };
      const contacts = parseContactsFromEvent(event);
      expect(contacts.length).toBe(4);
      expect(contacts.find(c => c.pubkey === userBPubKey)?.petname).toBe("PetB");
      expect(contacts.find(c => c.pubkey === userBPubKey)?.relayUrl).toBeUndefined();

      expect(contacts.find(c => c.pubkey === userCPubKey)?.petname).toBe("PetC");
      expect(contacts.find(c => c.pubkey === userCPubKey)?.relayUrl).toBeUndefined();
      
      expect(contacts.find(c => c.pubkey === userAPubKey)?.petname).toBe("PetA");
      expect(contacts.find(c => c.pubkey === userAPubKey)?.relayUrl).toBeUndefined();

      expect(contacts.find(c => c.pubkey === "0000000000000000000000000000000000000000000000000000000000000003")?.petname).toBe("PetD");
      expect(contacts.find(c => c.pubkey === "0000000000000000000000000000000000000000000000000000000000000003")?.relayUrl).toBeUndefined();
    });

    it("should correctly parse a kind 3 event with tags of varying lengths", () => {
      const pk1 = "1111111111111111111111111111111111111111111111111111111111111111";
      const pk2 = "2222222222222222222222222222222222222222222222222222222222222222";
      const pk3 = "3333333333333333333333333333333333333333333333333333333333333333";
      const pk4 = "4444444444444444444444444444444444444444444444444444444444444444";

      const event: ContactsEvent = {
          ...baseEvent,
          tags: [
              ["p", pk1], 
              ["p", pk2, "ws://relay.one"], 
              ["p", pk3, "", "PetForPk3"], 
              ["p", pk4, "ws://relay.four", "PetForPk4"], 
              ["p", "5555555555555555555555555555555555555555555555555555555555555555", "http://invalid.relay", "PetForPk5"],
              ["p", "6666666666666666666666666666666666666666666666666666666666666666", "PetForPk6"], 
          ],
          content: "",
      };
      const contacts = parseContactsFromEvent(event);

      expect(contacts.find(c => c.pubkey === pk1)?.relayUrl).toBeUndefined();
      expect(contacts.find(c => c.pubkey === pk1)?.petname).toBeUndefined();

      expect(contacts.find(c => c.pubkey === pk2)?.relayUrl).toBe("ws://relay.one");
      expect(contacts.find(c => c.pubkey === pk2)?.petname).toBeUndefined();

      expect(contacts.find(c => c.pubkey === pk3)?.relayUrl).toBeUndefined(); 
      expect(contacts.find(c => c.pubkey === pk3)?.petname).toBe("PetForPk3");

      expect(contacts.find(c => c.pubkey === pk4)?.relayUrl).toBe("ws://relay.four");
      expect(contacts.find(c => c.pubkey === pk4)?.petname).toBe("PetForPk4");

      const contact5 = contacts.find(c => c.pubkey === "5555555555555555555555555555555555555555555555555555555555555555");
      expect(contact5?.relayUrl).toBeUndefined(); 
      expect(contact5?.petname).toBe("PetForPk5");

      const contact6 = contacts.find(c => c.pubkey === "6666666666666666666666666666666666666666666666666666666666666666");
      expect(contact6?.relayUrl).toBeUndefined();
      expect(contact6?.petname).toBeUndefined(); 

      expect(contacts.length).toBe(6);
    });
  });

  describe("Relay-dependent NIP-02 features", () => {
    const publishEventAndWait = async (event: NostrEvent) => {
      return new Promise<void>((resolve, reject) => {
        (async () => {
          try {
            const response = await client.publishEvent(event, {
              timeout: 2000,
            });
            if (response.success) {
              resolve();
            } else {
              let detailedError = "Publish failed on all relays.";
              if (response.relayResults && response.relayResults.size > 0) {
                const errors: string[] = [];
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

    it("Fetching Follows: should fetch and parse contacts (pubkey, relay, petname)", async () => {
      const contactsToPublish: Contact[] = [
        {
          pubkey: userBPubKey,
          relayUrl: RELAY_URL,
          petname: "UserB_Pet_Relay",
        },
        { pubkey: userCPubKey, petname: "UserC_Pet_NoRelay" },
        {
          pubkey: await (await generateKeypair()).publicKey,
          relayUrl: "wss://another.relay.com",
        }, // Contact with only relay
        { pubkey: await (await generateKeypair()).publicKey }, // Contact with only pubkey
        { // New contact with invalid relay URL
          pubkey: (await generateKeypair()).publicKey, // Use a fresh key for this user
          relayUrl: "http://invalid.url.com", // Invalid relay URL format
          petname: "InvalidRelayUser",
        },
      ];

      const unsignedTemplate = createContactListEvent(
        contactsToPublish,
        "Contacts for fetch test",
      );

      const contactListUnsigned: UnsignedEvent = {
        ...unsignedTemplate,
        pubkey: userAPubKey,
      };

      const contactListEvent = (await createSignedEvent(
        contactListUnsigned,
        userAPrivKey,
      )) as ContactsEvent; // Assert as ContactsEvent for type safety

      await publishEventAndWait(contactListEvent);

      const fetchedContacts: Contact[] = [];
      let eventReceived: ContactsEvent | null = null;

      const subIds = client.subscribe(
        [{ kinds: [NostrKind.Contacts], authors: [userAPubKey], limit: 1 }],
        (event) => {
          eventReceived = event as ContactsEvent;
          // Use the new parseContactsFromEvent function
          const parsed = parseContactsFromEvent(eventReceived);
          fetchedContacts.push(...parsed);
        },
        () => {
          // onEOSE
          client.unsubscribe(subIds);
        },
      );

      // Wait for EOSE or timeout to ensure event is processed
      await new Promise<void>((resolve) => {
        let eoseReceived = false;
        const eoseSub = client.subscribe(
          [{ kinds: [NostrKind.Contacts], authors: [userAPubKey], limit: 1 }],
          () => {}, // Event callback, not strictly needed here as main processing is above
          () => {
            // onEOSE
            eoseReceived = true;
            client.unsubscribe(eoseSub);
            resolve();
          },
        );
        setTimeout(() => {
          if (!eoseReceived) {
            client.unsubscribe(eoseSub);
            resolve(); // Resolve on timeout to prevent test hanging
          }
        }, 3000);
      });

      expect(eventReceived).not.toBeNull();
      expect(fetchedContacts.length).toBe(contactsToPublish.length);

      contactsToPublish.forEach((publishedContact) => {
        const foundContact = fetchedContacts.find(
          (fc) => fc.pubkey === publishedContact.pubkey,
        );
        expect(foundContact).toBeDefined();
        expect(foundContact?.petname).toBe(publishedContact.petname); 
        // Check for our specific invalid case for relayUrl
        if (publishedContact.relayUrl && publishedContact.relayUrl.startsWith("http://")) { 
          expect(foundContact?.relayUrl).toBeUndefined(); 
        } else {
          expect(foundContact?.relayUrl).toBe(publishedContact.relayUrl); 
        }
      });
    });

    it("Finding Followers: should identify which users follow a given pubkey", async () => {
      const targetUserPubKey = userCPubKey;

      // User A will follow targetUserPubKey
      const userAFollowsTargetTemplate = createContactListEvent(
        [{ pubkey: targetUserPubKey }],
        "User A follows Target",
      );
      const followerAEvent = await createSignedEvent(
        {
          ...userAFollowsTargetTemplate, // kind, tags, content, created_at are from here
          pubkey: userAPubKey,
        },
        userAPrivKey,
      );

      // User B will follow targetUserPubKey
      // Assuming userB signs with their own key if distinct. For this test, using _userCPrivKey for userB.
      // If userB is just another contact entry from userA, this test needs rethinking.
      // The original test had userBPubKey sign with userAPrivKey which is confusing.
      // Let's assume User B is a distinct user who creates their own contact list.
      const userBPrivKey = await generateKeypair(); // Generate a dedicated key for User B for this test
      const userBActualPubKey = userBPrivKey.publicKey; // This is the actual pubkey for User B

      const userBFollowsTargetTemplate = createContactListEvent(
        [{ pubkey: targetUserPubKey }],
        "User B follows Target",
      );
      const followerBEvent = await createSignedEvent(
        {
          ...userBFollowsTargetTemplate,
          pubkey: userBActualPubKey, // User B (distinct) signs with their own pubkey
        },
        userBPrivKey.privateKey, // User B signs with their own private key
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
          client.unsubscribe(subIds);
        },
      );

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
        }, 3000);
      });

      expect(foundFollowers.has(userAPubKey)).toBe(true);
      expect(foundFollowers.has(userBActualPubKey)).toBe(true); // Check for the actual User B pubkey
      expect(foundFollowers.size).toBe(2);
    });

    it("Replaceable Event Handling: should consider only the latest kind 3 event", async () => {
      const time1 = Math.floor(Date.now() / 1000) - 1000;
      const time2 = Math.floor(Date.now() / 1000) + 1000;

      const oldFollowsTemplate = createContactListEvent(
        [{ pubkey: userBPubKey }],
        "Old follows list for replaceable test",
      );
      const oldFollowsEvent = await createSignedEvent(
        {
          ...oldFollowsTemplate,
          pubkey: userAPubKey,
          created_at: time1,
        },
        userAPrivKey,
      );

      const newFollowsTemplate = createContactListEvent(
        [{ pubkey: userCPubKey }],
        "New follows list for replaceable test",
      );
      const newFollowsEvent = await createSignedEvent(
        {
          ...newFollowsTemplate,
          pubkey: userAPubKey,
          created_at: time2,
        },
        userAPrivKey,
      );

      await publishEventAndWait(oldFollowsEvent);
      await publishEventAndWait(newFollowsEvent);

      const latestFollowsContacts: Contact[] = [];
      let latestEventReceivedFromCallback: ContactsEvent | null = null;
      let eventCallbackCount = 0;

      const subIds = client.subscribe(
        [{ kinds: [NostrKind.Contacts], authors: [userAPubKey], limit: 1 }],
        (event) => {
          eventCallbackCount++;
          latestEventReceivedFromCallback = event as ContactsEvent;
          // Assuming latestEventReceivedFromCallback is not null here based on subscription behavior
          const parsed = parseContactsFromEvent(
            latestEventReceivedFromCallback!,
          );
          latestFollowsContacts.length = 0;
          latestFollowsContacts.push(...parsed);
        },
        () => {
          client.unsubscribe(subIds);
        },
      );

      await new Promise<void>((resolve) => {
        const onEoseSub = client.subscribe(
          [
            {
              kinds: [NostrKind.Contacts],
              authors: [userAPubKey],
              limit: 1,
              until: time2 + 10,
            },
          ],
          () => {},
          () => {
            client.unsubscribe(onEoseSub);
            resolve();
          },
        );
        setTimeout(() => {
          client.unsubscribe(onEoseSub);
          resolve();
        }, 4000);
      });

      expect(latestEventReceivedFromCallback).not.toBeNull();

      if (latestEventReceivedFromCallback) {
        // Cast to NostrEvent to safely access common event properties
        const receivedEvent = latestEventReceivedFromCallback as NostrEvent;
        expect(receivedEvent.created_at).toBe(time2);
        expect(receivedEvent.tags.filter((t) => t[0] === "p").length).toBe(1);
      } else {
        fail(
          "latestEventReceivedFromCallback was null after a non-null assertion.",
        );
      }

      expect(latestFollowsContacts.length).toBe(1);
      if (latestFollowsContacts.length === 1) {
        expect(latestFollowsContacts[0]?.pubkey).toBe(userCPubKey);
      }
      expect(
        latestFollowsContacts.find((c) => c.pubkey === userBPubKey),
      ).toBeUndefined();
      expect(eventCallbackCount).toBe(1);
    });

    // This test was originally named "Fetching Followers" again, renaming for clarity
    it("Advanced Fetching Followers: should correctly identify followers using createContactListEvent", async () => {
      const baseTime = Math.floor(Date.now() / 1000);
      // Ensure this timestamp is later than any from previous tests for userAPubKey (e.g. Replaceable Event test uses baseTime + 1000)
      const userA_createdAt = baseTime + 2000;
      const userC_createdAt = baseTime; // User C can use an earlier or unrelated timestamp

      // User A follows User B
      const userAFollowsBTemplate = createContactListEvent(
        [{ pubkey: contactB.pubkey }],
        "User A follows User B in Advanced Test",
      );
      const userAFollowsBEvent = await createSignedEvent(
        {
          ...userAFollowsBTemplate,
          pubkey: userAPubKey,
          created_at: userA_createdAt, // Use a very late timestamp for User A's event in this test
        },
        userAPrivKey,
      );
      await publishEventAndWait(userAFollowsBEvent);

      // User C follows User B
      const userCFollowsBTemplate = createContactListEvent(
        [{ pubkey: contactB.pubkey }],
        "User C follows User B in Advanced Test",
      );
      const userCFollowsBEvent = await createSignedEvent(
        {
          ...userCFollowsBTemplate,
          pubkey: userCPubKey,
          created_at: userC_createdAt,
        },
        _userCPrivKey,
      );
      await publishEventAndWait(userCFollowsBEvent);

      const followersOfB = new Set<string>();
      const querySinceTime = userC_createdAt - 60;

      const subIdsFollowers = client.subscribe(
        [
          {
            kinds: [NostrKind.Contacts],
            "#p": [contactB.pubkey],
            since: querySinceTime,
          },
        ],
        (event) => {
          followersOfB.add(event.pubkey);
        },
        () => {
          client.unsubscribe(subIdsFollowers);
        },
      );

      await new Promise<void>((resolve) => {
        const onEoseSub = client.subscribe(
          [
            {
              kinds: [NostrKind.Contacts],
              "#p": [contactB.pubkey],
              since: querySinceTime,
            },
          ],
          () => {},
          () => {
            client.unsubscribe(onEoseSub);
            resolve();
          },
        );
        setTimeout(() => {
          client.unsubscribe(onEoseSub);
          resolve();
        }, 5000);
      });

      expect(followersOfB.has(userAPubKey)).toBe(true);
      expect(followersOfB.has(userCPubKey)).toBe(true);
      expect(followersOfB.size).toBe(2);
    });
  });
});
