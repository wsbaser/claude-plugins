// Known-failures quarantine and two-way ratchet (installed by quality-bootstrap, ts-node-gates.md gate 5).
//
//   import { quarantinedFiles } from './scripts/quality/known-failures.mjs'   ← in vitest/jest config
//   node scripts/quality/known-failures.mjs --check     ← CI / quality script: run the quarantined files
//   node scripts/quality/known-failures.mjs --list      ← print quarantined files
//   node scripts/quality/known-failures.mjs --selftest
//
// The list is the table in docs/quality/known-failures.md: | File | Test | First error line | … |.
// The test runner's config excludes the listed FILES from the normal run (unless
// QUALITY_KNOWN_FAILURES=run). --check runs only those files with the runner's JSON reporter and fails when
//   - a listed test passes (fixed — a human removes the row in a reviewed commit) or no longer exists;
//   - an unlisted test in a quarantined file fails (a new failure hiding behind the quarantine).
// Supports Vitest and Jest (both emit the Jest JSON report). Runs the locally installed runner only.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LIST = 'docs/quality/known-failures.md';

/** @returns {{ file: string, test: string }[]} */
export function readKnownFailures(root = process.cwd()) {
  let text;
  try {
    text = fs.readFileSync(path.join(root, LIST), 'utf8');
  } catch {
    return [];
  }
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|') && !/^\|[\s:|-]+\|?$/.test(l))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim().replace(/^`|`$/g, '')))
    .filter((cells) => cells.length >= 2 && cells[0] && !/^file$/i.test(cells[0]))
    .map(([file, test]) => ({ file: file.split('\\').join('/'), test }));
}

/** Files to exclude from the normal test run. */
export function quarantinedFiles(root = process.cwd()) {
  if (process.env.QUALITY_KNOWN_FAILURES === 'run') return [];
  return [...new Set(readKnownFailures(root).map((k) => k.file))];
}

function detectRunner(root) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps.vitest || fs.existsSync(path.join(root, 'node_modules/vitest'))) return 'vitest';
  if (deps.jest || fs.existsSync(path.join(root, 'node_modules/jest'))) return 'jest';
  throw new Error('known-failures: neither vitest nor jest found in package.json');
}

/** Compare a Jest-format JSON report with the list. Pure, for --selftest. */
export function compare(report, listed, root) {
  const problems = [];
  const seen = new Set();
  for (const suite of report.testResults ?? []) {
    const file = path.relative(root, suite.name ?? suite.testFilePath ?? '').split(path.sep).join('/');
    for (const t of suite.assertionResults ?? []) {
      const names = [t.fullName, t.title, [...(t.ancestorTitles ?? []), t.title].join(' ')].filter(Boolean);
      const entry = listed.find((k) => k.file === file && names.includes(k.test));
      if (entry) {
        seen.add(`${entry.file}::${entry.test}`);
        if (t.status === 'passed') problems.push(`now passes — remove it from ${LIST} (reviewed commit): ${file} › ${entry.test}`);
      } else if (t.status === 'failed') {
        problems.push(`fails but is not listed (a quarantined file hides it): ${file} › ${names[0]}`);
      }
    }
  }
  for (const k of listed) if (!seen.has(`${k.file}::${k.test}`)) problems.push(`listed test not found: ${k.file} › ${k.test}`);
  return problems;
}

function check(root) {
  const listed = readKnownFailures(root);
  if (!listed.length) {
    console.log('known-failures: list is empty');
    return 0;
  }
  const files = [...new Set(listed.map((k) => k.file))];
  const runner = detectRunner(root);
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'known-failures-')), 'report.json');
  const args =
    runner === 'vitest'
      ? ['--no-install', 'vitest', 'run', '--reporter=json', `--outputFile=${out}`, ...files]
      : ['--no-install', 'jest', '--json', `--outputFile=${out}`, '--runTestsByPath', ...files];
  const r = spawnSync('npx', args, {
    cwd: root,
    env: { ...process.env, QUALITY_KNOWN_FAILURES: 'run' },
    stdio: ['ignore', 'ignore', 'inherit'],
    shell: process.platform === 'win32',
  });
  if (!fs.existsSync(out)) {
    console.error(`known-failures: ${runner} produced no report (exit ${r.status})`);
    return 1;
  }
  const problems = compare(JSON.parse(fs.readFileSync(out, 'utf8')), listed, root);
  fs.rmSync(path.dirname(out), { recursive: true, force: true });
  if (problems.length) {
    console.error('known-failures gate:\n' + problems.map((p) => `- ${p}`).join('\n'));
    return 1;
  }
  console.log(`known-failures: ${listed.length} listed test(s) still fail as recorded`);
  return 0;
}

function selftest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kf-selftest-'));
  fs.mkdirSync(path.join(root, 'docs/quality'), { recursive: true });
  fs.writeFileSync(
    path.join(root, LIST),
    '# Known failing tests\n\n| File | Test | First error line |\n| ---- | ---- | ---------------- |\n| `src/a.test.ts` | adds | expected 2 to be 3 |\n| src/b.test.ts | gone | x |\n',
  );
  const listed = readKnownFailures(root);
  const ok = [];
  ok.push(listed.length === 2 && listed[0].file === 'src/a.test.ts' && listed[0].test === 'adds');
  ok.push(JSON.stringify(quarantinedFiles(root)) === JSON.stringify(['src/a.test.ts', 'src/b.test.ts']));
  const report = {
    testResults: [
      { name: path.join(root, 'src/a.test.ts'), assertionResults: [{ title: 'adds', fullName: 'adds', status: 'passed' }, { title: 'other', fullName: 'other', status: 'failed' }] },
    ],
  };
  const problems = compare(report, listed, root);
  ok.push(problems.some((p) => p.startsWith('now passes')));
  ok.push(problems.some((p) => p.startsWith('fails but is not listed')));
  ok.push(problems.some((p) => p.startsWith('listed test not found') && p.includes('b.test.ts')));
  const still = compare({ testResults: [{ name: path.join(root, 'src/a.test.ts'), assertionResults: [{ title: 'adds', status: 'failed' }] }] }, listed.slice(0, 1), root);
  ok.push(still.length === 0);
  fs.rmSync(root, { recursive: true, force: true });
  const pass = ok.every(Boolean);
  console.log(pass ? 'selftest ok' : `selftest FAILED: ${ok.map((v, i) => (v ? '' : i)).filter((x) => x !== '').join(',')}`);
  return pass ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const mode = process.argv[2];
  if (mode === '--check') process.exit(check(root));
  else if (mode === '--list') quarantinedFiles(root).forEach((f) => console.log(f));
  else if (mode === '--selftest') process.exit(selftest());
  else {
    console.error('usage: known-failures.mjs --check | --list | --selftest');
    process.exit(1);
  }
}
