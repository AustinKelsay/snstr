import {
  enforceMemoryLimits,
  safeArrayAccess,
  secureRandomHex,
  validateArrayAccess,
} from "../../src/utils/security-validator";

describe("security-validator pure utilities with no public behavior route", () => {
  describe("direct unreachable array guards", () => {
    it("covers only inputs public consumers cannot supply after their own guards", () => {
      const values = ["value"];

      // Public consumers use fixed non-negative indexes.
      expect(() => validateArrayAccess(values, -1, "values")).toThrow(
        "out of bounds",
      );
      expect(safeArrayAccess(values, -1, "default")).toBe("default");

      // Every public safeArrayAccess caller first iterates or guards an array.
      expect(
        safeArrayAccess("not-an-array" as unknown as string[], 0, "default"),
      ).toBe("default");
    });
  });

  describe("direct identifier entropy coverage (no higher-level API exposes requested hex length)", () => {
    it("returns exact odd and even lengths and rejects invalid requests", () => {
      expect(secureRandomHex(7)).toMatch(/^[0-9a-f]{7}$/);
      expect(secureRandomHex(8)).toMatch(/^[0-9a-f]{8}$/);

      for (const length of [0, -1, 1.5, "8"]) {
        expect(() => secureRandomHex(length as number)).toThrow(
          "Length must be a positive integer",
        );
      }
    });
  });

  describe("direct bounded-map eviction coverage (the Relay maps are private and cannot be populated deterministically)", () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it("does nothing at the limit and evicts least-recently-used entries above it", () => {
      const atLimit = new Map([
        ["a", 1],
        ["b", 2],
      ]);
      enforceMemoryLimits(atLimit, 2, undefined, "at-limit");
      expect([...atLimit.keys()]).toEqual(["a", "b"]);
      expect(warnSpy).not.toHaveBeenCalled();

      const overLimit = new Map([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ]);
      const accessTimes = new Map([
        ["a", 1],
        ["b", 3],
        ["c", 2],
      ]);

      enforceMemoryLimits(overLimit, 2, accessTimes, "test-map");

      expect([...overLimit.keys()]).toEqual(["b", "c"]);
      expect([...accessTimes.keys()]).toEqual(["b", "c"]);
      expect(warnSpy).toHaveBeenCalledWith(
        "Security: Enforced memory limit for test-map, removed 1 entries (3 -> 2)",
      );
    });

    it("falls back to FIFO when access metadata cannot reach the target", () => {
      const values = new Map([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ]);
      const incompleteAccessTimes = new Map([["missing", 0]]);

      enforceMemoryLimits(values, 1, incompleteAccessTimes, "fallback-map");

      expect([...values.keys()]).toEqual(["c"]);
      expect(incompleteAccessTimes.has("missing")).toBe(true);
      expect(warnSpy).toHaveBeenCalledWith(
        "Security: Enforced memory limit for fallback-map, removed 2 entries (3 -> 1)",
      );
    });
  });
});
