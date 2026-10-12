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

const findings = [];

for (const [id, on] of Object.entries(plugins)) {
  if (on === true && !okPlugins.has(id))
    findings.push({ kind: 'plugin', id, fix: `"enabledPlugins": { "${id}": false } in .claude/settings.json` });
}

let userSkills = [];
try {
  userSkills = fs.readdirSync(path.join(home, 'skills')).filter((d) => !d.startsWith('.') && isDir(path.join(home, 'skills', d)));
} catch {
  /* none */
}
for (const s of userSkills) {
  if (okSkills.has(s) || skillOverrides[s] === 'off') continue;
  findings.push({ kind: 'user skill', id: s, fix: `"skillOverrides": { "${s}": "off" } in .claude/settings.json` });
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
      ...findings.map((f) => `- ${f.kind} ${f.id} — do not use it here. To block: ${f.fix}`),
      'Use only approved tools. Tell the user about these items once; do not change settings yourself unless asked.',
    ].join('\n')
  );
}
process.exit(args.has('--strict') && findings.length ? 1 : 0);
