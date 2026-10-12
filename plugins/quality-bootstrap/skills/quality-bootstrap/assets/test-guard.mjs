#!/usr/bin/env node
// Test-tamper guard for agent sessions (installed by the quality-bootstrap skill).
//
//   node scripts/quality/test-guard.mjs snapshot   ← SessionStart hook: record test state
//   node scripts/quality/test-guard.mjs check [--verify "npm run quality"]
//                                                  ← Stop hook: compare (and run gates if code
//                                                    changed), block once
//   node scripts/quality/test-guard.mjs selftest   ← verify the guard works here
//
// It compares file state, not tool calls, so edits made through shell commands are caught too.
// On findings the Stop hook exits 2 (Claude Code shows the reason to the agent and lets it
// continue). If the agent stops again in the same turn (stop_hook_active) it only warns, so
// unattended runs never loop.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TEST_FILE = [
  /\.(test|spec)\.[cm]?[jt]sx?$/,
  /(^|\/)__tests__\/.+\.[cm]?[jt]sx?$/,
  /(^|\/)[^/]*Tests?\/.+\.cs$/,
  /Tests?\.cs$/,
  /(^|\/)test_[^/]+\.py$|_test\.(py|go)$/,
];
const TEST_CONFIG = [
  /(^|\/)(vitest|jest|playwright)\.config\.[cm]?[jt]s$/,
  /(^|\/)vitest\.workspace\.[cm]?[jt]s$/,
  /(^|\/)stryker\.conf(ig)?\.([cm]?[jt]s|json)$/,
  /(^|\/)\.?stryker\.conf\.json$/,
  /(^|\/)(\.nycrc(\.json)?|\.c8rc(\.json)?|codecov\.ya?ml)$/,
  /(^|\/)docs\/quality\/known-failures\.md$/,
  /\.runsettings$/,
];
const ASSERT = /\b(expect|assert)\s*[.(]|\bAssert\.\w+|\.should\b|\btoBe\w*\(|\btoEqual\(|\btoThrow\w*\(|\btoMatch\w*\(|\btoHave\w*\(/g;
const SKIP = /\b(it|test|describe|suite)\.(skip|only|todo)\b|\b(xit|xdescribe|xtest|fit|fdescribe)\s*\(|\[(Ignore|Skip)\b|Skip\s*=\s*"|@pytest\.mark\.skip|t\.Skip\(/g;
const TRIVIAL = /expect\(\s*(true|1|!0)\s*\)\.toBe\(\s*(true|1)\s*\)|expect\(\s*true\s*\)\.toBeTruthy\(\)|Assert\.(True|IsTrue)\(\s*true\s*\)|assert\s+True\b/g;
const SELECTION_LINE = /\b(include|exclude|testMatch|testPathIgnorePatterns|testNamePattern|testRegex|projects|setupFiles)\b[^\n]*/g;
const THRESHOLD_LINE = /(threshold|thresholds|break|branches|functions|lines|statements|minimum|high|low)\b[^\n]*?(\d+(\.\d+)?)/gi;

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

function repoRoot(cwd = process.cwd()) {
  return git(['rev-parse', '--show-toplevel'], cwd).trim();
}

function gitDir(root) {
  const d = git(['rev-parse', '--git-dir'], root).trim();
  return path.isAbsolute(d) ? d : path.join(root, d);
}

function trackedAndNew(root) {
  return git(['ls-files', '-co', '--exclude-standard', '-z'], root)
    .split('\0')
    .filter(Boolean)
    .map((f) => f.split(path.sep).join('/'));
}

const count = (text, re) => (text.match(re) || []).length;

function thresholds(text) {
  const out = [];
  for (const m of text.matchAll(THRESHOLD_LINE)) out.push(`${m[1].toLowerCase()}:${m[2]}`);
  return out.sort();
}

function measure(root) {
  const state = {};
  for (const f of trackedAndNew(root)) {
    const isTest = TEST_FILE.some((r) => r.test(f));
    const isConfig = TEST_CONFIG.some((r) => r.test(f));
    if (!isTest && !isConfig) continue;
    let text;
    try {
      text = fs.readFileSync(path.join(root, f), 'utf8');
    } catch {
      continue;
    }
    state[f] = {
      kind: isTest ? 'test' : 'config',
      hash: crypto.createHash('sha1').update(text).digest('hex'),
      asserts: isTest ? count(text, ASSERT) : 0,
      skips: isTest ? count(text, SKIP) : 0,
      trivial: isTest ? count(text, TRIVIAL) : 0,
      thresholds: isConfig ? thresholds(text) : [],
      selection: isConfig ? (text.match(SELECTION_LINE) || []).map((l) => l.trim()).sort() : [],
      lines: isConfig && /known-failures/.test(f) ? text.split('\n').filter((l) => l.trim().startsWith('|') || l.trim().startsWith('-')).length : 0,
    };
  }
  return state;
}

function compare(before, after) {
  const issues = [];
  const afterHashes = new Map(Object.entries(after).map(([f, s]) => [s.hash, f]));
  for (const [f, b] of Object.entries(before)) {
    const a = after[f];
    if (!a) {
      if (!afterHashes.has(b.hash)) issues.push(`${b.kind === 'test' ? 'test file' : 'test config'} deleted: ${f}`);
      continue;
    }
    if (a.hash === b.hash) continue;
    if (b.kind === 'test') {
      if (a.asserts < b.asserts) issues.push(`assertions dropped in ${f}: ${b.asserts} → ${a.asserts}`);
      if (a.skips > b.skips) issues.push(`skip/only/todo added in ${f}: ${b.skips} → ${a.skips}`);
      if (a.trivial > b.trivial) issues.push(`always-true assertion added in ${f}`);
    } else {
      const lowered = lowerThresholds(b.thresholds, a.thresholds);
      if (lowered.length) issues.push(`threshold lowered in ${f}: ${lowered.join(', ')}`);
      else if (JSON.stringify(a.thresholds) !== JSON.stringify(b.thresholds)) issues.push(`thresholds changed in ${f}`);
      if (a.lines > b.lines) issues.push(`known-failures list grew in ${f}: ${b.lines} → ${a.lines} lines`);
      if (JSON.stringify(a.selection ?? []) !== JSON.stringify(b.selection ?? [])) issues.push(`test selection (include/exclude/setup) changed in ${f}`);
    }
  }
  for (const [f, a] of Object.entries(after)) {
    if (before[f] || a.kind !== 'test') continue;
    if (a.skips > 0) issues.push(`new test file with skip/only/todo: ${f}`);
    if (a.trivial > 0) issues.push(`new test file with always-true assertion: ${f}`);
  }
  return issues;
}

function lowerThresholds(b, a) {
  const toMap = (list) => {
    const m = new Map();
    for (const t of list) {
      const [k, v] = t.split(':');
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(Number(v));
    }
    return m;
  };
  const mb = toMap(b);
  const ma = toMap(a);
  const out = [];
  for (const [k, vals] of mb) {
    const av = ma.get(k) ?? [];
    const sumB = vals.reduce((x, y) => x + y, 0);
    const sumA = av.reduce((x, y) => x + y, 0);
    if (sumA < sumB) out.push(`${k} ${vals.join('/')} → ${av.join('/') || 'removed'}`);
  }
  return out;
}

function readHookInput() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function snapPath(root, sessionId) {
  const dir = path.join(gitDir(root), 'quality-guard');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `snapshot-${(sessionId || 'default').replace(/[^\w.-]/g, '_')}.json`);
}

function snapshot() {
  const input = readHookInput();
  const root = repoRoot(input.cwd);
  const file = snapPath(root, input.session_id);
  if (!fs.existsSync(file)) {
    let head = null;
    try {
      head = git(['rev-parse', 'HEAD'], root).trim();
    } catch {
      /* no commits yet */
    }
    fs.writeFileSync(file, JSON.stringify({ head, files: measure(root) }));
  }
  return 0;
}

// Files changed since the snapshot's HEAD (committed, staged, unstaged, untracked).
function changedSince(root, head) {
  const out = new Set();
  const add = (txt) => txt.split('\n').filter(Boolean).forEach((f) => out.add(f));
  try {
    if (head) add(git(['diff', '--name-only', head], root));
    add(git(['ls-files', '-o', '--exclude-standard'], root));
  } catch {
    /* not a git checkout */
  }
  return [...out];
}

function runVerify(root, command) {
  try {
    execFileSync(command, { cwd: root, shell: true, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: 15 * 60 * 1000 });
    return null;
  } catch (err) {
    const text = `${err.stdout ?? ''}\n${err.stderr ?? ''}`.trim().split('\n').slice(-40).join('\n');
    return text || err.message;
  }
}

function check() {
  const input = readHookInput();
  let root;
  try {
    root = repoRoot(input.cwd);
  } catch {
    return 0;
  }
  const file = snapPath(root, input.session_id);
  if (!fs.existsSync(file)) return 0;
  const snap = JSON.parse(fs.readFileSync(file, 'utf8'));
  const issues = compare(snap.files ?? snap, measure(root));

  // Optional: run the project's fast gates when code changed (--verify "<command>").
  const vi = process.argv.indexOf('--verify');
  const verifyCmd = vi > 0 ? process.argv[vi + 1] : null;
  if (verifyCmd && !input.stop_hook_active && changedSince(root, snap.head).length) {
    const failure = runVerify(root, verifyCmd);
    if (failure) issues.push(`quality gates fail (\`${verifyCmd}\`):\n${failure}`);
  }

  if (!issues.length) return 0;
  const msg =
    'Quality guard: this session left the repository in a weaker state:\n' +
    issues.map((i) => `- ${i}`).join('\n') +
    '\nFix the gate failures. Restore weakened tests unless the task explicitly requires the change; if it does, say so and why in your final message. ' +
    'If a test or the test infrastructure is wrong, write BLOCKED.md (what, why, evidence) instead of editing it.';
  process.stderr.write(msg + '\n');
  return input.stop_hook_active ? 0 : 2;
}

function selftest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-guard-'));
  const run = (args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  run(['init', '-q']);
  fs.writeFileSync(path.join(dir, 'a.test.ts'), "it('x', () => { expect(1).toBe(1); expect(2).toBe(2); });\n");
  fs.writeFileSync(path.join(dir, 'vitest.config.ts'), 'export default { test: { coverage: { thresholds: { lines: 80 } } } };\n');
  const before = measure(dir);
  fs.writeFileSync(path.join(dir, 'a.test.ts'), "it.skip('x', () => { expect(1).toBe(1); });\n");
  fs.writeFileSync(path.join(dir, 'vitest.config.ts'), 'export default { test: { coverage: { thresholds: { lines: 50 } } } };\n');
  const issues = compare(before, measure(dir));
  fs.rmSync(dir, { recursive: true, force: true });
  const ok = issues.some((i) => i.startsWith('assertions dropped')) && issues.some((i) => i.startsWith('skip/only')) && issues.some((i) => i.startsWith('threshold lowered'));
  console.log(ok ? `selftest ok (${issues.length} issues detected)` : `selftest FAILED: ${JSON.stringify(issues)}`);
  return ok ? 0 : 1;
}

function main(mode) {
  try {
    if (mode === 'snapshot') return snapshot();
    if (mode === 'check') return check();
    if (mode === 'selftest') return selftest();
    console.error('usage: test-guard.mjs snapshot|check [--verify "<command>"]|selftest');
    return 1;
  } catch (err) {
    // Never break a session because the guard itself failed; report and allow.
    process.stderr.write(`test-guard: ${err.message}\n`);
    return mode === 'selftest' ? 1 : 0;
  }
}

process.exit(main(process.argv[2]));
