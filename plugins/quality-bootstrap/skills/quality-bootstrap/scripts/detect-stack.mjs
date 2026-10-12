#!/usr/bin/env node
// Detect the stack, workspaces, gates and agent config of a repository.
// Usage: node detect-stack.mjs [repoRoot]  → prints JSON to stdout. Read-only.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? '.');
const IGNORE = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'bin', 'obj', '.worktrees', '.next', 'coverage']);

const exists = (p) => fs.existsSync(path.join(root, p));
const readJson = (p) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
  } catch {
    return null;
  }
};

function walk(dir, depth, out) {
  if (depth < 0) return out;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (IGNORE.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, depth - 1, out);
    else out.push(path.relative(root, full).split(path.sep).join('/'));
  }
  return out;
}

const files = walk(root, 4, []);
const has = (re) => files.some((f) => re.test(f));
const pkg = readJson('package.json');

const packageManager = exists('pnpm-lock.yaml')
  ? 'pnpm'
  : exists('yarn.lock')
    ? 'yarn'
    : exists('bun.lockb') || exists('bun.lock')
      ? 'bun'
      : pkg
        ? 'npm'
        : null;

let workspaces = [];
const wsField = pkg?.workspaces;
const wsGlobs = Array.isArray(wsField) ? wsField : (wsField?.packages ?? []);
for (const g of wsGlobs) {
  const base = g.replace(/\/\*+$/, '');
  if (g.endsWith('*')) {
    try {
      for (const d of fs.readdirSync(path.join(root, base), { withFileTypes: true })) {
        if (d.isDirectory() && exists(`${base}/${d.name}/package.json`)) workspaces.push(`${base}/${d.name}`);
      }
    } catch {
      /* missing folder */
    }
  } else if (exists(`${g}/package.json`)) workspaces.push(g);
}

const allPkgs = [pkg, ...workspaces.map((w) => readJson(`${w}/package.json`))].filter(Boolean);
const deps = new Set(
  allPkgs.flatMap((p) => Object.keys({ ...p.dependencies, ...p.devDependencies, ...p.peerDependencies }))
);
const dep = (name) => deps.has(name);
const depMatch = (re) => [...deps].some((d) => re.test(d));

