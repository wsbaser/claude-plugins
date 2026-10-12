#!/usr/bin/env node
// Per-task diff check (installed by the quality-bootstrap skill).
//
//   node scripts/quality/task-diff-check.mjs --base <ref> [--files a,b/**] [--json]
//   node scripts/quality/task-diff-check.mjs --selftest
//
// Compares the working tree (committed + uncommitted + untracked) with <ref> and flags
// changes that weaken quality: deleted tests, net-removed assertions, skip/only, suppression
// comments, threshold edits, and — with --files — changes outside the task's declared files.
// Exit 1 when findings exist, 0 otherwise.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)__tests__\/|Tests?\.cs$|(^|\/)test_[^/]+\.py$|_test\.(py|go)$/;
const CONFIG_FILE = /(^|\/)(vitest|jest|playwright)\.config\.|stryker\.conf|\.nycrc|\.c8rc|codecov\.ya?ml|\.runsettings$|(^|\/)\.dependency-cruiser\.|(^|\/)knip\.|(^|\/)eslint\.config\.|(^|\/)\.eslintrc|(^|\/)tsconfig[^/]*\.json$|known-failures\.md$/;
const ASSERT = /\b(expect|assert)\s*[.(]|\bAssert\.\w+/g;
const SKIP = /\b(it|test|describe|suite)\.(skip|only|todo)\b|\b(xit|xdescribe|xtest|fit|fdescribe)\s*\(|\[(Ignore|Skip)\b|@pytest\.mark\.skip/;
const SUPPRESS = /@ts-(ignore|expect-error|nocheck)|eslint-disable|istanbul ignore|c8 ignore|v8 ignore|#pragma warning disable|noqa|type:\s*ignore|NOSONAR/;
const THRESHOLD = /threshold|thresholds|\bbreak\b|\bbranches\b|\bfunctions\b|\bstatements\b|\bstrict\w*\b|noImplicit|skipLibCheck|"rules"/;
// Files that run as code on every session or define the gates. Agents must not change them, and
// permission deny rules may be bypassed (shell edits, --dangerously-skip-permissions), so any
// change is reported here for human review.
const PROTECTED = /^(scripts\/quality\/|\.claude\/settings\.json$|\.claude\/skills\/|\.claude\/hooks\/|\.mcp\.json$|docs\/quality\/(approved\.json|policy\.md|known-failures\.md)$|\.github\/workflows\/|\.azure-pipelines\/|azure-pipelines[^/]*\.ya?ml$|\.husky\/|\.ask-jenny\/(worktree-init\.sh|workflows\/))/;

function parseArgs(argv) {
  const a = { base: null, files: null, json: false, selftest: false, cwd: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--base') a.base = argv[++i];
    else if (k === '--files') a.files = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (k === '--json') a.json = true;
    else if (k === '--selftest') a.selftest = true;
    else if (k === '--cwd') a.cwd = argv[++i];
  }
  return a;
}

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

function defaultBase(cwd) {
  for (const ref of ['origin/HEAD', 'origin/main', 'origin/master', 'main', 'master']) {
    try {
      return git(['merge-base', 'HEAD', ref], cwd).trim();
    } catch {
      /* try next */
    }
  }
  return 'HEAD';
}

function globToRe(g) {
  const esc = g
    .split('**')
    .map((part) => part.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*'))
    .join('.*');
  return new RegExp(`^${esc}$`);
}

export function analyse({ base, files, cwd }) {
  const findings = [];
  const status = git(['diff', '--name-status', '-M', base], cwd).trim().split('\n').filter(Boolean);
  const untracked = git(['ls-files', '-o', '--exclude-standard'], cwd).trim().split('\n').filter(Boolean);
  const changed = new Set(untracked);

  for (const line of status) {
    const [code, a, b] = line.split('\t');
    const file = b ?? a;
    changed.add(file);
    if (code.startsWith('D') && TEST_FILE.test(a)) findings.push({ rule: 'test-deleted', file: a });
    if (code.startsWith('D') && PROTECTED.test(a)) findings.push({ rule: 'protected-file-changed', file: a, detail: 'deleted' });
  }

  const diff = git(['diff', '-U0', '--no-color', base], cwd);
  let current = null;
  const perFile = new Map();
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) {
      current = line.slice(4).replace(/^b\//, '');
      if (!perFile.has(current)) perFile.set(current, { added: [], removed: [] });
    } else if (current && current !== '/dev/null') {
      if (line.startsWith('+') && !line.startsWith('+++')) perFile.get(current).added.push(line.slice(1));
      else if (line.startsWith('-') && !line.startsWith('---')) perFile.get(current).removed.push(line.slice(1));
    }
  }
  for (const f of untracked) {
    try {
      perFile.set(f, { added: fs.readFileSync(path.join(cwd, f), 'utf8').split('\n'), removed: [] });
    } catch {
      /* binary or vanished */
    }
  }

  for (const [file, { added, removed }] of perFile) {
    if (PROTECTED.test(file)) findings.push({ rule: 'protected-file-changed', file, detail: 'runs as code or defines a gate — needs human review' });
    // The guard scripts contain the very patterns they look for; skip their content scan.
    if (file.startsWith('scripts/quality/')) continue;
    const isTest = TEST_FILE.test(file);
    const isConfig = CONFIG_FILE.test(file);
    if (isTest) {
      const net = added.join('\n').match(ASSERT)?.length ?? 0;
      const lost = removed.join('\n').match(ASSERT)?.length ?? 0;
      if (lost > net) findings.push({ rule: 'assertions-removed', file, detail: `-${lost} +${net}` });
      for (const l of added) if (SKIP.test(l)) findings.push({ rule: 'skip-or-only-added', file, detail: l.trim() });
    }
    for (const l of added) if (SUPPRESS.test(l)) findings.push({ rule: 'suppression-added', file, detail: l.trim() });
    if (isConfig && [...added, ...removed].some((l) => THRESHOLD.test(l)))
      findings.push({ rule: 'quality-config-changed', file, detail: 'thresholds, rules or strictness edited — needs reviewer sign-off' });
  }

  if (files?.length) {
    const allowed = files.map(globToRe);
    for (const f of changed) if (!allowed.some((re) => re.test(f))) findings.push({ rule: 'outside-declared-files', file: f });
  }
  return findings;
}

function selftest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'diff-check-'));
  const run = (args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  run(['init', '-q']);
  run(['config', 'user.email', 't@t']);
  run(['config', 'user.name', 't']);
  fs.writeFileSync(path.join(dir, 'a.test.ts'), "it('x', () => {\n  expect(1).toBe(1);\n  expect(2).toBe(2);\n});\n");
  fs.writeFileSync(path.join(dir, 'b.test.ts'), "it('y', () => { expect(3).toBe(3); });\n");
  run(['add', '.']);
  run(['commit', '-qm', 'base']);
  fs.writeFileSync(path.join(dir, 'a.test.ts'), "it.skip('x', () => {\n  expect(1).toBe(1);\n});\n");
  fs.rmSync(path.join(dir, 'b.test.ts'));
  fs.writeFileSync(path.join(dir, 'src.ts'), '// @ts-ignore\nexport const z = 1;\n');
  fs.mkdirSync(path.join(dir, 'scripts', 'quality'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'scripts', 'quality', 'test-guard.mjs'), 'process.exit(0);\n');
  const rules = new Set(analyse({ base: 'HEAD', files: ['a.test.ts'], cwd: dir }).map((f) => f.rule));
  fs.rmSync(dir, { recursive: true, force: true });
  const need = ['test-deleted', 'assertions-removed', 'skip-or-only-added', 'suppression-added', 'outside-declared-files', 'protected-file-changed'];
  const missing = need.filter((r) => !rules.has(r));
  console.log(missing.length ? `selftest FAILED, missing: ${missing.join(', ')}` : 'selftest ok');
  return missing.length ? 1 : 0;
}

const args = parseArgs(process.argv.slice(2));
if (args.selftest) process.exit(selftest());
const base = args.base ?? defaultBase(args.cwd);
const findings = analyse({ base, files: args.files, cwd: args.cwd });
if (args.json) console.log(JSON.stringify({ base, findings }, null, 2));
else if (!findings.length) console.log(`task-diff-check: clean (base ${base.slice(0, 12)})`);
else {
  console.log(`task-diff-check: ${findings.length} finding(s) against ${base.slice(0, 12)}`);
  for (const f of findings) console.log(`- [${f.rule}] ${f.file}${f.detail ? ` — ${f.detail}` : ''}`);
}
process.exit(findings.length ? 1 : 0);
