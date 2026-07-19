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
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { builtinModules } = require("module");
const ts = require("typescript");

const repoRoot = path.resolve(__dirname, "..");

function toPackPath(p) {
  if (typeof p !== "string" || p.length === 0) return null;
  // NPM pack lists paths without a leading "./".
  return p.startsWith("./") ? p.slice(2) : p;
}

function runtimeConditionTarget(condition) {
  if (typeof condition === "string") return condition;
  if (!condition || typeof condition !== "object") return null;
  return condition.default ?? condition.import ?? condition.require ?? null;
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

function verifyNodeSubpathResolution(packageRoot) {
  const checks = [
    {
      label: "CommonJS snstr/testing",
      args: [
        "-e",
        'const api = require("snstr/testing"); if (typeof api.NostrRelay !== "function") process.exit(1);',
      ],
    },
    {
      label: "ESM snstr/testing",
      args: [
        "--input-type=module",
        "-e",
        'const api = await import("snstr/testing"); if (typeof api.NostrRelay !== "function") process.exit(1);',
      ],
    },
    {
      label: "legacy CommonJS ephemeral relay alias",
      args: [
        "-e",
        'const api = require("snstr/utils/ephemeral-relay"); if (typeof api.NostrRelay !== "function") process.exit(1);',
      ],
    },
    {
      label: "legacy ESM ephemeral relay alias",
      args: [
        "--input-type=module",
        "-e",
        'const api = await import("snstr/utils/ephemeral-relay"); if (typeof api.NostrRelay !== "function") process.exit(1);',
      ],
    },
  ];

  for (const { label, args } of checks) {
    try {
      execFileSync(process.execPath, args, { cwd: packageRoot, stdio: "pipe" });
    } catch (err) {
      throw new Error(
        `${label} did not resolve through package exports. ${err?.message ?? String(err)}`,
      );
    }
  }
}

function verifyPackedTypeConsumer(tempDir) {
  const fixturePath = path.join(tempDir, "consumer.mts");
  fs.writeFileSync(
    fixturePath,
    [
      'import { RelayEvent, type NostrEvent, type RelayInterface } from "snstr";',
      'import { NostrRelay, type RelayTestContext, type RelayTestMock } from "snstr/testing";',
      "",
      "const mock: RelayTestMock = (id: string, accepted: boolean) => `${id}:${accepted}`;",
      "declare const relay: RelayInterface;",
      "declare const event: NostrEvent;",
      "const context: RelayTestContext = {",
      "  relay,",
      "  originals: {},",
      "  mocks: { send: mock, handlers: { [RelayEvent.OK]: mock } },",
      "  capturedCallbacks: {},",
      "};",
      "void [mock, context, event, NostrRelay];",
      "",
    ].join("\n"),
  );

  const program = ts.createProgram({
    rootNames: [fixturePath],
    options: {
      strict: true,
      noEmit: true,
      skipLibCheck: false,
      types: [],
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      lib: ["lib.es2020.d.ts", "lib.dom.d.ts"],
    },
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length === 0) return;

  const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => tempDir,
    getNewLine: () => "\n",
  });
  throw new Error(`Packed no-Jest type consumer failed:\n${formatted}`);
}

function declarationFiles(root) {
  const found = [];
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(entryPath);
      } else if (entry.name.endsWith(".d.ts")) {
        found.push(entryPath);
      }
    }
  }
  return found;
}

