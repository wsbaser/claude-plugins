#!/usr/bin/env node
// Which Ask Jenny workflows still work in this repo once its toolchain blocks plugins and skills?
// Usage: node workflow-compat.mjs <repoRoot> <workflowsDir> [<workflowsDir> ...] [--json]
//   workflowsDir: Jenny's bundled workflows and/or the repo's .ask-jenny/workflows; later dirs
//   override earlier ones by workflow id. Honors CLAUDE_CONFIG_DIR for the user's installed plugins.
//
// Every slash command a stage invokes (/plugin:name or /name) is resolved to its providers:
// installed plugins (skills/ or commands/), project skills, user skills. A workflow is usable only
// if every command has at least one provider that is enabled in this repo — effective plugin
// switches are user settings overridden by project and local settings, matched by full
// <plugin>@<marketplace> id; user skills switched off by skillOverrides and Skill() deny rules
// count as unavailable.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2).filter((a) => a !== '--json');
const asJson = process.argv.includes('--json');
const [repo, ...dirs] = args;
if (!repo || !dirs.length) {
  console.error('usage: workflow-compat.mjs <repoRoot> <workflowsDir> [...] [--json]');
  process.exit(1);
}

const home = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const readJson = (p) => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
};
const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};
const listDir = (p) => {
  try {
    return fs.readdirSync(p);
  } catch {
    return [];
  }
};

const user = readJson(path.join(home, 'settings.json'));
const project = readJson(path.join(repo, '.claude', 'settings.json'));
const local = readJson(path.join(repo, '.claude', 'settings.local.json'));
const enabled = { ...user.enabledPlugins, ...project.enabledPlugins, ...local.enabledPlugins };
const skillOverrides = { ...project.skillOverrides, ...local.skillOverrides };
const deny = [...(project.permissions?.deny ?? []), ...(local.permissions?.deny ?? [])]
  .map((d) => d.match(/^Skill\((.+?)( \*)?\)$/)?.[1])
  .filter(Boolean);
const denied = (plugin, name) => deny.some((d) => d === name || d === `${plugin}:${name}` || d === `${plugin}:*`);

// Command/skill names a plugin provides: skills/**/SKILL.md folders and commands/*.md files.
function provided(installPath) {
  const names = new Set();
  const walk = (dir, depth) => {
    for (const e of listDir(dir)) {
      const p = path.join(dir, e);
      if (!isDir(p)) continue;
      if (fs.existsSync(path.join(p, 'SKILL.md'))) names.add(e);
      else if (depth > 0) walk(p, depth - 1);
    }
  };
  walk(path.join(installPath, 'skills'), 2);
  for (const f of listDir(path.join(installPath, 'commands'))) if (f.endsWith('.md')) names.add(f.slice(0, -3));
  return names;
}

const installed = readJson(path.join(home, 'plugins', 'installed_plugins.json')).plugins ?? {};
const plugins = Object.entries(installed).map(([id, entries]) => {
  const list = Array.isArray(entries) ? entries : [entries];
  const installPath = list.find((e) => e?.installPath)?.installPath;
  return { id, name: id.split('@')[0], on: enabled[id] === true, names: installPath ? provided(installPath) : new Set() };
});
// Declared in project settings but not installed on this machine: treat as provider of its namespace.
for (const [id, on] of Object.entries(enabled)) {
  if (!plugins.some((p) => p.id === id)) plugins.push({ id, name: id.split('@')[0], on: on === true, names: null });
}
const projectSkills = new Set(listDir(path.join(repo, '.claude', 'skills')).filter((d) => isDir(path.join(repo, '.claude', 'skills', d))));
const userSkills = new Set(listDir(path.join(home, 'skills')).filter((d) => isDir(path.join(home, 'skills', d))));

function resolve(call) {
  const [ns, name] = call.includes(':') ? call.split(':') : [null, call];
  if (ns) {
    const providers = plugins.filter((p) => p.name === ns && (p.names === null || p.names.has(name)));
    if (!providers.length) return `no installed plugin ${ns} provides ${name}`;
    if (!providers.some((p) => p.on)) return `plugin ${providers.map((p) => p.id).join(', ')} disabled`;
    if (denied(ns, name)) return `Skill(${call}) denied`;
    return null;
  }
  if (projectSkills.has(name) && !denied(null, name)) return null;
  if (userSkills.has(name) && skillOverrides[name] !== 'off' && !denied(null, name)) return null;
  const fromPlugins = plugins.filter((p) => p.names?.has(name));
  if (fromPlugins.some((p) => p.on && !denied(p.name, name))) return null;
  if (fromPlugins.length) return `/${name} only provided by disabled ${fromPlugins.map((p) => p.id).join(', ')}`;
  if (userSkills.has(name)) return skillOverrides[name] === 'off' ? `user skill ${name} is off in this repo` : `Skill(${name}) denied`;
  return `no provider found for /${name}`;
}

const workflows = new Map();
for (const dir of dirs) {
  for (const f of listDir(dir).filter((x) => /\.ya?ml$/.test(x))) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    const id = text.match(/^id:\s*['"]?([^'"\n]+)/m)?.[1]?.trim() ?? f.replace(/\.ya?ml$/, '');
    const calls = [...text.matchAll(/(?:stagePrompt:\s*[|>-]*\s*|^\s+)\/([a-z0-9][\w-]*(?::[\w-]+)?)(?=[\s`'"]|$)/gim)].map((m) => m[1]);
    workflows.set(id, { id, calls: [...new Set(calls)] });
  }
}

const rows = [...workflows.values()]
  .map((w) => {
    const problems = w.calls.map((c) => [c, resolve(c)]).filter(([, r]) => r);
    return { id: w.id, usable: problems.length === 0, problems: problems.map(([c, r]) => `/${c}: ${r}`), calls: w.calls };
  })
  .sort((x, y) => Number(y.usable) - Number(x.usable) || x.id.localeCompare(y.id));

if (asJson) console.log(JSON.stringify(rows, null, 2));
else {
  console.log(`${rows.filter((r) => r.usable).length} of ${rows.length} workflows usable in this repo.\n`);
  console.log('| Workflow | Usable | Why not |\n| -------- | ------ | ------- |');
  for (const r of rows) console.log(`| ${r.id} | ${r.usable ? 'yes' : 'no'} | ${r.problems.join('; ')} |`);
}
