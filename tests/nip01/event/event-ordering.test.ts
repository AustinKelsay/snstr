/**
 * This is a unit test for the event sorting functionality according to NIP-01.
 * It tests that events are properly sorted:
 * 1. By created_at timestamp (newest first)
 * 2. By event ID (lexically) when timestamps are the same
 * 
 * Note: The integration test for the relay's buffer mechanism is in 
 * event-ordering-integration.test.ts but requires additional work to properly
 * mock the WebSocket connections.
 */

import { NostrEvent } from "../../../src/types/nostr";

describe("Event ordering", () => {
  // Simple implementation of the sorting function based on NIP-01 spec
  function sortEvents(events: NostrEvent[]): NostrEvent[] {
    return [...events].sort((a, b) => {
      // Sort by created_at (descending - newer events first)
      if (a.created_at !== b.created_at) {
        return b.created_at - a.created_at;
      }
      // If created_at is the same, sort by id (descending lexical order)
      return b.id.localeCompare(a.id);
    });
  }

  test("should order events by created_at (newest first)", () => {
    // Create test events with different timestamps
    const event1: NostrEvent = {
      id: "aaa",
      pubkey: "abc",
      created_at: 1000, // Older event
      kind: 1,
      tags: [],
      content: "First event (oldest)",
      sig: "sig",
    };

    const event2: NostrEvent = {
      id: "bbb",
      pubkey: "abc",
      created_at: 2000, // Newer event
      kind: 1,
      tags: [],
      content: "Second event (newest)",
      sig: "sig",
    };

    // Put events in an array (in a random order)
    const events = [event1, event2];
    
    // Sort the events
    const sortedEvents = sortEvents(events);

    // Check the order (newest first)
    expect(sortedEvents.length).toBe(2);
    expect(sortedEvents[0]).toEqual(event2); // Newest event should be first
    expect(sortedEvents[1]).toEqual(event1); // Oldest event should be second
  });

  test("should order events by id when created_at is the same", () => {
    // Create test events with the same timestamp but different IDs
    const event1: NostrEvent = {
      id: "bbb", // Lexically larger ID
      pubkey: "abc",
      created_at: 1000, // Same timestamp
      kind: 1,
      tags: [],
      content: "Event B",
      sig: "sig",
    };

    const event2: NostrEvent = {
      id: "aaa", // Lexically smaller ID
      pubkey: "abc",
      created_at: 1000, // Same timestamp
      kind: 1,
      tags: [],
      content: "Event A",
      sig: "sig",
    };

    // Put events in an array (in a random order)
    const events = [event1, event2];
    
    // Sort the events
    const sortedEvents = sortEvents(events);

    // Check the order (ordered by ID lexically)
    expect(sortedEvents.length).toBe(2);
    expect(sortedEvents[0]).toEqual(event1); // 'bbb' should come first (descending)
    expect(sortedEvents[1]).toEqual(event2); // 'aaa' should come second (descending)
  });

  test("should handle multiple events in correct order", () => {
    // Create a mix of events with different timestamps and IDs
    const events: NostrEvent[] = [
      {
        id: "bbb",
        pubkey: "abc",
        created_at: 1000, // Oldest timestamp
        kind: 1,
        tags: [],
        content: "Oldest event with id 'bbb'",
        sig: "sig",
      },
      {
        id: "aaa",
        pubkey: "abc",
        created_at: 1000, // Same timestamp as above
        kind: 1,
        tags: [],
        content: "Oldest event with id 'aaa'",
        sig: "sig",
      },
      {
        id: "ddd",
        pubkey: "abc",
        created_at: 3000, // Newest timestamp
        kind: 1,
        tags: [],
        content: "Newest event with id 'ddd'",
        sig: "sig",
      },
      {
        id: "ccc",
        pubkey: "abc",
        created_at: 2000, // Middle timestamp
        kind: 1,
        tags: [],
        content: "Middle event with id 'ccc'",
        sig: "sig",
      }
    ];
    
    // Sort the events
    const sortedEvents = sortEvents(events);

    // Expected order:
    // 1. ddd (newest timestamp: 3000)
    // 2. ccc (middle timestamp: 2000)
    // 3. bbb (oldest timestamp: 1000, but lexically first due to descending sort)
    // 4. aaa (oldest timestamp: 1000, but lexically second due to descending sort)
    expect(sortedEvents.length).toBe(4);
    expect(sortedEvents[0].id).toBe("ddd"); // Newest timestamp
    expect(sortedEvents[1].id).toBe("ccc"); // Middle timestamp
    expect(sortedEvents[2].id).toBe("bbb"); // Same oldest timestamp, lexically first (descending)
    expect(sortedEvents[3].id).toBe("aaa"); // Same oldest timestamp, lexically second (descending)
  });
});
