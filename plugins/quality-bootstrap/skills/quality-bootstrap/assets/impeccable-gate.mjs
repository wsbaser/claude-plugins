#!/usr/bin/env node
// UI anti-pattern gate around `impeccable detect` (installed by quality-bootstrap, web-ui-gates.md).
//
//   node scripts/quality/impeccable-gate.mjs --report  <path...>   report findings, exit 0 (scan errors exit 1)
//   node scripts/quality/impeccable-gate.mjs --gate    <path...>   exit 1 when findings exceed the baseline
//   node scripts/quality/impeccable-gate.mjs --write-baseline <path...>   record today's findings (human, reviewed)
//
// impeccable exits 0 (clean), 2 (findings) or 1 (a target could not be scanned) and has no report-only
// flag, so this wrapper owns the policy. The baseline (docs/quality/impeccable-baseline.json) counts
// findings per anti-pattern and file; the gate fails when any count grows or a new pair appears, so
// existing debt does not block work but nothing new gets in. It runs the locally installed, pinned
// impeccable (npx --no-install), never a freshly downloaded one.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const mode = ['--report', '--gate', '--write-baseline'].find((m) => args.includes(m)) ?? '--report';
const targets = args.filter((a) => !a.startsWith('--'));
const repo = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const baselinePath = path.join(repo, 'docs/quality/impeccable-baseline.json');

if (!targets.length) {
  console.error('usage: impeccable-gate.mjs --report|--gate|--write-baseline <path...>');
  process.exit(1);
}

const run = spawnSync('npx', ['--no-install', 'impeccable', 'detect', '--json', ...targets], {
  cwd: repo,
  encoding: 'utf8',
  shell: process.platform === 'win32',
  maxBuffer: 64 << 20,
});
if (run.status !== 0 && run.status !== 2) {
  console.error(`impeccable detect failed (exit ${run.status ?? run.error?.message}):\n${run.stderr}`);
  process.exit(1);
}
let findings;
try {
  findings = JSON.parse(run.stdout || '[]');
} catch {
  console.error(`impeccable detect returned unreadable JSON:\n${run.stdout.slice(0, 500)}`);
  process.exit(1);
}

const rel = (f) => path.relative(repo, path.resolve(repo, f ?? '')).split(path.sep).join('/');
const key = (f) => `${f.antipattern}|${rel(f.file)}`;
const counts = {};
for (const f of findings) counts[key(f)] = (counts[key(f)] ?? 0) + 1;

if (mode === '--write-baseline') {
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, JSON.stringify({ tool: 'impeccable detect', counts }, null, 2) + '\n');
  console.log(`impeccable baseline: ${findings.length} finding(s) in ${Object.keys(counts).length} anti-pattern/file pair(s) → ${rel(baselinePath)}`);
  process.exit(0);
}

const baseline = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, 'utf8')).counts ?? {} : {};
const grown = Object.entries(counts).filter(([k, n]) => n > (baseline[k] ?? 0));
for (const f of findings) {
  const isNew = grown.some(([k]) => k === key(f));
  console.log(`${isNew ? 'NEW ' : '    '}${rel(f.file)}:${f.line ?? '?'} ${f.antipattern} (${f.severity}) — ${f.description ?? f.name ?? ''}`);
}
console.log(`impeccable: ${findings.length} finding(s), ${grown.length} anti-pattern/file pair(s) above baseline.`);
process.exit(mode === '--gate' && grown.length ? 1 : 0);
