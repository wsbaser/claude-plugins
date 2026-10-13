#!/usr/bin/env node
// PreToolUse(Bash) hook: Socket's install gate, minus its blanket "allow" (installed by quality-bootstrap).
//
//   .claude/settings.json → hooks.PreToolUse: [{ "matcher": "Bash", "hooks": [{ "type": "command",
//     "command": "node scripts/quality/socket-gate-hook.mjs" }] }]
//   node scripts/quality/socket-gate-hook.mjs --packages "<command>"   ← print the packages it would check
//
// Runs the vendored, pinned socket-gate.cjs (from npm @socketsecurity/mcp, dist/socket-gate/) on the
// tool call. Upstream prints permissionDecision "allow" for every command it does not block, which
// Claude Code treats as approval and so skips the permission prompt for all Bash. This wrapper
// forwards only "deny"/"ask" decisions and stays silent otherwise, leaving normal permissions intact.
//
// Upstream checks only the first word after install/add, so `npm i -D x` checks "-D" and
// `npm install a b` never checks b. This wrapper splits the command (&&, ||, ;, |, newlines), finds
// every install/add segment, drops flags and their values, and asks the gate about each package
// separately with a normalised `<manager> <verb> <package>` command. Any deny denies the command.
//
// It refuses to run a gate whose sha256 differs from socket-gate.sha256 (what runs is what was vetted)
// and fails open, like upstream, when the gate is missing, modified, slow or offline.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_PACKAGES = 12;
// Install verbs per package manager; `prefix` is how many tokens form "<manager> <verb>".
const MANAGERS = [
  { re: /^(npm|pnpm|bun)$/, verbs: ['i', 'install', 'add'] },
  { re: /^yarn$/, verbs: ['add'] },
  { re: /^(pip|pip3)$/, verbs: ['install'] },
  { re: /^uv$/, verbs: ['add'], sub: { pip: ['install'] } },
  { re: /^poetry$/, verbs: ['add'] },
  { re: /^pipenv$/, verbs: ['install'] },
  { re: /^cargo$/, verbs: ['add', 'install'] },
  { re: /^gem$/, verbs: ['install'] },
  { re: /^bundle$/, verbs: ['add'] },
  { re: /^go$/, verbs: ['get', 'install'] },
  { re: /^nuget$/, verbs: ['install'] },
];
// Flags whose next token is a value, not a package.
const VALUE_FLAGS = new Set([
  '--registry', '--tag', '--prefix', '--cwd', '--filter', '-F', '--workspace', '-C', '--dir',
  '-r', '--requirement', '-c', '--constraint', '-i', '--index-url', '--extra-index-url', '--target', '-t',
  '--version', '--source', '-s', '--framework', '-f', '--package-directory', '--git', '--path', '--branch', '--rev',
  '--features', '--group', '-G', '--python', '-p', '--OutputDirectory', '-o',
]);

function tokens(segment) {
  return [...segment.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
}

// → [{ command: '<manager> <verb> <pkg>', pkg }]
export function installTargets(command) {
  const out = [];
  for (const segment of command.split(/&&|\|\||[;|\n]/)) {
    let t = tokens(segment).filter((x) => !/^[A-Z_][A-Z0-9_]*=/.test(x)); // drop leading VAR=value
    while (['sudo', 'npx', 'exec', 'env', 'command', 'time'].includes(t[0])) t = t.slice(1);
    if (/^python[\d.]*$/.test(t[0] ?? '') && t[1] === '-m') t = t.slice(2);
    let prefix;
    let rest;
    if (t[0] === 'dotnet' && t[1] === 'add') {
      const i = t.indexOf('package');
      if (i > 0 && t[i + 1]) out.push({ command: `dotnet add package ${t[i + 1]}`, pkg: t[i + 1] });
      continue;
    }
    const m = MANAGERS.find((x) => x.re.test(t[0] ?? ''));
    if (!m) continue;
    // Skip global options between the manager and its verb (e.g. `pnpm -w add x`, `npm --silent i x`).
    let v = 1;
    while (t[v]?.startsWith('-')) v += VALUE_FLAGS.has(t[v]) ? 2 : 1;
    if (m.sub?.[t[v]] && m.sub[t[v]].includes(t[v + 1])) {
      prefix = `${t[0]} ${t[v]} ${t[v + 1]}`;
      rest = t.slice(v + 2);
    } else if (m.verbs.includes(t[v])) {
      prefix = `${t[0]} ${t[v]}`;
      rest = t.slice(v + 1);
    } else continue;
    for (let k = 0; k < rest.length; k++) {
      const a = rest[k];
      if (a.startsWith('-')) {
        if (VALUE_FLAGS.has(a)) k++;
        continue;
      }
      // Local paths, URLs, VCS specs and requirement files are not registry packages.
      if (/^(\.{1,2}[\\/]|[\\/]|~|[a-z]:[\\/]|file:|git\+|git:|https?:|link:|workspace:)/i.test(a) || /\.(txt|toml|lock|whl|tgz|tar\.gz)$/i.test(a)) continue;
      out.push({ command: `${prefix} ${a}`, pkg: a });
    }
  }
  return out;
}

const args = process.argv.slice(2);
if (args[0] === '--packages') {
  console.log(JSON.stringify(installTargets(args.slice(1).join(' ')).map((x) => x.pkg)));
  process.exit(0);
}

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'socket-gate');
const gate = path.join(dir, 'socket-gate.cjs');
const raw = fs.readFileSync(0, 'utf8');

function skip(reason) {
  if (reason) process.stderr.write(`socket-gate-hook: ${reason}; install check skipped\n`);
  process.exit(0);
}

let call;
try {
  call = JSON.parse(raw);
} catch {
  skip('unreadable hook input');
}
const command = call?.tool_input?.command;
if (typeof command !== 'string') process.exit(0);
let targets = installTargets(command);
if (!targets.length) process.exit(0);
if (targets.length > MAX_PACKAGES) {
  process.stderr.write(`socket-gate-hook: ${targets.length} packages in one command; checking the first ${MAX_PACKAGES}\n`);
  targets = targets.slice(0, MAX_PACKAGES);
}

let expected = '';
try {
  expected = fs.readFileSync(path.join(dir, 'socket-gate.sha256'), 'utf8').trim().split(/\s+/)[0];
} catch {
  skip('socket-gate.sha256 missing');
}
let actual = '';
try {
  // Hash with LF line endings so a CRLF checkout (core.autocrlf) of the same bundle still matches.
  actual = crypto.createHash('sha256').update(fs.readFileSync(gate, 'utf8').replace(/\r(?=\n|$)/g, '')).digest('hex');
} catch {
  skip('socket-gate.cjs missing');
}
if (actual !== expected) skip('socket-gate.cjs does not match its recorded sha256');

for (const t of targets) {
  const input = JSON.stringify({ ...call, tool_input: { ...call.tool_input, command: t.command } });
  const run = spawnSync(process.execPath, [gate], { input, timeout: 15000, encoding: 'utf8' });
  if (run.stderr) process.stderr.write(run.stderr);
  if (run.error || run.status !== 0) {
    process.stderr.write(`socket-gate-hook: ${t.pkg} not checked (${run.error ? run.error.message : `gate exited ${run.status}`})\n`);
    continue;
  }
  let out;
  try {
    out = JSON.parse(run.stdout);
  } catch {
    continue;
  }
  const decision = out?.hookSpecificOutput?.permissionDecision;
  if (decision === 'deny' || decision === 'ask') {
    process.stdout.write(JSON.stringify(out));
    process.exit(0);
  }
}
process.exit(0);
