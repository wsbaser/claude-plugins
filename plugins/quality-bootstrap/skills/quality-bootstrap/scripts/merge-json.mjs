#!/usr/bin/env node
// Merge a JSON patch into a JSON file without losing existing keys.
// Objects merge recursively, arrays are unioned (by JSON value), scalars from the patch win.
// Usage: node merge-json.mjs <targetFile> <patchFile | -> [--dry-run]
import fs from 'node:fs';
import path from 'node:path';

const [target, patchArg, flag] = process.argv.slice(2);
if (!target || !patchArg) {
  console.error('usage: merge-json.mjs <targetFile> <patchFile|-> [--dry-run]');
  process.exit(1);
}

const readPatch = () => (patchArg === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(patchArg, 'utf8'));
const patch = JSON.parse(readPatch());
const current = fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, 'utf8') || '{}') : {};

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function merge(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) {
    const seen = new Set(a.map((x) => JSON.stringify(x)));
    return [...a, ...b.filter((x) => !seen.has(JSON.stringify(x)))];
  }
  if (isObj(a) && isObj(b)) {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) out[k] = k in a ? merge(a[k], v) : v;
    return out;
  }
  return b;
}

const merged = merge(current, patch);
const text = JSON.stringify(merged, null, 2) + '\n';
if (flag === '--dry-run') {
  process.stdout.write(text);
} else {
  fs.mkdirSync(path.dirname(path.resolve(target)), { recursive: true });
  fs.writeFileSync(target, text);
  console.log(`merged into ${target}`);
}
