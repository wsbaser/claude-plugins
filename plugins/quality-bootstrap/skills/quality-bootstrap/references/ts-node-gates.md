# Gates for TypeScript / Node repos

Each gate: add it, make it pass on today's code, wire it into a root script and CI, commit. "Pass" means green on the current code — fix trivial violations, baseline the rest in a file that names each item. Never add blanket `eslint-disable`, `// @ts-nocheck`, `skipLibCheck` changes or excluded folders just to go green.

Use the repo's package manager (npm / pnpm / yarn / bun) for every command below.

## 1. Lint

- ESLint flat config (`eslint.config.js` or `.mjs`) with `typescript-eslint` recommended-type-checked where type info is cheap, plain recommended otherwise. React packages: `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`.
- Cover every workspace that has source, not just the app that already had a config.
- Root script `lint` runs all of them. Existing violations: auto-fix what is safe; record the rest in `docs/quality/lint-baseline.md` per rule with a count, and use per-file overrides only for listed files.

## 2. Typecheck

- Plain workspaces: `tsc --noEmit -p <tsconfig>` for each.
- Project references / `composite: true`: `noEmit` is not allowed (TS6310). Use `tsc -b` (it emits declarations into each package's out dir, which is what referencing packages read) as the typecheck, in a script that runs before tests.
- Test files are usually excluded from the build tsconfig. Add a `tsconfig.test.json` per package (or one at the root) that extends the base, includes `src/**/*.test.ts`, sets `noEmit`, and references the package — and typecheck it too, otherwise tests are never type-checked.
- Root script `typecheck`. Shared packages consumed via built `dist/` must be built first in CI — otherwise typecheck reads stale output.
- If the build fails on missing ambient types (`@types/node`, `@types/express` …), add them as exact-version dev dependencies: that is part of making the gate pass, not a product change.

## 3. Import boundaries — dependency-cruiser

- Generate rules from the real workspace graph (`package.json` dependencies between workspaces), not from a guess:
  - `no-circular` (error)
  - `no-orphans` (warn)
  - `not-to-unresolvable`
  - for each workspace: may import only workspaces it declares as dependencies (the documented layer order, e.g. in CLAUDE.md, wins if stricter)
  - no deep imports into another workspace's `src/` — only its package entry
  - edition / feature isolation rules the repo documents (e.g. "nothing in the free edition may import hosted-only modules")
- Config `.dependency-cruiser.cjs`; root script `deps:check`. Existing violations → `--ignore-known` baseline file, listed in the report.
- Workspace imports often resolve to a package's built `dist/`; if `dist` is excluded, dependency-cruiser silently drops those edges and the layer rules check nothing. Point `options.tsConfig` at a `tsconfig.depcruise.json` whose `paths` map each workspace package name to its `src/` entry, and prove the rules bite: temporarily add a forbidden import and confirm `deps:check` fails, then revert.

## 4. Dead code — knip

- `knip` with workspace config; root script `knip`. Report-only in CI at first (`--no-exit-code`), with the current findings saved to `docs/quality/knip-baseline.md`. Gating is a later decision for the repo owner.

## 5. Test baseline

- Run the unit test suites. If tests already fail, do not fix product code and never edit the failing assertion: list each failing test in `docs/quality/known-failures.md` (file, test name, first error line) and quarantine them with the runner's mechanism (Vitest/Jest: a shared known-failures list consumed by the config's `exclude` or a skip wrapper that reads the list) so CI is green and meaningful. Mark load-sensitive tests as flaky with a re-run-once rule rather than skipping them.
- The list is a two-way ratchet: it may only shrink, and a listed test that **starts passing** must fail the gate ("remove it from known-failures.md") — otherwise fixed tests stay quarantined forever. Run the listed tests in a separate step that expects each to fail.
- It may only shrink: The test-tamper guard flags growth in a session, the diff check flags any edit to it, and layer 2 of enforcement denies agent edits to it. Removing a fixed test from the list is a human, reviewed change.

## 6. Test-tamper guard

- Copy `<skill-dir>/assets/test-guard.mjs` to `scripts/quality/test-guard.mjs`.
- Register in `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [{ "hooks": [
      { "type": "command", "command": "node scripts/quality/test-guard.mjs snapshot" },
      { "type": "command", "command": "node scripts/quality/toolchain-audit.mjs" }
    ] }],
    "Stop": [{ "hooks": [{ "type": "command", "command": "node scripts/quality/test-guard.mjs check --verify \"npm run quality\"" }] }]
  }
}
```

- It snapshots hashes and assertion counts of test files and test configs at session start, and at stop blocks once (exit 2 with the reason) if tests were deleted, assertions dropped, `.skip`/`.only`/`expect(true)` added, test selection (`include`/`exclude`/`setupFiles`) changed, the known-failures list grew, or coverage/mutation thresholds were lowered — regardless of whether the edit came from Edit/Write or a shell command.
- `--verify "<command>"` also runs the fast gates (the root `quality` script: typecheck, lint, deps, unit tests — never E2E or anything that starts servers) when files changed since the session started, and blocks once if they fail. Keep that script under ~2 minutes; drop `--verify` if it cannot be.
- A second stop in the same turn (`stop_hook_active`) only warns, so unattended runs never loop.
- Add to `CLAUDE.md`: tests are the spec; if a test or the test infrastructure looks wrong, write `BLOCKED.md` (what, why, evidence) and stop instead of changing it, unless the task explicitly is to change that test.

## 7. Per-task diff check

- Copy `<skill-dir>/assets/task-diff-check.mjs` to `scripts/quality/task-diff-check.mjs`; root script `quality:diff`.
- Usage: `node scripts/quality/task-diff-check.mjs --base <ref> [--files a,b,c]`. Flags deleted test files, added skips/only, `@ts-ignore`/`@ts-expect-error`/`eslint-disable` additions, threshold changes, and (with `--files`) changes outside the declared file list. Reviewers and workflows run it per task.

## 8. CI

- Root script `quality` runs the fast blocking gates in order (build/typecheck, lint, `deps:check`, unit tests). It is what humans, the Stop hook, harness workflows and CI all call — one definition of "green".
- GitHub Actions: one workflow `quality.yml` on pull requests and pushes to the default branch with jobs `lint`, `typecheck`, `deps`, `knip` (report), `test` (unit). Reuse the repo's existing setup action / Node version / cache if one exists.
- Azure Pipelines: equivalent stages in the existing pipeline file.
- Never start long-running servers or E2E suites in these jobs unless the repo already does so in CI.

## 9. CLAUDE.md quality section

Add (or update) a short section: the gate commands, "run them before claiming done", the BLOCKED.md rule, the approved toolchain pointer (`docs/quality/toolchain.md`), and "do not add tools outside the catalog without updating the policy". Keep it under 20 lines — CLAUDE.md is loaded into every session.