const result = {
  root,
  os: process.platform,
  node: process.version,
  packageManager,
  workspaces,
  languages: {
    typescript: has(/(^|\/)tsconfig[^/]*\.json$/) || dep('typescript'),
    javascript: !!pkg,
    dotnet: has(/\.(sln|slnx|csproj|fsproj)$/),
    python: has(/(^|\/)(pyproject\.toml|requirements\.txt)$/),
    go: has(/(^|\/)go\.mod$/),
  },
  frameworks: {
    react: dep('react'),
    vite: dep('vite'),
    next: dep('next'),
    electron: dep('electron'),
    express: dep('express'),
    fastify: dep('fastify'),
    tailwind: dep('tailwindcss'),
    shadcn: has(/(^|\/)components\.json$/),
    blazor: has(/\.razor$/),
  },
  data: {
    postgres: dep('pg') || dep('postgres') || depMatch(/^@neondatabase\//),
    kysely: dep('kysely'),
    prisma: dep('prisma') || dep('@prisma/client'),
    drizzle: dep('drizzle-orm'),
    sqlite: dep('better-sqlite3') || dep('sqlite3'),
  },
  services: {
    stripe: dep('stripe') || dep('@stripe/stripe-js'),
    azure: has(/\.bicep$/) || exists('azure.yaml') || depMatch(/^@azure\//),
    kubernetes: has(/(^|\/)(Chart\.yaml|kustomization\.ya?ml)$/),
  },
  tests: {
    vitest: dep('vitest'),
    jest: dep('jest'),
    playwright: dep('@playwright/test'),
    stryker: depMatch(/^@stryker-mutator\//),
  },
  ui: dep('react') || dep('vue') || dep('svelte') || has(/\.razor$/),
  charts: depMatch(/^(recharts|chart\.js|@nivo\/|d3|echarts|victory)/),
  gates: {
    eslintConfigs: files.filter((f) => /(^|\/)(eslint\.config\.[cm]?[jt]s|\.eslintrc(\.[a-z]+)?)$/.test(f)),
    tsconfigs: files.filter((f) => /(^|\/)tsconfig\.json$/.test(f)),
    dependencyCruiser: has(/(^|\/)\.dependency-cruiser\.[cm]?js$/),
    knip: has(/(^|\/)knip\.json[c]?$|(^|\/)knip\.config\.[cm]?[jt]s$/),
    prettier: has(/(^|\/)\.prettierrc/) || dep('prettier'),
    husky: exists('.husky'),
    scripts: pkg?.scripts ?? {},
  },
  ci: {
    github: exists('.github/workflows'),
    azurePipelines: has(/(^|\/)azure-pipelines[^/]*\.ya?ml$/) || exists('.azure-pipelines'),
    gitlab: exists('.gitlab-ci.yml'),
  },
  agentConfig: {
    claudeMd: exists('CLAUDE.md'),
    agentsMd: exists('AGENTS.md'),
    projectSettings: readJson('.claude/settings.json'),
    projectSkills: (() => {
      try {
        return fs.readdirSync(path.join(root, '.claude/skills'));
      } catch {
        return [];
      }
    })(),
    mcpJson: readJson('.mcp.json'),
    qualityDocs: exists('docs/quality/toolchain.md'),
    policy: exists('docs/quality/policy.md'),
  },
  harness: {
    // Root folders that agent harnesses keep their per-project config in; their adapter plugins act on them.
    configDirs: ['.ask-jenny', '.cursor', '.windsurf', '.continue', '.aider'].filter(exists),
  },
  repoFacts: repoFacts(),
};

// Candidates only: the skill confirms them with the owner and records them in docs/quality/toolchain.md.
function repoFacts() {
  const glossary =
    ['GLOSSARY.md', 'UBIQUITOUS_LANGUAGE.md', 'CONTEXT.md', 'docs/GLOSSARY.md', 'docs/UBIQUITOUS_LANGUAGE.md', 'docs/CONTEXT.md'].find(exists) ?? null;
  const dirsOf = (re) => [...new Set(files.filter((f) => re.test(f)).map((f) => f.slice(0, f.lastIndexOf('/'))))];
  const plansDirs = dirsOf(/(^|\/)plans\/[^/]+\.md$/);
  const adrDirs = dirsOf(/(^|\/)(adr|adrs|decisions)\/\d{3,4}-[^/]+\.md$/);
  const sensitive =
    /(^|[\/._-])(auth\w*|login|sessions?|oauth|jwt|tokens?|secrets?|credentials?|crypto|tenan\w*|rbac|acl|permissions?|billing|payments?|stripe|checkout|spawn\w*|exec\w*|pty|shell|process\w*|terminals?|sandbox\w*)([\/._-]|$)/i;
  const dirOf = (f) => (f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '');
  // Tracked files only (all depths) when this is a git repo: runtime data and build output are not code to review.
  let tracked = files;
  try {
    tracked = execFileSync('git', ['-C', root, 'ls-files'], { encoding: 'utf8', maxBuffer: 64 << 20 }).split('\n').filter(Boolean);
  } catch {
    /* not a git repo */
  }
  const securityCandidates = [
    ...new Set(
      tracked
        .filter((f) => !/(^|\/)(docs?|tests?|__tests__|fixtures?|\.[^/]+)\//i.test(f) && !/\.(md|json|lock|ya?ml|txt)$/i.test(f))
        .filter((f) => sensitive.test(f))
        .map((f) => (sensitive.test(dirOf(f)) ? `${dirOf(f)}/**` : f)),
    ),
  ].slice(0, 40);
  const ports = new Set();
  const portFiles = files.filter((x) =>
    /(vite|playwright|vitest|webpack|next|nuxt|astro)\.config\.[cm]?[jt]s$|launchSettings\.json$|docker-compose[^/]*\.ya?ml$|(^|\/)package\.json$|(^|\/)\.env(\.[a-z]+)?$/.test(x),
  );
  for (const f of portFiles) {
    let text = '';
    try {
      text = fs.readFileSync(path.join(root, f), 'utf8');
    } catch {
      continue;
    }
    for (const m of text.matchAll(/(?:\bport["']?\s*[:=]\s*["']?|--port[ =]|localhost:|127\.0\.0\.1:|\bPORT=)(\d{2,5})/gi)) ports.add(`${m[1]} (${f})`);
  }
  const designMd = ['DESIGN.md', 'docs/DESIGN.md'].find(exists) ?? null;
  let themes = null;
  if (designMd) {
    // DESIGN.md has no standard theme key; report theme names mentioned next to theme/mode/scheme for the owner to confirm.
    const text = fs.readFileSync(path.join(root, designMd), 'utf8');
    const lines = text.split('\n').filter((l) => /\b(theme|mode|scheme)s?\b/i.test(l));
    themes = [...new Set(lines.flatMap((l) => [...l.matchAll(/\b(light|dark|high[- ]contrast|dim)\b/gi)].map((m) => m[1].toLowerCase())))];
  }
  return { glossary, plansDirs, adrDirs, securityCandidates, portsBound: [...ports].slice(0, 30), designMd, themes };
}

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
