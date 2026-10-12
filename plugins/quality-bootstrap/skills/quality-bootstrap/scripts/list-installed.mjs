#!/usr/bin/env node
// List what Claude Code can load for a repo: user-enabled plugins, installed plugins and their
// skills, known marketplaces, user-level skills (symlinks followed), user MCP servers, and the
// project's own overrides. Honors CLAUDE_CONFIG_DIR.
// Usage: node list-installed.mjs [repoRoot]  → JSON. Read-only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repo = path.resolve(process.argv[2] ?? '.');
const home = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');

const readJson = (p) => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
};

const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory(); // statSync follows symlinks and junctions
  } catch {
    return false;
  }
};

// Skill folders under dir → [{ folder, name }]; name from SKILL.md frontmatter when present.
function skillsIn(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return entries
    .filter((e) => !e.startsWith('.') && isDir(path.join(dir, e)))
    .map((folder) => {
      let name = folder;
      try {
        const md = fs.readFileSync(path.join(dir, folder, 'SKILL.md'), 'utf8');
        const m = md.match(/^---[\s\S]*?^name:\s*["']?([^\n"']+)["']?\s*$/m);
        if (m) name = m[1].trim();
      } catch {
        return null; // not a skill folder
      }
      return { folder, name };
    })
    .filter(Boolean);
}

const userSettings = readJson(path.join(home, 'settings.json')) ?? {};
const projectSettings = readJson(path.join(repo, '.claude', 'settings.json')) ?? {};
const localSettings = readJson(path.join(repo, '.claude', 'settings.local.json')) ?? {};
const installed = readJson(path.join(home, 'plugins', 'installed_plugins.json'));
const knownMarketplaces = readJson(path.join(home, 'plugins', 'known_marketplaces.json'));
// With CLAUDE_CONFIG_DIR set, Claude Code keeps .claude.json inside that directory.
const claudeJson =
  readJson(process.env.CLAUDE_CONFIG_DIR ? path.join(home, '.claude.json') : path.join(os.homedir(), '.claude.json')) ?? {};

// Plugins may nest skills in category folders (skills/<category>/<skill>/SKILL.md).
function skillsDeep(dir, depth = 3) {
  const here = skillsIn(dir).map((s) => s.name);
  if (depth === 0) return here;
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return here;
  }
  const nested = entries
    .filter((e) => isDir(path.join(dir, e)) && !fs.existsSync(path.join(dir, e, 'SKILL.md')))
    .flatMap((e) => skillsDeep(path.join(dir, e), depth - 1));
  return [...new Set([...here, ...nested])].sort();
}

const pluginSkills = {};
for (const [id, entries] of Object.entries(installed?.plugins ?? {})) {
  const list = Array.isArray(entries) ? entries : [entries];
  const installPath = list.find((e) => e?.installPath)?.installPath;
  if (installPath) pluginSkills[id] = skillsDeep(path.join(installPath, 'skills'));
}

const result = {
  configDir: home,
  userEnabledPlugins: userSettings.enabledPlugins ?? {},
  installedPlugins: Object.keys(installed?.plugins ?? {}),
  pluginSkills,
  knownMarketplaces: Object.keys(knownMarketplaces ?? {}),
  userSkills: skillsIn(path.join(home, 'skills')),
  userMcpServers: Object.keys(claudeJson.mcpServers ?? {}),
  projectScopedMcpForRepo: Object.keys(claudeJson.projects?.[repo]?.mcpServers ?? {}),
  project: {
    enabledPlugins: projectSettings.enabledPlugins ?? {},
    skillOverrides: projectSettings.skillOverrides ?? {},
    deny: projectSettings.permissions?.deny ?? [],
    localEnabledPlugins: localSettings.enabledPlugins ?? {},
    localSkillOverrides: localSettings.skillOverrides ?? {},
    skills: skillsIn(path.join(repo, '.claude', 'skills')),
    mcpJsonServers: Object.keys(readJson(path.join(repo, '.mcp.json'))?.mcpServers ?? {}),
  },
};

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
