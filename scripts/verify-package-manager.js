#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");

const CANONICAL_PACKAGE_MANAGER = "npm@9.8.1";
const COMPATIBILITY_BUN_VERSION = "1.3.9";
const FORBIDDEN_ROOT_LOCKFILES = [
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "yarn.lock",
];

function verifyRepository(repoRoot) {
  const errors = [];
  const readText = (file) => {
    try {
      return fs.readFileSync(path.join(repoRoot, file), "utf8");
    } catch (error) {
      errors.push(`${file} could not be read: ${error.message}`);
      return undefined;
    }
  };
  const readJson = (file) => {
    const content = readText(file);
    if (content === undefined) return undefined;
    try {
      const parsed = JSON.parse(content);
      if (
        parsed === null ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        errors.push(`${file} must contain a JSON object`);
        return undefined;
      }
      return parsed;
    } catch (error) {
      errors.push(`${file} is not valid JSON: ${error.message}`);
      return undefined;
    }
  };
  const packageJson = readJson("package.json");

  if (!packageJson) return errors.sort();

  if (packageJson.packageManager !== CANONICAL_PACKAGE_MANAGER) {
    errors.push(
      `package.json packageManager must be ${CANONICAL_PACKAGE_MANAGER}; found ${JSON.stringify(packageJson.packageManager)}`,
    );
  }

  const packageLockPath = path.join(repoRoot, "package-lock.json");
  if (!fs.existsSync(packageLockPath)) {
    errors.push("package-lock.json is required");
  } else {
    const packageLock = readJson("package-lock.json");
    if (!packageLock) return errors.sort();
    if (packageLock.lockfileVersion !== 3) {
      errors.push(
        `package-lock.json must use lockfileVersion 3; found ${packageLock.lockfileVersion}`,
      );
    }
    const rootPackage = packageLock.packages?.[""];
    for (const field of ["name", "version"]) {
      if (rootPackage?.[field] !== packageJson[field]) {
        errors.push(`package-lock.json root ${field} must match package.json`);
      }
    }
  }

  if (!fs.existsSync(path.join(repoRoot, "bun.lock"))) {
    errors.push("bun.lock is required for the Bun compatibility lane");
  }
  const bunVersionPath = path.join(repoRoot, ".bun-version");
  if (!fs.existsSync(bunVersionPath)) {
    errors.push(".bun-version is required for the Bun compatibility lane");
  } else {
    const bunVersion = readText(".bun-version");
    if (
      bunVersion !== undefined &&
      bunVersion.trim() !== COMPATIBILITY_BUN_VERSION
    ) {
      errors.push(`.bun-version must pin Bun ${COMPATIBILITY_BUN_VERSION}`);
    }
  }
  for (const file of FORBIDDEN_ROOT_LOCKFILES) {
    if (fs.existsSync(path.join(repoRoot, file))) {
      errors.push(`${file} is not allowed at the repository root`);
    }
  }

  const workflow = readText(".github/workflows/build-test.yml");
  if (workflow === undefined) return errors.sort();
  const runCommands = extractRunCommands(workflow);
  for (const command of [
    `corepack prepare ${CANONICAL_PACKAGE_MANAGER} --activate`,
    "npm ci",
    "bun install --frozen-lockfile",
  ]) {
    if (!runCommands.has(command)) {
      errors.push(`build-test workflow must run ${JSON.stringify(command)}`);
    }
  }

  return errors.sort();
}

function extractRunCommands(workflow) {
  const commands = new Set();
  const lines = workflow.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(\s*)run:\s*(.*?)\s*$/);
    if (!match) continue;
    const [, indentation, value] = match;
    if (value && value !== "|" && value !== ">") {
      const quote = value[0];
      commands.add(
        (quote === '"' || quote === "'") && value.at(-1) === quote
          ? value.slice(1, -1)
          : value,
      );
      continue;
    }
    for (index += 1; index < lines.length; index += 1) {
      const commandLine = lines[index];
      if (!commandLine.trim()) continue;
      const commandIndent = commandLine.match(/^\s*/)[0].length;
      if (commandIndent <= indentation.length) {
        index -= 1;
        break;
      }
      const command = commandLine.trim();
      if (!command.startsWith("#")) commands.add(command);
    }
  }
  return commands;
}

function runCli(repoRoot = path.resolve(__dirname, "..")) {
  const errors = verifyRepository(repoRoot);
  if (errors.length > 0) {
    console.error(
      "[package-manager:verify] Package-manager policy verification failed:",
    );
    for (const error of errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(
    "[package-manager:verify] npm and Bun metadata, lockfiles, and CI commands are consistent.",
  );
  return 0;
}

module.exports = { extractRunCommands, runCli, verifyRepository };

if (require.main === module) {
  process.exitCode = runCli(
    process.argv[2] ? path.resolve(process.argv[2]) : undefined,
  );
}
