import type {
  NostrClientMessage,
  NostrEvent,
  NostrMessage,
  NostrRelayMessage,
} from "../../src";

const event = {
  id: "0".repeat(64),
  pubkey: "1".repeat(64),
  created_at: 1,
  kind: 1,
  tags: [],
  content: "test",
  sig: "2".repeat(128),
} satisfies NostrEvent;

const clientMessages = [
  ["EVENT", event],
  ["REQ", "subscription", { kinds: [1] }],
  ["CLOSE", "subscription"],
  ["AUTH", event],
] satisfies NostrClientMessage[];

const relayMessages = [
  ["EVENT", "subscription", event],
  ["OK", event.id, true, ""],
  ["EOSE", "subscription"],
  ["CLOSED", "subscription", "error: unavailable"],
  ["NOTICE", "maintenance"],
  ["AUTH", "challenge"],
] satisfies NostrRelayMessage[];

// These assertions make directionality part of the compile-time contract.
// @ts-expect-error Relay EVENT messages require a subscription identifier.
const invalidRelayEvent: NostrRelayMessage = ["EVENT", event];
// @ts-expect-error Client AUTH messages carry an event rather than a challenge.
const invalidClientAuth: NostrClientMessage = ["AUTH", "challenge"];

describe("canonical NIP-01 protocol message types", () => {
  it("covers every supported client and relay wire tuple", () => {
    const messages: NostrMessage[] = [...clientMessages, ...relayMessages];

    expect(messages.map(([verb]) => verb)).toEqual([
      "EVENT",
      "REQ",
      "CLOSE",
      "AUTH",
      "EVENT",
      "OK",
      "EOSE",
      "CLOSED",
      "NOTICE",
      "AUTH",
    ]);
  });

  it("preserves JSON tuple serialization", () => {
    expect(JSON.parse(JSON.stringify(clientMessages[1]))).toEqual([
      "REQ",
      "subscription",
      { kinds: [1] },
    ]);
    expect(JSON.parse(JSON.stringify(relayMessages[1]))).toEqual([
      "OK",
      event.id,
      true,
      "",
    ]);
  });
});

void invalidRelayEvent;
void invalidClientAuth;
