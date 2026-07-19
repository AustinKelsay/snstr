/* eslint-disable @typescript-eslint/no-var-requires */

import { existsSync, readFileSync } from "fs";
import path from "path";

type TestLane = "all" | "routine" | "slow";

interface TestLaneModule {
  SLOW_TEST_PATHS: string[];
  discoverTestFiles(repoRoot: string): string[];
  getJestArgsForLane(lane: TestLane): string[];
  getTestFilesForLane(lane: TestLane, repoRoot: string): string[];
}

const repoRoot = path.resolve(__dirname, "../..");
const lanes = require("../../scripts/test-lanes.js") as TestLaneModule;

describe("test lane contract", () => {
  const expectedSlowPaths = [
    "tests/nip44/nip44-performance-security.test.ts",
    "tests/nip46/performance-security.test.ts",
  ];

  test("keeps one explicit sorted slow security and performance inventory", () => {
    expect(lanes.SLOW_TEST_PATHS).toEqual(expectedSlowPaths);
    for (const relativePath of lanes.SLOW_TEST_PATHS) {
      expect(existsSync(path.join(repoRoot, relativePath))).toBe(true);
    }
  });

  test("partitions every test file into exactly one routine or slow lane", () => {
    const all = lanes.discoverTestFiles(repoRoot);
    const routine = lanes.getTestFilesForLane("routine", repoRoot);
    const slow = lanes.getTestFilesForLane("slow", repoRoot);

    expect(slow).toEqual(expectedSlowPaths);
    expect(new Set([...routine, ...slow]).size).toBe(all.length);
    expect([...routine, ...slow].sort()).toEqual(all);
    expect(routine.filter((file) => slow.includes(file))).toEqual([]);
  });

  test("keeps targeted Jest runs compatible while excluding slow files by default", () => {
    const routineArgs = lanes.getJestArgsForLane("routine");

    expect(routineArgs).toHaveLength(1);
    expect(routineArgs[0]).toContain("--testPathIgnorePatterns=");
    for (const slowPath of expectedSlowPaths) {
      expect(routineArgs[0]).toContain(slowPath.replace(/\./g, "\\."));
    }
    expect(lanes.getJestArgsForLane("slow")).toEqual(expectedSlowPaths);
    expect(lanes.getJestArgsForLane("all")).toEqual([]);
  });

  test("wires routine, slow, and complete Jest and Bun commands", () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(repoRoot, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts.test).toBe(
      "node scripts/run-test-lane.js jest routine",
    );
    expect(packageJson.scripts["test:slow"]).toBe(
      "node scripts/run-test-lane.js jest slow",
    );
    expect(packageJson.scripts["test:all"]).toBe(
      "npm test && npm run test:slow",
    );
    expect(packageJson.scripts["test:bun"]).toBe(
      "node scripts/run-test-lane.js bun routine",
    );
    expect(packageJson.scripts["test:bun:slow"]).toBe(
      "node scripts/run-test-lane.js bun slow",
    );
    expect(packageJson.scripts["test:bun:all"]).toBe(
      "bun run test:bun && bun run test:bun:slow",
    );
  });

  test("keeps complete assurance explicit in every hosted runtime", () => {
    const workflow = readFileSync(
      path.join(repoRoot, ".github/workflows/build-test.yml"),
      "utf8",
    );

    expect(workflow).toContain("run: npm test");
    expect(workflow).toContain("run: npm run test:slow");
    expect(workflow).toContain("run: bun run test:bun");
    expect(workflow).toContain("run: bun run test:bun:slow");
  });
});
