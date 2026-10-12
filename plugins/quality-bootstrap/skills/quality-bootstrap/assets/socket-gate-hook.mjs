#!/usr/bin/env node
// PreToolUse(Bash) hook: Socket's install gate, minus its blanket "allow" (installed by quality-bootstrap).
//
//   .claude/settings.json → hooks.PreToolUse: [{ "matcher": "Bash", "hooks": [{ "type": "command",
//     "command": "node scripts/quality/socket-gate-hook.mjs" }] }]
//
// Runs the vendored, pinned socket-gate.cjs (from npm @socketsecurity/mcp, dist/socket-gate/) on the
// tool call. Upstream prints permissionDecision "allow" for every command it does not block, which
// Claude Code treats as approval and so skips the permission prompt for all Bash. This wrapper
// forwards only "deny"/"ask" decisions and stays silent otherwise, leaving normal permissions intact.
// It refuses to run a gate whose sha256 differs from socket-gate.sha256 (what runs is what was vetted)
// and fails open, like upstream, when the gate is missing, modified, slow or offline.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'socket-gate');
const gate = path.join(dir, 'socket-gate.cjs');
const input = fs.readFileSync(0);

function skip(reason) {
  if (reason) process.stderr.write(`socket-gate-hook: ${reason}; install check skipped\n`);
  process.exit(0);
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

const run = spawnSync(process.execPath, [gate], { input, timeout: 15000, encoding: 'utf8' });
if (run.error || run.status !== 0) skip(run.error ? run.error.message : `gate exited ${run.status}`);

let out;
try {
  out = JSON.parse(run.stdout);
} catch {
  skip(run.stdout.trim() ? 'unreadable gate output' : '');
}
const decision = out?.hookSpecificOutput?.permissionDecision;
if (decision === 'deny' || decision === 'ask') process.stdout.write(JSON.stringify(out));
if (run.stderr) process.stderr.write(run.stderr);
process.exit(0);
