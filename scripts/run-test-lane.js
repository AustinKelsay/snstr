const path = require("path");
const { spawnSync } = require("child_process");
const {
  SLOW_TEST_NAME_PREFIX,
  getJestArgsForLane,
  getTestFilesForLane,
} = require("./test-lanes");

const repoRoot = path.resolve(__dirname, "..");
const [, , runtime, lane, ...extraArgs] = process.argv;

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  process.exit(result.status === null ? 1 : result.status);
}

function getBunArgsForLane(lane, extraArgs, root = repoRoot) {
  const testFiles = getTestFilesForLane(lane, root);
  const isRoutineWatch = lane === "routine" && extraArgs.includes("--watch");
  const escapedSlowPrefix = SLOW_TEST_NAME_PREFIX.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  const testSelection = isRoutineWatch
    ? [
        "./tests",
        `--test-name-pattern=^(?!${escapedSlowPrefix})`,
      ]
    : testFiles;

  return [
    "test",
    ...testSelection,
    "--max-concurrency",
    "1",
    "--timeout",
    "30000",
    ...extraArgs,
  ];
}

function main() {
  if (runtime === "jest") {
    getTestFilesForLane(lane, repoRoot);
    const jestPackage = require.resolve("jest/package.json");
    const jestBinary = path.join(path.dirname(jestPackage), "bin", "jest.js");
    run(process.execPath, [
      jestBinary,
      ...getJestArgsForLane(lane),
      ...extraArgs,
    ]);
  }

  if (runtime === "bun") {
    run("bun", getBunArgsForLane(lane, extraArgs));
  }

  throw new Error(`Unknown test runtime: ${runtime}`);
}

if (require.main === module) main();

module.exports = { getBunArgsForLane };
