#!/usr/bin/env node
// Toolchain audit (installed by the quality-bootstrap skill).
//
//   node scripts/quality/toolchain-audit.mjs            ← SessionStart hook: report, never block
//   node scripts/quality/toolchain-audit.mjs --strict   ← exit 1 when something unapproved is active
//   node scripts/quality/toolchain-audit.mjs --json
//
// Project settings can only switch off items they name. This audit catches what the setup run
// could not see: plugins, user skills or MCP servers installed later, on a teammate's machine or
// in a harness container. It compares what is active for this session with
// docs/quality/approved.json and tells the agent (SessionStart output becomes context) and the
// user what to do. Reads local config only; no network.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repo = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const home = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const args = new Set(process.argv.slice(2));

const readJson = (p) => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
};
const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

const approved = readJson(path.join(repo, 'docs/quality/approved.json'));
if (!approved) {
  if (args.has('--strict')) {
    console.error('toolchain-audit: docs/quality/approved.json missing');
    process.exit(1);
  }
  process.exit(0);
}

const user = readJson(path.join(home, 'settings.json')) ?? {};
const project = readJson(path.join(repo, '.claude/settings.json')) ?? {};
const local = readJson(path.join(repo, '.claude/settings.local.json')) ?? {};
const claudeJson =
  readJson(process.env.CLAUDE_CONFIG_DIR ? path.join(home, '.claude.json') : path.join(os.homedir(), '.claude.json')) ?? {};

// Effective plugin switches: user < project < local.
const plugins = { ...user.enabledPlugins, ...project.enabledPlugins, ...local.enabledPlugins };
const skillOverrides = { ...project.skillOverrides, ...local.skillOverrides };
const deny = [...(project.permissions?.deny ?? []), ...(local.permissions?.deny ?? [])];

const list = (k) => new Set(approved[k] ?? []);
const okPlugins = new Set([...list('plugins'), ...list('neutralPlugins')]);
const okSkills = new Set([...list('skills'), ...list('neutralSkills')]);
const okMcp = new Set([...list('mcpServers'), ...list('neutralMcpServers')]);
// The bootstrap's own plugin family is approved by plugin name, from any marketplace.
const setupPlugins = list('setupPlugins');
const pluginOk = (id) => okPlugins.has(id) || setupPlugins.has(id.split('@')[0]);

const findings = [];

for (const [id, on] of Object.entries(plugins)) {
  if (on === true && !pluginOk(id))
    findings.push({ kind: 'plugin', id, fix: `"enabledPlugins": { "${id}": false } in .claude/settings.json` });
}

// Version drift: project settings cannot pin a plugin version, so compare what is installed for this
// project (project-scoped entry for this repo, else the user-scoped one) with what was vetted.
// approved.json → "pluginVersions": { "<plugin>@<marketplace>": "<version or commit sha>" }.
const installed = readJson(path.join(home, 'plugins', 'installed_plugins.json'))?.plugins ?? {};
const samePath = (a, b) => path.resolve(a ?? '').toLowerCase() === path.resolve(b ?? '').toLowerCase();
for (const [id, vetted] of Object.entries(approved.pluginVersions ?? {})) {
  if (plugins[id] !== true) continue;
  const entries = Array.isArray(installed[id]) ? installed[id] : installed[id] ? [installed[id]] : [];
  const entry = entries.find((e) => e.scope === 'project' && samePath(e.projectPath, repo)) ?? entries.find((e) => e.scope === 'user') ?? entries[0];
  if (!entry) continue;
  const have = [entry.version, entry.gitCommitSha].filter((v) => v && v !== 'unknown');
  const matches = have.some((v) => v === vetted || (vetted.length >= 7 && v.startsWith(vetted)) || (v.length >= 7 && vetted.startsWith(v)));
  if (have.length && !matches)
    findings.push({ kind: 'plugin version', id, fix: `installed ${have[0]}, vetted ${vetted} — re-run quality-bootstrap to review the new version (or reinstall the vetted one)` });
}

let userSkills = [];
try {
  userSkills = fs.readdirSync(path.join(home, 'skills')).filter((d) => !d.startsWith('.') && fs.existsSync(path.join(home, 'skills', d, 'SKILL.md')));
} catch {
  /* none */
}
const vendored = new Set(
  (() => {
    try {
      return fs.readdirSync(path.join(repo, '.claude/skills')).filter((d) => isDir(path.join(repo, '.claude/skills', d)));
    } catch {
      return [];
    }
  })(),
);
for (const s of userSkills) {
  // A personal skill named like a vendored one shadows it; skillOverrides would switch off both.
  if (vendored.has(s)) {
    findings.push({ kind: 'user skill', id: s, fix: `remove or rename ~/.claude/skills/${s} — it shadows the vendored .claude/skills/${s}` });
    continue;
  }
  if (okSkills.has(s) || skillOverrides[s] === 'off') continue;
  findings.push({ kind: 'user skill', id: s, fix: `"skillOverrides": { "${s}": "off" } in .claude/settings.json` });
}

// Personal slash commands (~/.claude/commands/**.md, namespaced by folder) are invoked like skills.
const userCommands = [];
const walkCommands = (dir, ns) => {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) walkCommands(path.join(dir, e.name), ns ? `${ns}:${e.name}` : e.name);
    else if (e.name.endsWith('.md')) userCommands.push(ns ? `${ns}:${e.name.slice(0, -3)}` : e.name.slice(0, -3));
  }
};
walkCommands(path.join(home, 'commands'), '');
for (const c of userCommands) {
  if (okSkills.has(c) || skillOverrides[c] === 'off') continue;
  findings.push({ kind: 'user command', id: c, fix: `"skillOverrides": { "${c}": "off" } in .claude/settings.json` });
}

for (const server of Object.keys(claudeJson.mcpServers ?? {})) {
  if (okMcp.has(server) || deny.includes(`mcp__${server}`)) continue;
  findings.push({ kind: 'user MCP server', id: server, fix: `"permissions": { "deny": ["mcp__${server}"] } in .claude/settings.json, or remove it with /mcp` });
}

if (args.has('--json')) {
  console.log(JSON.stringify({ findings }, null, 2));
} else if (findings.length) {
  console.log(
    [
      `Toolchain audit: ${findings.length} item(s) are active in this session but not approved for this repository (docs/quality/toolchain.md):`,
      ...findings.map((f) =>
        f.kind === 'plugin version' ? `- plugin ${f.id} is not the vetted version: ${f.fix}` : `- ${f.kind} ${f.id} — do not use it here. To block: ${f.fix}`,
      ),
      'Use only approved tools. Tell the user about these items once; do not change settings yourself unless asked.',
    ].join('\n')
  );
}
process.exit(args.has('--strict') && findings.length ? 1 : 0);
