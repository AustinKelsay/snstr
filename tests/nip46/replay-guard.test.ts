import { NIP46ReplayGuard } from "../../src/nip46/internal/replay-guard";

describe("NIP-46 replay guard", () => {
  test("rejects duplicate IDs inside the two-minute window", () => {
    let now = 1_000;
    const guard = new NIP46ReplayGuard({ now: () => now });

    expect(guard.isReplay("request")).toBe(false);
    now += 60_000;
    expect(guard.isReplay("request")).toBe(true);
    expect(guard.size).toBe(1);
  });

  test("cleanup releases IDs older than the replay window", () => {
    let now = 1_000;
    const guard = new NIP46ReplayGuard({ now: () => now });
    guard.isReplay("old");
    now += 30_000;
    guard.isReplay("recent");
    now += 91_000;

    expect(guard.cleanup()).toBe(1);
    expect(guard.isReplay("old")).toBe(false);
    expect(guard.isReplay("recent")).toBe(true);
  });

  test("clear resets every retained ID", () => {
    const guard = new NIP46ReplayGuard();
    guard.isReplay("first");
    guard.isReplay("second");

    guard.clear();

    expect(guard.size).toBe(0);
    expect(guard.isReplay("first")).toBe(false);
  });
});