function verifyPublishedDeclarationPurity(packageRoot) {
  const forbiddenJestDeclarationPatterns = [
    /\bjest\s*\./,
    /\btypeof\s+jest\b/,
    /\bnamespace\s+jest\b/,
    /@types\/jest/,
    /<reference\s+types=["']jest["']/,
    /\bfrom\s+["'](?:@jest\/globals|jest)["']/,
    /\bimport\s+["'](?:@jest\/globals|jest)["']/,
    /\bimport\s*\(\s*["'](?:@jest\/globals|jest)["']\s*\)/,
  ];
  const polluted = declarationFiles(packageRoot).filter((declarationPath) => {
    const declaration = fs.readFileSync(declarationPath, "utf8");
    return forbiddenJestDeclarationPatterns.some((pattern) =>
      pattern.test(declaration),
    );
  });
  if (polluted.length === 0) return;

  throw new Error(
    `Published declarations reference Jest: ${polluted
      .map((declarationPath) => path.relative(packageRoot, declarationPath))
      .sort()
      .map((declarationPath) => JSON.stringify(declarationPath))
      .join(", ")}`,
  );
}

function verifyPackedNodeSubpathResolution(cacheDir) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "snstr-pack-verify-"));
  let failure;

  try {
    const packOutput = execFileSync(
      "npm",
      [
        "pack",
        "--ignore-scripts",
        "--json",
        "--cache",
        cacheDir,
        "--pack-destination",
        tempDir,
      ],
      { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
    );
    const parsed = JSON.parse(packOutput);
    const packInfo = Array.isArray(parsed) ? parsed[0] : parsed;
    const tarballPath = path.join(tempDir, packInfo.filename);

    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify({ private: true }),
    );
    const packageManifest = readJson(path.join(repoRoot, "package.json"));
    const requiredConsumerTypes = [
      "@types/crypto-js",
      "@types/node",
      "@types/ws",
    ];
    for (const dependency of requiredConsumerTypes) {
      const version = packageManifest.devDependencies?.[dependency];
      if (typeof version !== "string" || version.trim().length === 0) {
        throw new Error(
          `Packed consumer dependency ${JSON.stringify(dependency)} is missing from devDependencies`,
        );
      }
    }
    try {
      execFileSync(
        "npm",
        [
          "install",
          "--ignore-scripts",
          "--no-audit",
          "--no-fund",
          "--cache",
          cacheDir,
          tarballPath,
          ...requiredConsumerTypes.map(
            (dependency) =>
              `${dependency}@${packageManifest.devDependencies[dependency]}`,
          ),
        ],
        { cwd: tempDir, stdio: "pipe" },
      );
    } catch (err) {
      const detail = err?.stderr
        ? err.stderr.toString().trim()
        : (err?.message ?? String(err));
      throw new Error(`Packed consumer npm install failed. ${detail}`);
    }
    const packageRoot = path.join(tempDir, "node_modules", "snstr");
    for (const forbiddenPackage of ["jest", "@types/jest"]) {
      if (fs.existsSync(path.join(tempDir, "node_modules", forbiddenPackage))) {
        throw new Error(
          `Packed consumer unexpectedly installed ${forbiddenPackage}`,
        );
      }
    }
    verifyNodeSubpathResolution(packageRoot);
    verifyPublishedDeclarationPurity(packageRoot);
    verifyPackedTypeConsumer(tempDir);
  } catch (err) {
    failure = err;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  if (failure) {
    fail(
      `Packed package subpath verification failed. ${failure?.message ?? String(failure)}`,
    );
  }
}

function packageName(specifier) {
  if (specifier.startsWith("@")) {
    return specifier.split("/").slice(0, 2).join("/");
  }
  return specifier.split("/")[0];
}

function collectDependencyReferences(source) {
  const references = [];
  const statementPattern = /(?:^|\n)\s*(?:import|export)\b[\s\S]*?;/g;
  let statementMatch;

  while ((statementMatch = statementPattern.exec(source)) !== null) {
    const statement = statementMatch[0];
    const fromMatch = statement.match(/\bfrom\s*["']([^"']+)["']/);
    const sideEffectMatch = statement.match(/\bimport\s*["']([^"']+)["']/);
    const specifier = fromMatch?.[1] ?? sideEffectMatch?.[1];
    if (specifier) references.push({ kind: "static", specifier });
  }

  const literalPatterns = [
    {
      kind: "dynamic-import",
      pattern: /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    },
    {
      kind: "require",
      pattern: /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
    },
  ];

  for (const { kind, pattern } of literalPatterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) {
      references.push({ kind, specifier: match[1] });
    }
  }

  return references;
}

function verifyPlatformConditionOrder(exportsMap) {
  for (const [subpath, conditions] of Object.entries(exportsMap || {})) {
    if (
      !conditions ||
      typeof conditions !== "object" ||
      Array.isArray(conditions)
    ) {
      continue;
    }

    const platforms = ["react-native", "browser"].filter(
      (key) => key in conditions,
    );
    if (platforms.length === 0) continue;

    if (
      platforms.length === 2 &&
      JSON.stringify(conditions["react-native"]) !==
        JSON.stringify(conditions.browser)
    ) {
      fail(`${subpath} resolves browser and React Native to different targets`);
    }

    const order = Object.keys(conditions);
    for (const platform of platforms) {
      for (const competing of ["import", "require", "default"]) {
        if (
          competing in conditions &&
          order.indexOf(platform) > order.indexOf(competing)
        ) {
          fail(
            `${subpath} places ${JSON.stringify(platform)} after ${JSON.stringify(competing)}; conditional exports use first-match order`,
          );
        }
      }
    }
  }
}

function verifyPlatformTypeResolution() {
  const cases = [
    ["snstr", "dist/esm/src/entries/index.web.d.ts"],
    ["snstr/nip04", "dist/esm/src/nip04/web.d.ts"],
  ];
  const containingFile = path.join(repoRoot, "scripts", "platform-consumer.ts");

  for (const condition of ["browser", "react-native"]) {
    for (const [moduleName, expectedTarget] of cases) {
      const resolution = ts.resolveModuleName(
        moduleName,
        containingFile,
        {
          customConditions: [condition],
          module: ts.ModuleKind.NodeNext,
          moduleResolution: ts.ModuleResolutionKind.NodeNext,
        },
        ts.sys,
      );
      const expectedPath = path.join(repoRoot, expectedTarget);

      if (resolution.resolvedModule?.resolvedFileName !== expectedPath) {
        fail(
          `${moduleName} under ${condition} resolves declarations to ${resolution.resolvedModule?.resolvedFileName ?? "nothing"}; expected ${expectedPath}`,
        );
      }
    }
  }
}

function verifyWebEntryGraph(entryTarget) {
  const entryPath = path.resolve(repoRoot, entryTarget);
  const sourceRoot = path.resolve(repoRoot, "dist/esm/src");
  const builtins = new Set(
    builtinModules.map((name) => name.replace(/^node:/, "")),
  );
  const forbiddenPackages = new Set(["ws", "websocket-polyfill"]);
  const forbiddenModules = [
    "nip46/bunker.js",
    "nip46/client.js",
    "nip46/simple-bunker.js",
    "nip46/simple-client.js",
    "nip46/utils/auth.js",
    "nip47/client.js",
    "nip47/service.js",
    "nip47/index.js",
  ];
  // These exact Node crypto fallbacks are runtime-guarded and preserve Node 16
  // and pure-ESM compatibility. Any new file, form, or dependency must be
  // reviewed and added explicitly; stale exceptions fail below as well.
  const allowedGuardedNodeReferences = new Set([
    "nip17/index.js|dynamic-import|crypto",
    "nip17/index.js|require|crypto",
    "utils/security-validator.js|require|crypto",
  ]);
  const observedGuardedNodeReferences = new Set();
  const visited = new Set();
  const pending = [entryPath];
  const violations = [];

  while (pending.length > 0) {
    const filePath = pending.pop();
    if (visited.has(filePath)) continue;
    visited.add(filePath);

    if (!fs.existsSync(filePath)) {
      violations.push(`missing module ${path.relative(repoRoot, filePath)}`);
      continue;
    }

    const source = fs.readFileSync(filePath, "utf8");
    for (const { kind, specifier } of collectDependencyReferences(source)) {
      if (specifier.startsWith(".")) {
        const resolved = path.resolve(path.dirname(filePath), specifier);
        const relativeModule = path
          .relative(sourceRoot, resolved)
          .replaceAll(path.sep, "/");
        if (
          relativeModule.startsWith("../") ||
          forbiddenModules.some((forbidden) =>
            forbidden.endsWith("/")
              ? relativeModule.startsWith(forbidden)
              : relativeModule === forbidden,
          )
        ) {
          violations.push(
            `${path.relative(repoRoot, filePath)} imports forbidden web module ${specifier}`,
          );
          continue;
        }
        pending.push(resolved);
        continue;
      }

      const dependency = packageName(specifier.replace(/^node:/, ""));
      if (
        specifier.startsWith("node:") ||
        builtins.has(dependency) ||
        forbiddenPackages.has(dependency)
      ) {
        const relativeFile = path
          .relative(sourceRoot, filePath)
          .replaceAll(path.sep, "/");
        const exceptionKey = `${relativeFile}|${kind}|${specifier}`;
        if (allowedGuardedNodeReferences.has(exceptionKey)) {
          observedGuardedNodeReferences.add(exceptionKey);
          continue;
        }
        violations.push(
          `${path.relative(repoRoot, filePath)} uses Node-only dependency ${specifier} via ${kind}`,
        );
      }
    }
  }

  const staleExceptions = [...allowedGuardedNodeReferences].filter(
    (exception) => !observedGuardedNodeReferences.has(exception),
  );
  if (staleExceptions.length > 0) {
    violations.push(
      `stale guarded dependency exceptions: ${staleExceptions.join(", ")}`,
    );
  }

  if (violations.length > 0) {
    fail(
      `Web entry dependency graph is not platform-safe: ${violations.join("; ")}`,
    );
  }

  return {
    guardedNodeReferences: observedGuardedNodeReferences.size,
    modules: visited.size,
  };
}

const pkgPath = path.join(repoRoot, "package.json");
const pkg = readJson(pkgPath);

verifyPlatformConditionOrder(pkg.exports);
verifyPlatformTypeResolution();

const referenced = new Set();

for (const key of ["main", "types", "react-native"]) {
  const p = toPackPath(pkg[key]);
  if (p) referenced.add(p);
}

collectExportTargets(pkg.exports, referenced);

const referencedFiles = [...referenced].filter((p) => !p.endsWith("/"));

// 1) Ensure the referenced targets exist on disk (after build).
const missingOnDisk = referencedFiles.filter(
  (p) => !fs.existsSync(path.join(repoRoot, p)),
);
if (missingOnDisk.length) {
  fail(
    `Missing files referenced by package.json: ${missingOnDisk
      .sort()
      .map((p) => JSON.stringify(p))
      .join(", ")}`,
  );
}

// The package build must contain library artifacts only. Examples are built
// separately through `npm run build:examples` and must not leak into `dist`.
const forbiddenBuildTrees = [
  "dist/tests",
  "dist/examples",
  "dist/esm/tests",
  "dist/esm/examples",
];
const presentForbiddenBuildTrees = forbiddenBuildTrees.filter((p) =>
  fs.existsSync(path.join(repoRoot, p)),
);
if (presentForbiddenBuildTrees.length) {
  fail(
    `Production build contains test/example trees: ${presentForbiddenBuildTrees
      .map((p) => JSON.stringify(p))
      .join(", ")}`,
  );
}

const webEntryTarget = toPackPath(
  runtimeConditionTarget(pkg.exports?.["."]?.browser),
);
if (!webEntryTarget) {
  fail("Missing browser target for the root package export");
}
const webGraph = verifyWebEntryGraph(webEntryTarget);

// 2) Ensure the referenced targets are included in the packed tarball.
const cacheDir = path.join(repoRoot, ".npm-cache");
fs.mkdirSync(cacheDir, { recursive: true });

let packJson;
try {
  packJson = execFileSync(
    "npm",
    ["pack", "--dry-run", "--ignore-scripts", "--json", "--cache", cacheDir],
    { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
} catch (err) {
  fail(
    `npm pack --dry-run failed. ${err && err.message ? err.message : String(err)}`,
  );
}

let packInfo;
try {
  const parsed = JSON.parse(packJson);
  packInfo = Array.isArray(parsed) ? parsed[0] : parsed;
} catch (err) {
  fail(
    `Failed to parse npm pack JSON output. ${err && err.message ? err.message : String(err)}`,
  );
}

const packedPaths = new Set((packInfo.files || []).map((f) => f.path));
const forbiddenTestSupportPaths = [
  "dist/src/utils/test-helpers.js",
  "dist/src/utils/test-helpers.d.ts",
  "dist/esm/src/utils/test-helpers.js",
  "dist/esm/src/utils/test-helpers.d.ts",
  "dist/src/types/globals.d.ts",
  "dist/esm/src/types/globals.d.ts",
];
const accidentallyPacked = forbiddenTestSupportPaths.filter((p) =>
  packedPaths.has(p),
);
if (accidentallyPacked.length) {
  fail(
    `Private test helpers are included in the npm tarball: ${accidentallyPacked
      .sort()
      .map((p) => JSON.stringify(p))
      .join(", ")}`,
  );
}
const missingInTarball = referencedFiles.filter((p) => !packedPaths.has(p));
if (missingInTarball.length) {
  fail(
    `Referenced files are not included in the npm tarball: ${missingInTarball
      .sort()
      .map((p) => JSON.stringify(p))
      .join(", ")}`,
  );
}

try {
  verifyNodeSubpathResolution(repoRoot);
} catch (err) {
  fail(`Checkout subpath verification failed. ${err?.message ?? String(err)}`);
}
verifyPackedNodeSubpathResolution(cacheDir);

console.log(
  `[pack:verify] OK (${referencedFiles.length} referenced targets, ${packedPaths.size} packed files, ${webGraph.modules} web modules, ${webGraph.guardedNodeReferences} guarded Node fallbacks)`,
);
