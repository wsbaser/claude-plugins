#!/usr/bin/env node
// Ensure a worktree has its dependencies before an agent session works in it
// (installed by the jenny-workflow-setup skill; SessionStart hook).
//
// Ask Jenny runs .ask-jenny/worktree-init.sh fire-and-forget and does not run it for every way a
// worktree can be created, so a workflow stage can start in a worktree with no node_modules —
// where builds silently resolve packages from the main checkout. This hook closes that gap:
// if the install marker is missing it runs the init script (or the install command) under a
// lock, so it never races a concurrently running init script.
//
//   node scripts/quality/ensure-deps.mjs            ← SessionStart hook
//   node scripts/quality/ensure-deps.mjs --check    ← exit 1 if dependencies are missing
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {
    return process.cwd();
  }
})();

const installed = () => fs.existsSync(path.join(root, 'node_modules', '.package-lock.json')) || fs.existsSync(path.join(root, 'node_modules', '.modules.yaml')) || fs.existsSync(path.join(root, 'node_modules', '.yarn-state.yml'));

if (process.argv.includes('--check')) process.exit(installed() ? 0 : 1);
if (installed()) process.exit(0);

const lock = path.join(root, '.ask-jenny', '.deps.lock');
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const deadline = Date.now() + 15 * 60 * 1000;

// Acquire the lock (exclusive create). Stale locks older than 20 minutes are broken.
for (;;) {
  try {
    fs.mkdirSync(path.dirname(lock), { recursive: true });
    fs.writeFileSync(lock, String(process.pid), { flag: 'wx' });
    break;
  } catch {
    if (installed()) process.exit(0); // someone else finished meanwhile
    try {
      if (Date.now() - fs.statSync(lock).mtimeMs > 20 * 60 * 1000) fs.rmSync(lock, { force: true });
    } catch {
      /* lock vanished */
    }
    if (Date.now() > deadline) {
      console.log('ensure-deps: timed out waiting for another install; dependencies may be missing.');
      process.exit(0);
    }
    sleep(2000);
  }
}

try {
  if (installed()) process.exit(0);
  const init = path.join(root, '.ask-jenny', 'worktree-init.sh');
  // Run the init script only as committed: a version modified in this worktree (e.g. by an
  // agent) is never executed by this hook.
  const pristine = (() => {
    try {
      execFileSync('git', ['ls-files', '--error-unmatch', '.ask-jenny/worktree-init.sh'], { cwd: root, stdio: 'ignore' });
      execFileSync('git', ['diff', '--quiet', 'HEAD', '--', '.ask-jenny/worktree-init.sh'], { cwd: root, stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  })();
  console.log('ensure-deps: dependencies missing in this worktree — installing before work starts.');
  const env = { ...process.env, ASK_JENNY_WORKTREE_PATH: root };
  let r;
  if (fs.existsSync(init) && pristine) r = spawnSync('bash', [init], { cwd: root, env, stdio: 'inherit' });
  else {
    if (fs.existsSync(init)) console.log('ensure-deps: .ask-jenny/worktree-init.sh differs from the committed version — not running it; using the lockfile install instead.');
    const lockfile = ['package-lock.json', 'npm-shrinkwrap.json'].some((f) => fs.existsSync(path.join(root, f)));
    r = spawnSync('npm', [lockfile ? 'ci' : 'install', '--ignore-scripts'], { cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32' });
  }
  if (r.status !== 0) console.log('ensure-deps: install failed — builds and tests in this worktree are not trustworthy until it succeeds.');
} finally {
  fs.rmSync(lock, { force: true });
}
process.exit(0);
