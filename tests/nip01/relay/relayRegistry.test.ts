import { Relay } from "../../../src/nip01/relay";
import { RelayRegistry } from "../../../src/nip01/relayRegistry";

describe("RelayRegistry", () => {
  test("canonicalizes Map-compatible access and owns replacement lifecycle", () => {
    const registry = new RelayRegistry();
    const first = new Relay("wss://relay.example/path");
    const second = new Relay("wss://relay.example/path");
    const firstDisconnect = jest.spyOn(first, "disconnect");
    const secondDisconnect = jest.spyOn(second, "disconnect");

    registry.set("wss://RELAY.EXAMPLE/path", first);
    expect(registry.get("relay.example/path")).toBe(first);
    expect(registry.has("wss://relay.example/path")).toBe(true);

    registry.set("wss://relay.example/path", second);
    expect(firstDisconnect).toHaveBeenCalledTimes(1);
    expect(registry.delete("RELAY.EXAMPLE/path")).toBe(true);
    expect(secondDisconnect).toHaveBeenCalledTimes(1);
    expect(registry.size).toBe(0);
  });

  test("keeps invalid lookup and deletion graceful", () => {
    const registry = new RelayRegistry();

    expect(registry.get("https://invalid.example")).toBeUndefined();
    expect(registry.has("https://invalid.example")).toBe(false);
    expect(registry.delete("https://invalid.example")).toBe(false);
  });
});
