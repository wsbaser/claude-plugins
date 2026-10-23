---
name: setup-project
description: Configure a project so Ask Jenny's workflow stages run on it safely and with the project's quality gates — worktree init script and its safety-net hook, the toolchain facts Jenny's bundled "Quality: Plan & Execute" workflow reads, coexistence with Jenny's stage hooks, workflow compatibility, ports, and a checklist for the deployed Jenny container. Use whenever a repo has (or is getting) an .ask-jenny folder and someone wants Jenny workflows to build, test and verify it correctly, a Jenny run aborts with "toolchain.md has no section ## Ask Jenny", worktrees build against stale packages, or a new project is onboarded to Ask Jenny — after (or together with) the quality-bootstrap skill.
---

# Ask Jenny project setup

Ask Jenny runs features as **workflows**: each stage is an interactive `claude` CLI session started in the feature's git worktree, with Jenny's own hooks plugin passed via `--plugin-dir` and permissions bypassed. Everything here targets that path only — Jenny's older Agent-SDK execution path (auto-mode, chat) is obsolete and must not be configured.

Because stages run the CLI with the worktree as working directory, the project's committed `.claude/settings.json`, `.claude/skills` and `CLAUDE.md` already apply to every stage. This skill adds what Jenny needs on top. Read `references/jenny-config-points.md` for where Jenny reads each file and why.

## Prerequisite

The agnostic toolchain and gates come first: `docs/quality/toolchain.md` must exist (created by the `quality-bootstrap` skill, v0.4 or later). If it does not, run that skill first, or stop and say so. Read it to learn the gate commands, the known-failures file, the guard scripts and the **Repo facts** (plans directory, security-sensitive paths, reserved ports, forbidden commands, UI themes). From v0.4.2 it also carries a placeholder `## Ask Jenny` section (`Worktree init:` none); this skill owns that section and replaces it. The workflow's planning and review stages also need `.claude/skills/plan-readiness/` and `docs/quality/interface-design.md`. If the Repo facts section or either file is missing, the repo was set up by an older bootstrap: re-run `quality-bootstrap` (its re-run adds them) rather than inventing the values here — they are facts about the repo, owned by that skill.

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

