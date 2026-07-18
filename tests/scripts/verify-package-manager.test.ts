/* eslint-disable @typescript-eslint/no-var-requires */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

interface PackageManagerVerifier {
  extractRunCommands(workflow: string): Set<string>;
  verifyRepository(repoRoot: string): string[];
}

const verifier =
  require("../../scripts/verify-package-manager.js") as PackageManagerVerifier;

function writeFixture(root: string): void {
  mkdirSync(path.join(root, ".github/workflows"), { recursive: true });
  writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "fixture",
      version: "1.0.0",
      packageManager: "npm@9.8.1",
    }),
  );
  writeFileSync(
    path.join(root, "package-lock.json"),
    JSON.stringify({
      name: "fixture",
      version: "1.0.0",
      lockfileVersion: 3,
      packages: { "": { name: "fixture", version: "1.0.0" } },
    }),
  );
  writeFileSync(path.join(root, "bun.lock"), "{}");
  writeFileSync(path.join(root, ".bun-version"), "1.3.9\n");
  writeFileSync(
    path.join(root, ".github/workflows/build-test.yml"),
    [
      "run: corepack prepare npm@9.8.1 --activate",
      "run: npm ci",
      "run: bun install --frozen-lockfile",
    ].join("\n"),
  );
}

describe("package-manager policy verifier", () => {
  test("accepts the repository policy", () => {
    expect(verifier.verifyRepository(process.cwd())).toEqual([]);
  });

  test("accepts a complete policy fixture", () => {
    const root = mkdtempSync(path.join(tmpdir(), "snstr-package-manager-"));
    try {
      writeFixture(root);
      expect(verifier.verifyRepository(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("only accepts active run-step commands", () => {
    expect(
      verifier.extractRunCommands(
        [
          "# run: npm ci",
          "name: echo example",
          'run: echo "npm ci"',
          "run: |",
          "  # bun install --frozen-lockfile",
          "  npm ci",
        ].join("\n"),
      ),
    ).toEqual(new Set(['echo "npm ci"', "npm ci"]));
  });

  test("reports malformed required files without throwing", () => {
    const root = mkdtempSync(path.join(tmpdir(), "snstr-package-manager-"));
    try {
      writeFixture(root);
      writeFileSync(path.join(root, "package-lock.json"), "{invalid");
      expect(verifier.verifyRepository(root)).toEqual([
        expect.stringContaining("package-lock.json is not valid JSON:"),
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test.each(["null", "[]", '"manifest"'])(
    "rejects a non-object package manifest root: %s",
    (content) => {
      const root = mkdtempSync(path.join(tmpdir(), "snstr-package-manager-"));
      try {
        writeFixture(root);
        writeFileSync(path.join(root, "package.json"), content);
        expect(verifier.verifyRepository(root)).toEqual([
          "package.json must contain a JSON object",
        ]);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  test("reports drift in metadata, lockfiles, and workflow commands", () => {
    const root = mkdtempSync(path.join(tmpdir(), "snstr-package-manager-"));
    try {
      writeFixture(root);
      writeFileSync(
        path.join(root, "package.json"),
        JSON.stringify({
          name: "fixture",
          version: "2.0.0",
          packageManager: "pnpm@9.0.0",
        }),
      );
      writeFileSync(path.join(root, "pnpm-lock.yaml"), "lockfileVersion: 9\n");
      writeFileSync(
        path.join(root, ".github/workflows/build-test.yml"),
        "run: npm install\n",
      );

      expect(verifier.verifyRepository(root)).toEqual(
        expect.arrayContaining([
          'package.json packageManager must be npm@9.8.1; found "pnpm@9.0.0"',
          "package-lock.json root version must match package.json",
          "pnpm-lock.yaml is not allowed at the repository root",
          'build-test workflow must run "npm ci"',
          'build-test workflow must run "bun install --frozen-lockfile"',
        ]),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
