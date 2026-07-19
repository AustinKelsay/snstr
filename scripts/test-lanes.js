const fs = require("fs");
const path = require("path");

const SLOW_TEST_PATHS = Object.freeze([
  "tests/nip44/nip44-performance-security.test.ts",
  "tests/nip46/performance-security.test.ts",
]);

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function discoverTestFiles(repoRoot) {
  const testsRoot = path.join(repoRoot, "tests");
  const files = [];

  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) {
        files.push(toPosixPath(path.relative(repoRoot, absolutePath)));
      }
    }
  }

  visit(testsRoot);
  return files.sort();
}

function getTestFilesForLane(lane, repoRoot) {
  const allFiles = discoverTestFiles(repoRoot);
  const slowFiles = new Set(SLOW_TEST_PATHS);
  const missingSlowFiles = SLOW_TEST_PATHS.filter(
    (filePath) => !allFiles.includes(filePath),
  );
  if (missingSlowFiles.length > 0) {
    throw new Error(
      `Slow test lane references missing files: ${missingSlowFiles.join(", ")}`,
    );
  }

  if (lane === "all") return allFiles;
  if (lane === "slow") return [...SLOW_TEST_PATHS];
  if (lane === "routine") {
    return allFiles.filter((filePath) => !slowFiles.has(filePath));
  }
  throw new Error(`Unknown test lane: ${lane}`);
}

function getJestArgsForLane(lane) {
  if (lane === "all") return [];
  if (lane === "slow") return [...SLOW_TEST_PATHS];
  if (lane === "routine") {
    const ignorePattern = SLOW_TEST_PATHS.map((filePath) =>
      filePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    ).join("|");
    return [`--testPathIgnorePatterns=${ignorePattern}`];
  }
  throw new Error(`Unknown test lane: ${lane}`);
}

module.exports = {
  SLOW_TEST_PATHS,
  discoverTestFiles,
  getJestArgsForLane,
  getTestFilesForLane,
};
