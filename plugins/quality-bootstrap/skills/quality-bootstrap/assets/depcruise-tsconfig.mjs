#!/usr/bin/env node
// Generate tsconfig.depcruise.json for dependency-cruiser (installed by quality-bootstrap, ts-node-gates.md gate 3).
//
//   node scripts/quality/depcruise-tsconfig.mjs [--check]
//
// Workspace imports usually resolve to a package's built dist/. When dist is missing or excluded,
// dependency-cruiser silently drops those edges and the layer rules check nothing. This writes a
// tsconfig whose `paths` map every workspace package name (and its "/*" subpaths) to its source entry,
// so the rules see real edges. Point `options.tsConfig.fileName` in .dependency-cruiser.cjs at it.
// --check exits 1 when the committed file is out of date (run it in CI after adding a workspace).
import fs from 'node:fs';
import path from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const out = path.join(root, 'tsconfig.depcruise.json');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

function workspaceDirs() {
  const pkg = readJson(path.join(root, 'package.json'));
  let globs = Array.isArray(pkg.workspaces) ? pkg.workspaces : (pkg.workspaces?.packages ?? []);
  const pnpm = path.join(root, 'pnpm-workspace.yaml');
  if (!globs.length && fs.existsSync(pnpm))
    globs = [...fs.readFileSync(pnpm, 'utf8').matchAll(/^\s*-\s*['"]?([^'"\n#]+)['"]?/gm)].map((m) => m[1].trim());
  const dirs = [];
  for (const g of globs.filter((x) => !x.startsWith('!'))) {
    const base = g.replace(/\/\*\*?$/, '');
    if (g.endsWith('*')) {
      let entries = [];
      try {
        entries = fs.readdirSync(path.join(root, base), { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of entries) if (e.isDirectory() && fs.existsSync(path.join(root, base, e.name, 'package.json'))) dirs.push(`${base}/${e.name}`);
    } else if (fs.existsSync(path.join(root, g, 'package.json'))) dirs.push(g);
  }
  return dirs;
}

// Source entry of a workspace: map its built entry (exports/types/main) back to src, else src/index.*.
function sourceEntry(dir) {
  const pkg = readJson(path.join(root, dir, 'package.json'));
  const exp = typeof pkg.exports === 'string' ? pkg.exports : (pkg.exports?.['.']?.import ?? pkg.exports?.['.']?.default ?? pkg.exports?.['.']);
  const built = [typeof exp === 'string' ? exp : null, pkg.types, pkg.typings, pkg.module, pkg.main].filter(Boolean);
  const candidates = [];
  for (const b of built) {
    const rel = b.replace(/^\.\//, '');
    const stem = rel.replace(/^(dist|build|lib|out)\//, 'src/').replace(/\.d\.ts$|\.(c|m)?js$/, '');
    for (const ext of ['.ts', '.tsx', '.mts', '.js', '.mjs']) candidates.push(stem + ext);
    candidates.push(rel);
  }
  for (const ext of ['.ts', '.tsx', '.mts', '.js']) candidates.push(`src/index${ext}`);
  const hit = candidates.find((c) => fs.existsSync(path.join(root, dir, c)));
  return { name: pkg.name, entry: hit ? `${dir}/${hit}` : null };
}

const paths = {};
const missing = [];
for (const dir of workspaceDirs()) {
  const { name, entry } = sourceEntry(dir);
  if (!name) continue;
  if (!entry) {
    missing.push(`${name} (${dir})`);
    continue;
  }
  paths[name] = [entry];
  paths[`${name}/*`] = [`${dir}/src/*`];
}
const base = ['tsconfig.base.json', 'tsconfig.json'].find((f) => fs.existsSync(path.join(root, f)));
const config = {
  ...(base ? { extends: `./${base}` } : {}),
  compilerOptions: { noEmit: true, composite: false, baseUrl: '.', paths },
  include: [...new Set(Object.values(paths).flat().map((p) => p.split('/src/')[0] + '/src'))],
};
const text = JSON.stringify(config, null, 2) + '\n';
if (process.argv.includes('--check')) {
  const current = fs.existsSync(out) ? fs.readFileSync(out, 'utf8').replace(/\r\n/g, '\n') : '';
  if (current !== text) {
    console.error('tsconfig.depcruise.json is out of date: run node scripts/quality/depcruise-tsconfig.mjs');
    process.exit(1);
  }
  console.log('tsconfig.depcruise.json is up to date');
} else {
  fs.writeFileSync(out, text);
  console.log(`tsconfig.depcruise.json: ${Object.keys(paths).length / 2} workspace package(s) mapped to source`);
}
if (missing.length) console.log(`not mapped (no package entry or src/index — usually apps nothing imports; map by hand if another workspace imports them): ${missing.join(', ')}`);
