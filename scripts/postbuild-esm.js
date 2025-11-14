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

try {
  if (!fs.existsSync(esmDir)) {
    console.error(`[postbuild-esm] ESM outDir not found: ${esmDir}`);
    process.exit(0);
  }

  const pkg = { type: 'module' };
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log(`[postbuild-esm] Wrote ${pkgPath}`);
} catch (err) {
  console.error('[postbuild-esm] Failed to write ESM package.json:', err);
  process.exit(1);
}

