import {
  enforceMemoryLimits,
  safeArrayAccess,
  secureRandomHex,
  validateArrayAccess,
} from "../../src/utils/security-validator";
import type { DiagnosticLogger } from "../../src/utils/logger";

function createLogger(): jest.Mocked<DiagnosticLogger> {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
  };
}

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
    let logger: jest.Mocked<DiagnosticLogger>;

    beforeEach(() => {
      logger = createLogger();
    });

    it("does nothing at the limit and evicts least-recently-used entries above it", () => {
      const atLimit = new Map([
        ["a", 1],
        ["b", 2],
      ]);
      enforceMemoryLimits(atLimit, 2, undefined, "at-limit", logger);
      expect([...atLimit.keys()]).toEqual(["a", "b"]);
      expect(logger.warn).not.toHaveBeenCalled();

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

      enforceMemoryLimits(overLimit, 2, accessTimes, "test-map", logger);

      expect([...overLimit.keys()]).toEqual(["b", "c"]);
      expect([...accessTimes.keys()]).toEqual(["b", "c"]);
      expect(logger.warn).toHaveBeenCalledWith("Enforced memory limit", {
        finalSize: 2,
        initialSize: 3,
        removedCount: 1,
        scope: "test-map",
      });
    });

    it("falls back to FIFO when access metadata cannot reach the target", () => {
      const values = new Map([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ]);
      const incompleteAccessTimes = new Map([["missing", 0]]);

      enforceMemoryLimits(
        values,
        1,
        incompleteAccessTimes,
        "fallback-map",
        logger,
      );

      expect([...values.keys()]).toEqual(["c"]);
      expect(incompleteAccessTimes.has("missing")).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith("Enforced memory limit", {
        finalSize: 1,
        initialSize: 3,
        removedCount: 2,
        scope: "fallback-map",
      });
    });
  });
});
