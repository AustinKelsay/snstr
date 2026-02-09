#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Verifies that the npm tarball contains the runtime entrypoints referenced by
 * package.json (main/types/exports/...).
 *
 * This is intended to prevent publishing a broken package when dist artifacts
 * are missing or accidentally excluded by ignore rules.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");

function toPackPath(p) {
  if (typeof p !== "string" || p.length === 0) return null;
  // NPM pack lists paths without a leading "./".
  return p.startsWith("./") ? p.slice(2) : p;
}

function collectExportTargets(node, out) {
  if (typeof node === "string") {
    const p = toPackPath(node);
    if (p) out.add(p);
    return;
  }
  if (!node || typeof node !== "object") return;

  if (Array.isArray(node)) {
    for (const item of node) collectExportTargets(item, out);
    return;
  }

  for (const value of Object.values(node)) collectExportTargets(value, out);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fail(msg) {
  console.error(`[pack:verify] ${msg}`);
  process.exit(1);
}

const pkgPath = path.join(repoRoot, "package.json");
const pkg = readJson(pkgPath);

const referenced = new Set();

for (const key of ["main", "types", "react-native"]) {
  const p = toPackPath(pkg[key]);
  if (p) referenced.add(p);
}

collectExportTargets(pkg.exports, referenced);

const referencedFiles = [...referenced].filter((p) => !p.endsWith("/"));

// 1) Ensure the referenced targets exist on disk (after build).
const missingOnDisk = referencedFiles.filter((p) => !fs.existsSync(path.join(repoRoot, p)));
if (missingOnDisk.length) {
  fail(
    `Missing files referenced by package.json: ${missingOnDisk
      .sort()
      .map((p) => JSON.stringify(p))
      .join(", ")}`
  );
}

// 2) Ensure the referenced targets are included in the packed tarball.
const cacheDir = path.join(repoRoot, ".npm-cache");
fs.mkdirSync(cacheDir, { recursive: true });

let packJson;
try {
  packJson = execFileSync(
    "npm",
    ["pack", "--dry-run", "--ignore-scripts", "--json", "--cache", cacheDir],
    { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }
  );
} catch (err) {
  fail(`npm pack --dry-run failed. ${err && err.message ? err.message : String(err)}`);
}

let packInfo;
try {
  const parsed = JSON.parse(packJson);
  packInfo = Array.isArray(parsed) ? parsed[0] : parsed;
} catch (err) {
  fail(`Failed to parse npm pack JSON output. ${err && err.message ? err.message : String(err)}`);
}

const packedPaths = new Set((packInfo.files || []).map((f) => f.path));
const missingInTarball = referencedFiles.filter((p) => !packedPaths.has(p));
if (missingInTarball.length) {
  fail(
    `Referenced files are not included in the npm tarball: ${missingInTarball
      .sort()
      .map((p) => JSON.stringify(p))
      .join(", ")}`
  );
}

console.log(
  `[pack:verify] OK (${referencedFiles.length} referenced targets, ${packedPaths.size} packed files)`
);

