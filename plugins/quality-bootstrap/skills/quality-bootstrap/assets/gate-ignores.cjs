// One ignore list for every gate that walks the tree (installed by quality-bootstrap, ts-node-gates.md).
//
//   ESLint (eslint.config.js):   import ignores from './scripts/quality/gate-ignores.cjs';  { ignores: ignores.globs() }
//   Vitest / Jest config:        exclude: [...configDefaults.exclude, ...ignores.globs()]
//   knip (knip.config.mjs/ts):   ignore: ignores.globs()
//   dependency-cruiser (.cjs):   options.exclude.path = require('./scripts/quality/gate-ignores.cjs').regex()
//
// Defaults cover build output and dependencies. Repo- or harness-specific folders (a harness's
// worktree folder, generated reports) are listed one per line in docs/quality/ignored-paths.txt, so
// adding one is a one-line change instead of an edit to four gate configs. Lines ending in "/" are
// folders; "#" starts a comment. CommonJS so both ESM configs and .cjs configs can load it.
const fs = require('node:fs');
const path = require('node:path');

const DEFAULTS = ['node_modules/', 'dist/', 'build/', 'out/', 'coverage/', '.next/', '.turbo/', '.cache/'];

function entries(root = process.cwd()) {
  let extra = [];
  try {
    extra = fs
      .readFileSync(path.join(root, 'docs/quality/ignored-paths.txt'), 'utf8')
      .split('\n')
      .map((l) => l.replace(/#.*/, '').trim())
      .filter(Boolean);
  } catch {
    /* no repo-specific entries */
  }
  return [...new Set([...DEFAULTS, ...extra])];
}

/** Glob patterns (ESLint, Vitest, Jest, knip). Folders match at any depth. */
function globs(root) {
  return entries(root).map((e) => {
    const clean = e.replace(/^\.?\//, '');
    return clean.endsWith('/') ? `**/${clean}**` : clean.includes('/') ? clean : `**/${clean}`;
  });
}

/** One regular expression source string for dependency-cruiser's exclude.path. */
function regex(root) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return entries(root)
    .map((e) => {
      const clean = e.replace(/^\.?\//, '');
      return clean.endsWith('/') ? `(^|/)${esc(clean)}` : `(^|/)${esc(clean)}$`;
    })
    .join('|');
}

module.exports = { entries, globs, regex };
module.exports.default = module.exports;
