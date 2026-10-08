#!/usr/bin/env node
/**
 * Typecheck every workspace project with its OWN tsconfig.
 *
 * The root tsconfig intentionally has `include: []` (it only holds shared
 * compilerOptions), so `tsc --noEmit` at the root is a no-op. This script
 * discovers every tsconfig.json under packages and apps and runs
 * `tsc -p <config> --noEmit` against each, failing fast with a summary.
 *
 * Exit codes: 0 = all clean, 1 = one or more projects failed.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tscBin = path.join(rootDir, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.CMD' : 'tsc');

function findTsconfigs(dir, depth = 0, out = []) {
  if (depth > 4) return out;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (['node_modules', 'dist', '.git', 'coverage', 'scratch'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const cfg = path.join(full, 'tsconfig.json');
    if (existsSync(cfg)) out.push(cfg);
    if (statSync(full).isDirectory()) findTsconfigs(full, depth + 1, out);
  }
  return out;
}

const configs = [
  ...findTsconfigs(path.join(rootDir, 'packages')),
  ...findTsconfigs(path.join(rootDir, 'apps')),
].sort();

if (configs.length === 0) {
  console.error('[typecheck-all] No tsconfig.json found under packages/ or apps/');
  process.exit(1);
}

console.log(`[typecheck-all] Checking ${configs.length} projects...\n`);

const failures = [];
for (const cfg of configs) {
  const label = path.relative(rootDir, path.dirname(cfg));
  const result = spawnSync(tscBin, ['-p', cfg, '--noEmit'], {
    cwd: rootDir,
    encoding: 'utf-8',
    shell: process.platform === 'win32',
  });

  const exitCode = result.status ?? 1;
  if (exitCode !== 0) {
    failures.push({ label, output: (result.stdout || '') + (result.stderr || '') });
    console.log(`✗ ${label}`);
  } else {
    console.log(`✓ ${label}`);
  }
}

console.log('');
if (failures.length > 0) {
  for (const f of failures) {
    console.error(`\n=== FAILURES: ${f.label} ===`);
    console.error(f.output.trim());
  }
  console.error(`\n[typecheck-all] ${failures.length}/${configs.length} project(s) failed.`);
  process.exit(1);
}

console.log(`[typecheck-all] All ${configs.length} projects typecheck clean.`);
