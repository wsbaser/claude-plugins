---
name: jenny-workflow-setup
description: Configure a project so Ask Jenny's workflow stages run on it safely and with the project's quality gates — worktree init script, a gated "Quality: Plan & Execute" workflow in .ask-jenny/workflows, coexistence with Jenny's stage hooks, and a checklist for the deployed Jenny container. Use whenever a repo has (or is getting) an .ask-jenny folder and someone wants Jenny workflows to build, test and verify it correctly, add the quality gates to Jenny runs, fix worktrees that build against stale packages, or onboard a new project to Ask Jenny — after (or together with) the quality-bootstrap skill.
---

# Ask Jenny workflow setup

Ask Jenny runs features as **workflows**: each stage is an interactive `claude` CLI session started in the feature's git worktree, with Jenny's own hooks plugin passed via `--plugin-dir` and permissions bypassed. Everything here targets that path only — Jenny's older Agent-SDK execution path (auto-mode, chat) is obsolete and must not be configured.

Because stages run the CLI with the worktree as working directory, the project's committed `.claude/settings.json`, `.claude/skills` and `CLAUDE.md` already apply to every stage. This skill adds what Jenny needs on top. Read `references/jenny-config-points.md` for where Jenny reads each file and why.

## Prerequisite

The agnostic toolchain and gates come first: `docs/quality/toolchain.md` must exist (created by the `quality-bootstrap` skill). If it does not, run that skill first, or stop and say so. Read it to learn the gate commands, the known-failures file and the guard scripts.

## Steps

### 1. Detect

