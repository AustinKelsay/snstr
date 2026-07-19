const path = require("path");
const { spawnSync } = require("child_process");
const { getJestArgsForLane, getTestFilesForLane } = require("./test-lanes");

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

function main() {
  const testFiles = getTestFilesForLane(lane, repoRoot);

  if (runtime === "jest") {
    const jestPackage = require.resolve("jest/package.json");
    const jestBinary = path.join(path.dirname(jestPackage), "bin", "jest.js");
    run(process.execPath, [
      jestBinary,
      ...getJestArgsForLane(lane),
      ...extraArgs,
    ]);
  }

  if (runtime === "bun") {
    run("bun", [
      "test",
      ...testFiles,
      "--max-concurrency",
      "1",
      "--timeout",
      "30000",
      ...extraArgs,
    ]);
  }

  throw new Error(`Unknown test runtime: ${runtime}`);
}

main();