**Worktrees live inside the repo** (`.worktrees/<branch>`). Add `.worktrees/` (and Jenny's `.reports/`) to `.gitignore` and, one per line, to `docs/quality/ignored-paths.txt` — the shared ignore list every gate reads through quality-bootstrap's `gate-ignores.cjs` — otherwise the main checkout's gates lint and test every worktree copy. If the repo's gate configs do not use `gate-ignores.cjs` yet (bootstrap older than v0.4.1), add the two folders to each gate's ignore list instead (ESLint `ignores`, knip, dependency-cruiser `exclude`, test runner `exclude`) and recommend re-running quality-bootstrap.

### 3. Bundled workflow — `quality-execute-plan`

Jenny bundles the gated workflow "Quality: Plan & Execute" (`quality-execute-plan`). It is repo-agnostic: it reads every command, path and rule from `docs/quality/toolchain.md` at run time and aborts naming the section it misses. This skill ships no workflow; it makes the repo satisfy what that workflow reads.

**Find the bundled workflows.** `$ASK_JENNY_HOME/apps/server/src/workflows`, a Jenny source checkout the user names, or the deployed server's workflow directory; if none is reachable, ask once (unattended: say the checks that need it were skipped). Confirm `quality-execute-plan.yaml` is there. If it is not, this Jenny build does not bundle it: say so in the report and name the Jenny version or branch that does — never write a project copy to make up for it.

**No shadowing copy.** A project workflow with the same `id` replaces the bundled one. Older versions of this skill wrote `.ask-jenny/workflows/quality-execute-plan.yaml`; that copy is now stale and hides every fix to the bundled workflow. If it exists, propose deleting it (show `git diff --no-index` against the bundled file in the report); delete it only when the run is unattended or the user asked you to fix things, and say that you did.

**Gates run.** Run every gate command from `docs/quality/toolchain.md` once in a fresh worktree after the init script. A workflow built on gates that cannot run loops or aborts on every feature: if any gate fails for setup reasons (tool not installed, missing config, broken build), stop here, report exactly what fails, and tell the user to run or re-run `quality-bootstrap` — do not install gate tooling yourself, that skill owns it.

**Sections the workflow reads.** The Gates rows `All fast gates`, `All UI gates`, `Per-task diff check` and `Known failures ratchet`; the Repo facts rows `Reserved ports (never bind or kill)`, `Forbidden commands` and `Plans directory`; the `### Security-sensitive paths` subsection; and `## Ask Jenny` → the `- **Worktree init:**` bullet (written in step 8). A row whose value says there is none is present. If a Gates or Repo facts row is missing, re-run `quality-bootstrap`; do not invent the value here.

**Reviewers.** The review stage calls pr-review-toolkit, the built-in `/code-review` and `/security-review`, the Trail of Bits skills, and impeccable / break-ui for UI repos, and skips missing ones. Check that `docs/quality/toolchain.md` lists them and name every missing one in the report.

**Project workflows.** Validate every YAML the repo keeps in `.ask-jenny/workflows/` (a workflow pack, the project's own flows) before committing it:

```
node <skill-dir>/scripts/validate-workflow.mjs .ask-jenny/workflows/<id>.yaml [--jenny <jenny-source-root>]
```

It applies Jenny's loader rules (root fields and the description's selection clauses, stage shape, `outputs` on every stage, references and `retryTarget` only to earlier stages, `when:` grammar, output types, no unfilled placeholders). When Jenny's source is available (a checkout containing `libs/types/src/workflow.ts` with `StageDefinition`), pass `--jenny` so the keys, categories, output types and tokens are read from that source instead of the built-in copy; otherwise say in the report that the check used the built-in contract. Jenny loads project workflows when its server starts: after changing one, tell the user to restart Jenny (or reopen the project).

To use the gated flow, the user picks "Quality: Plan & Execute" for a feature or sets it as the project's preset; a bundled workflow needs no restart.

### 3b. Workflow compatibility

The toolchain switches plugins and skills off; every Jenny workflow whose stages invoke one of them (`/plugin:skill` slash commands) breaks in this repo — the stage aborts or, worse, improvises without the skill. With the bundled workflows directory from step 3, run:

```
node <skill-dir>/scripts/workflow-compat.mjs <repo> <bundled-workflows-dir> <repo>/.ask-jenny/workflows
```

Put its table in `docs/quality/toolchain.md` → "Ask Jenny" → "Workflows usable in this repo", and name in the report the workflows to use and the ones to avoid. Do not re-enable blocked tools to rescue a workflow; that is the workflow's problem to fix (migrate it to approved skills).

### 4. Hooks coexistence and trust

The hooks run committed repository code in every stage (quality-bootstrap's `enforcement.md` → "Trust boundary of the hooks"). Protect Jenny's files the way quality-bootstrap protects its own: append `.ask-jenny/worktree-init.sh` and `.ask-jenny/workflows/` to `docs/quality/protected-paths.txt` (one glob per line; the per-task diff check reads it and reports every change as `protected-file-changed` — `scripts/quality/ensure-deps.mjs` is already covered), add matching `Edit(...)` deny rules to `.claude/settings.json`, and recommend `CODEOWNERS` for them. If the repo's `task-diff-check.mjs` predates `protected-paths.txt` (no `protectedMatcher` in it), re-run quality-bootstrap to update it instead of patching it here. `ensure-deps` runs the init script only when it matches the committed version; the init script refuses paths that are not worktrees of this repository.


Jenny adds its own `Stop` and `AskUserQuestion` hooks through its plugin; the project's hooks in `.claude/settings.json` (e.g. the test-tamper guard) run alongside them. Confirm the guard is registered for `SessionStart` and `Stop`, and that it blocks at most once per turn (it reads `stop_hook_active`) — a hook that keeps blocking would stall an unattended stage until its timeout.

### 5. Enforcement under bypassed permissions

Stages run with `--dangerously-skip-permissions`. `enabledPlugins: false` and `skillOverrides: "off"` still apply; `permissions.deny` rules may not. Check from the repo root:

```
claude --dangerously-skip-permissions -p "List every skill and plugin available to you, one per line." --output-format text
```

Blocked items must be absent. If one is present only because a deny rule was ignored, switch it to `enabledPlugins`/`skillOverrides` (quality-bootstrap's enforcement reference) and re-check.

### 6. Ports

Jenny allocates dev-server ports from 3001–3099 and force-kills whatever holds a candidate port, and the developer's own Jenny server and UI listen on ports of their own (read them from that Jenny's configuration — its `PORT` setting and UI port — or ask). Make sure `docs/quality/toolchain.md` → Repo facts → "Reserved ports" lists both, with "Ask Jenny" as the user; add what is missing (that table is where every skill and workflow looks). Then scan the repo's config, scripts, `.ask-jenny/run-script.json` and any UI test server port for services pinned to a reserved port or range.

A dev server pinned inside Jenny's pool (`portMode: "fixed"` with a `fixedPort` in 3001–3099, or a hard-coded port in its start command) collides when two features run at once, and Jenny may kill whatever holds that port. Fix it when the server can take its port from outside:

- **Reads an environment variable** (e.g. `process.env.PORT`, `ASPNETCORE_URLS`/`--urls`, Vite's `--port` from a script argument): propose `"portMode": "env", "portEnvVar": "<that variable>"` (or `"portMode": "arg"` for a port argument) in `.ask-jenny/run-script.json`, dropping `fixedPort`. Show the diff in the report. Apply it only when the run is unattended or the user asked you to fix things, and say that you did; it changes the project's own config, so otherwise leave it for the user to accept.
- **Cannot** (port hard-coded in code): keep the warning and name the one-line code change that would let it read the port (e.g. `Number(process.env.PORT ?? 3005)`); do not edit product code.

Ports outside Jenny's pool that collide with other reserved ports are only reported.

### 7. Deployed Jenny container (report only)

In a deployed Jenny, user-level plugins and skills come from the container's Claude config volume (`/mnt/claude` → `~/.claude`), seeded at boot; the repo's committed `.claude/` config is honoured by every stage. List for the operator: catalog plugins that must be installed in the container's user config for the project's `enabledPlugins` to resolve — at least superpowers, feature-dev, pr-review-toolkit and the Trail of Bits skills the review stage calls (`plan-readiness` and the vendored skills travel with the repo) — and user-level skills or MCP servers there that the project cannot block.

### 8. Verify and report

- `bash -n .ask-jenny/worktree-init.sh`; run it once in a throwaway worktree (`git worktree add <tmp> HEAD`, then remove it) with `ASK_JENNY_WORKTREE_PATH` set, and confirm installs and builds succeed.
- For each project workflow, `validate-workflow.mjs` from step 3 (with `--jenny` when the source is available); paste its result line.
- The bypassed-permissions check from step 5.
- In the throwaway worktree before the init script: `node scripts/quality/ensure-deps.mjs --check` exits 1; run the hook, then `--check` exits 0.
- `git status` in the main checkout stays clean while the throwaway worktree exists.

Write the `## Ask Jenny` section of `docs/quality/toolchain.md`, replacing quality-bootstrap's placeholder (or appending it when absent; on a re-run, update it in place). Its first line under the heading is `Set up by \`setup-project\` (ask-jenny <version>).` and its first bullet is the one the bundled workflow reads, in exactly this form:

```
- **Worktree init:** `.ask-jenny/worktree-init.sh` — <what it does, verification result>
```

(`- **Worktree init:** none — <reason>` when the repo needs no init script.) Then: safety-net hook, ignored paths, the bundled workflow (present or not in the target Jenny, stale project copy removed or proposed, how to select it), project workflows and their validation result, reviewers missing for the review stage, hooks, bypassed-permissions result, ports, and the subsections "Workflows usable in this repo" (step 3b) and "Deployed Jenny container (operator checklist)" (step 7). Commit only the files you created or changed.