- `.ask-jenny/` exists? If not, create only what this skill writes; never invent other Jenny files.
- Stack and package manager (reuse `docs/quality/toolchain.md` or run quality-bootstrap's `detect-stack.mjs`).
- Existing `.ask-jenny/worktree-init.sh`, `.ask-jenny/run-script.json`, `.ask-jenny/workflows/*.yaml`.

### 2. Worktree init script — `.ask-jenny/worktree-init.sh`

Jenny runs this once per new feature worktree, with a minimal environment (`ASK_JENNY_PROJECT_PATH`, `ASK_JENNY_WORKTREE_PATH`, `ASK_JENNY_BRANCH`, `PATH`, `HOME` and a few toolchain variables). Without it a worktree has no dependencies, and in monorepos builds silently resolve shared packages from the main checkout — verification then passes on code that was never built.

Start from `assets/worktree-init.ts-node.sh`; fill in the install command for the package manager (frozen-lockfile form when a lockfile is committed, plain install otherwise — and say in the report that committing the lockfile makes worktrees reproducible) and the shared-package build script if the repo has one. If a script already exists, merge: keep the project's steps, add the missing install/build, never remove lines without asking. Keep it idempotent and fast; no prompts; exit non-zero on failure so Jenny shows it.

Add `*.sh text eol=lf` to `.gitattributes`: a Windows checkout with CRLF endings breaks the script under bash.

**Safety net.** Jenny runs the init script fire-and-forget (a stage can start before it finishes) and not on every path that creates a worktree. Copy `assets/ensure-deps.mjs` to `scripts/quality/ensure-deps.mjs` and register it as the **first** `SessionStart` hook in `.claude/settings.json` (`node scripts/quality/ensure-deps.mjs`). When dependencies are missing it runs the init script under a lock, so it never races a running init script; when they are present it exits immediately.

**Worktrees live inside the repo** (`.worktrees/<branch>`). Add `.worktrees/` (and Jenny's `.reports/`) to `.gitignore`, and to the ignore lists of every gate that walks the tree (ESLint `ignores`, knip, dependency-cruiser `exclude`, test runner `exclude`) — otherwise the main checkout's gates lint and test every worktree copy.

### 3. Gated workflow — `.ask-jenny/workflows/quality-execute-plan.yaml`

First run every gate command from `docs/quality/toolchain.md` once in a fresh worktree after the init script. A workflow built on gates that cannot run will loop or abort on every feature: if any gate fails for setup reasons (tool not installed, missing config, broken build), stop here, report exactly what fails, and tell the user to run or re-run `quality-bootstrap` — do not install gate tooling yourself, that skill owns it.

Then start from `assets/quality-execute-plan.yaml` and fill the placeholders from `docs/quality/toolchain.md`:

- `{{GATE_COMMANDS}}` — the root `quality` script if the repo has one (one definition of "green" for humans, hooks, CI and Jenny); otherwise the exact gate commands in run order (build of shared packages first, then typecheck, lint, import boundaries, unit tests), one per line.
- `{{EXCLUDED_COMMANDS}}` — commands verify must never run (E2E suites, anything that starts servers on fixed ports, deploys).
- `{{KNOWN_FAILURES}}` — path of the known-failures file, or `none`.
- `{{INIT_SCRIPT}}` — `.ask-jenny/worktree-init.sh`.

Leave `{{artifactHandle}}` untouched — Jenny substitutes it per feature at run time.

Use a new workflow id (`quality-execute-plan`), not an override of a bundled id: the project keeps working when Jenny updates its bundled workflows, and both remain selectable. If the user wants the gates as the default for all plan runs, tell them to pick this workflow as the project's preset in Jenny instead of overriding a bundled one.

Validate before committing: every stage has `id`, `label`, `category`, `position`, `stagePrompt`, `stageSystemPrompt`; `retryTarget` names an existing stage; inputs reference declared outputs. If Jenny's source is available (a `libs/types/src/workflow.ts` defining `StageDefinition`), check the keys against it.

Jenny loads project workflows when its server starts. Tell the user to restart Jenny (or reopen the project) after this change, and how to select the workflow.

### 3b. Workflow compatibility

The toolchain switches plugins and skills off; every Jenny workflow whose stages invoke one of them (`/plugin:skill` slash commands) breaks in this repo — the stage aborts or, worse, improvises without the skill. Find Jenny's bundled workflows: `$ASK_JENNY_HOME/apps/server/src/workflows`, a Jenny source checkout the user names, or the deployed server's workflow directory; if none is reachable, ask once (unattended: say the check was skipped). Then run:

```
node <skill-dir>/scripts/workflow-compat.mjs <repo> <bundled-workflows-dir> <repo>/.ask-jenny/workflows
```

Put its table in `docs/quality/toolchain.md` → "Ask Jenny" → "Workflows usable in this repo", and name in the report the workflows to use and the ones to avoid. Do not re-enable blocked tools to rescue a workflow; that is the workflow's problem to fix (migrate it to approved skills).

### 4. Hooks coexistence and trust

The hooks run committed repository code in every stage (quality-bootstrap's `enforcement.md` → "Trust boundary of the hooks"). Add `scripts/quality/ensure-deps.mjs`, `.ask-jenny/worktree-init.sh` and `.ask-jenny/workflows/` to the protected paths (deny rules and the diff check already cover `scripts/quality/**` and `.ask-jenny/`), and recommend `CODEOWNERS` for them. `ensure-deps` runs the init script only when it matches the committed version; the init script refuses paths that are not worktrees of this repository.


Jenny adds its own `Stop` and `AskUserQuestion` hooks through its plugin; the project's hooks in `.claude/settings.json` (e.g. the test-tamper guard) run alongside them. Confirm the guard is registered for `SessionStart` and `Stop`, and that it blocks at most once per turn (it reads `stop_hook_active`) — a hook that keeps blocking would stall an unattended stage until its timeout.

### 5. Enforcement under bypassed permissions

Stages run with `--dangerously-skip-permissions`. `enabledPlugins: false` and `skillOverrides: "off"` still apply; `permissions.deny` rules may not. Check from the repo root:

```
claude --dangerously-skip-permissions -p "List every skill and plugin available to you, one per line." --output-format text
```

Blocked items must be absent. If one is present only because a deny rule was ignored, switch it to `enabledPlugins`/`skillOverrides` (quality-bootstrap's enforcement reference) and re-check.

### 6. Ports

Jenny allocates dev-server ports from 3001–3099 and force-kills whatever holds a candidate port. Scan the repo's config, scripts and `.ask-jenny/run-script.json` for services pinned to that range and warn in the report; do not change them.

### 7. Deployed Jenny container (report only)

In a deployed Jenny, user-level plugins and skills come from the container's Claude config volume (`/mnt/claude` → `~/.claude`), seeded at boot; the repo's committed `.claude/` config is honoured by every stage. List for the operator: catalog plugins that must be installed in the container's user config for the project's `enabledPlugins` to resolve, and user-level skills or MCP servers there that the project cannot block.

### 8. Verify and report

- `bash -n .ask-jenny/worktree-init.sh`; run it once in a throwaway worktree (`git worktree add <tmp> HEAD`, then remove it) with `ASK_JENNY_WORKTREE_PATH` set, and confirm installs and builds succeed.
- Parse the workflow YAML and run the validation in step 3.
- The bypassed-permissions check from step 5.
- In the throwaway worktree before the init script: `node scripts/quality/ensure-deps.mjs --check` exits 1; run the hook, then `--check` exits 0.
- `git status` in the main checkout stays clean while the throwaway worktree exists.

Append an "Ask Jenny" section to `docs/quality/toolchain.md`: init script and safety-net hook, workflow id and how to select it, restart note, workflow compatibility table, hooks, port warnings, container checklist. Commit only the files you created or changed.
