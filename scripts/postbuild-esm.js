#!/usr/bin/env node
/*
 * Write a package.json into dist/esm so Node treats that subtree as ESM
 * without changing the root package type. This avoids breaking CJS users
 * while letting conditional exports point to native ESM files.
 */
const fs = require('fs');
const path = require('path');

const esmDir = path.join(__dirname, '..', 'dist', 'esm');
const pkgPath = path.join(esmDir, 'package.json');
const esmSrcDir = path.join(esmDir, 'src');

function ensureDir() {
  if (!fs.existsSync(esmDir)) {
    console.error(`[postbuild-esm] ESM outDir not found: ${esmDir}`);
    process.exit(0);
  }
}

function writeEsmPackageJson() {
  const pkg = { type: 'module' };
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log(`[postbuild-esm] Wrote ${pkgPath}`);
}

function ensureJsSpecifier(specifier, importerFile) {
  if (!specifier.startsWith('.')) {
    return specifier;
  }
  if (/\.[^/]+$/.test(specifier)) {
    return specifier;
  }

  const importerDir = path.dirname(importerFile);
  const absBase = path.resolve(importerDir, specifier);
  if (fs.existsSync(`${absBase}.js`)) {
    return `${specifier}.js`;
  }

  const indexCandidate = path.join(absBase, 'index.js');
  if (fs.existsSync(indexCandidate)) {
    return `${specifier}/index.js`;
  }

  return `${specifier}.js`;
}

function rewriteSpecifiers(code, importerFile) {
  const fromRe = /(from\s+['"])(\.{1,2}\/[^'"]+)(['"])/g;
  const importCallRe = /(import\s*\(\s*['"])(\.{1,2}\/[^'"]+)(['"]\s*\))/g;
  const importSideEffectRe = /(import\s+['"])(\.{1,2}\/[^'"]+)(['"])/g;

  let updated = code.replace(fromRe, (_, pre, spec, post) => {
    return `${pre}${ensureJsSpecifier(spec, importerFile)}${post}`;
  });

  updated = updated.replace(importCallRe, (_, pre, spec, post) => {
    return `${pre}${ensureJsSpecifier(spec, importerFile)}${post}`;
  });

  updated = updated.replace(importSideEffectRe, (_, pre, spec, post) => {
    return `${pre}${ensureJsSpecifier(spec, importerFile)}${post}`;
  });

  return updated;
}

function walk(dir, visitor) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, visitor);
    } else if (entry.isFile()) {
      visitor(fullPath);
    }
  }
}

function patchEsmImports() {
  if (!fs.existsSync(esmSrcDir)) {
    return;
  }

  walk(esmSrcDir, (file) => {
    if (!file.endsWith('.js')) {
      return;
    }

    const original = fs.readFileSync(file, 'utf8');
    const rewritten = rewriteSpecifiers(original, file);
    if (rewritten !== original) {
      fs.writeFileSync(file, rewritten, 'utf8');
      console.log(`[postbuild-esm] Patched specifiers in ${path.relative(esmDir, file)}`);
    }
  });
}

try {
  ensureDir();
  writeEsmPackageJson();
  patchEsmImports();
} catch (err) {
  console.error('[postbuild-esm] Failed to finalize ESM build:', err);
  process.exit(1);
}
