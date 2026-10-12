---
name: quality-bootstrap
description: Set up a repository so AI coding agents work on it with a vetted, pinned and enforced toolchain of best-in-industry Claude Code skills, plugins and MCP servers, plus deterministic quality gates (lint, typecheck, import-boundary rules, dead-code report, test-tamper guard, per-task diff check, CI job). Use this whenever someone wants to prepare, bootstrap, harden or "make agent-ready" a project for Claude Code, choose or install the right skills/plugins for a repo, block unapproved or duplicate skills in a project, add quality gates or guardrails for unattended agent runs, or repeat an earlier toolchain setup on a new project — even if they only say "set up the tools for this repo" or "configure Claude for this project".
---

# Quality bootstrap

Prepare one repository so every agent session in it — interactive or unattended — gets the same small set of proven tools, cannot reach unapproved ones, and is held to deterministic gates it cannot talk its way past.

Why this shape: benchmarks show skills add little on engineering tasks by themselves (SkillsBench: +4.5 pp for software; 39 of 49 public SE skills gave no gain) and over-prescriptive or duplicated skills make results worse, even when loaded but unused. So the value comes from (1) few tools, one per job, each vetted; (2) everything else switched off; (3) gates that run code, not prompts. Keep that in mind when a choice is not covered below.

Scope: this repository only. Write committed project files (`.claude/settings.json`, `.claude/skills/`, `.mcp.json`, CI, `scripts/quality/`, docs). Never edit `~/.claude`, user-scoped MCP servers or other repos; list what the user should change there instead. If an agent harness runs the repo, its adapter plugin (catalog → Setup tooling) does the harness-specific part after this skill.

## Workflow

Work through the steps in order. Report progress after each step in one line.

### 1. Detect

Run `node <skill-dir>/scripts/detect-stack.mjs <repo>` and read its JSON: package manager, workspaces, languages, frameworks, test runners, CI provider, OS, existing gates, existing `.claude/` config, harness markers, and `repoFacts` candidates (glossary file, plans and ADR directories, security-sensitive paths, ports the repo binds, DESIGN.md themes). Also read `CLAUDE.md` / `AGENTS.md` and the root `package.json` scripts.

If the repo has no TypeScript/Node part, read `references/stacks.md` → the toolchain steps (2–5), the planning toolchain (6b) and the web-UI gates apply; the stack's own gate recipe may not exist yet — say so in the report.

### 2. Choose tools

Read `references/catalog.md`. Select every **core** entry, plus **conditional** entries whose condition matches the detection (UI framework, cloud, database, payments…). Respect the repo owner's exclusions: look for `docs/quality/policy.md` or a "tool policy" section in `CLAUDE.md`; if none exists, ask the user once for vendors or tools they exclude (e.g. a vendor whose cloud must not receive code) and record the answer in `docs/quality/policy.md`.

**Repo facts.** The skills and workflows this toolchain installs read a few facts about the repository instead of guessing them each run. Settle them in the same single round of questions and record them in `docs/quality/toolchain.md` → "Repo facts" (template in `assets/toolchain-template.md`):

- **Glossary** — the domain-language file (`GLOSSARY.md`, `UBIQUITOUS_LANGUAGE.md`, `CONTEXT.md`, …) or `none`; detected.
- **Plans directory** — where implementation plans and `DECISIONS.md` live; detected from existing plans, else superpowers' default `docs/superpowers/plans`. **ADR directory** — existing one, else `docs/adr`.
- **Security-sensitive paths** — globs whose changes need security review: derive them from the code (authentication and sessions, secrets and credentials, tenancy and data isolation, process spawning and shell execution, payments and billing, permission checks), show the list to the owner and record their confirmation. Unattended: record the derived list marked "unconfirmed" and say so in the report.
- **Reserved ports** — ports and ranges on developer and CI machines that this repo's scripts and tests must never bind or kill (other tools, harnesses, the developer's own servers); ask. Record also the ports the repo itself binds.
- **UI themes** — the themes `DESIGN.md` declares, or `none`.

The owner's answers win over detection. Never write these values into the plugin or the catalog; they belong to this repo.

Present the selection as a table (tool, job, why selected) before installing. Ask for confirmation only if the user has not already asked you to proceed.

### 3. Vet and pin

For each selected third-party item follow `references/vetting.md`: publisher check, registry audit, read every file through a subagent, reject runtime fetching of instructions or code, resolve and record an exact version or commit SHA. Anything that fails vetting is dropped and reported, never installed "for now".

### 4. Install project-scoped

Follow `references/enforcement.md` § Install. Plugins are declared in `.claude/settings.json` (`extraKnownMarketplaces` + `enabledPlugins`) so the user and every agent session are prompted to install the same pinned set; standalone skills are vendored into `.claude/skills/<name>/` at the pinned SHA; MCP servers go in `.mcp.json`. Merge into existing files with `node <skill-dir>/scripts/merge-json.mjs <file> <patch.json>` — never overwrite a user's settings.

### 5. Enforce

Follow `references/enforcement.md` § Block — four layers, because a project can only switch off what it names and this machine is only one of many that will open the repo:

1. **Name what is known.** Block the catalog's "Blocked identifiers" whether or not they are installed here, plus everything installed on this machine (`node <skill-dir>/scripts/list-installed.mjs`) that competes with the selection — a catalog job (planning, TDD, execution, review, debugging, interface or UI design, security review), the "Not adopted" list, unverified packs. Plugins → `enabledPlugins: false`; user skills → `skillOverrides: "off"`; unapproved user MCP servers → `permissions.deny` `mcp__<server>`. Prefer vendoring the few wanted skills of a big pack over long `Skill()` deny lists. Keep **neutral** tools (language servers, docs lookup, integrations, output styles) and the **setup tooling** (this plugin and its harness adapters, from any marketplace) and list them.
2. **Lock the gates** with `permissions.deny` on the quality scripts, gate configs, baselines, `approved.json`, CI and settings, plus `git commit --no-verify` and force-push.
3. **Audit every session**: write `docs/quality/approved.json` and register `toolchain-audit.mjs` as a SessionStart hook, so unapproved items on any machine or harness are reported to the agent and the user.
4. **Offer the machine-wide allowlist**: put the managed-settings snippet in the report for admins; never write it.

### 6. Gates (TypeScript/Node)

Follow `references/ts-node-gates.md`. In order: lint, typecheck (tests included), import boundaries (dependency-cruiser from the real workspace graph — prove a rule bites), dead code (knip, report-only), test baseline (a shrink-only known-failures list), test-tamper guard with gates-on-stop, per-task diff check, one root `quality` script, CI job. Each gate must pass on the current code before you move on: fix trivial violations (including missing `@types/*`), baseline the rest explicitly — never with blanket disables, and never by editing a failing assertion.

When detection finds a web UI, also follow `references/web-ui-gates.md` (impeccable detect, DESIGN.md lint, accessibility and screenshot tests per declared theme, on ports outside the reserved ones).

### 6b. Planning toolchain (every stack)

Plans are where most agent defects start, so the repo gets the same planning rules whatever its stack:

- Vendor the `plan-readiness` skill: copy `<skill-dir>/../plan-readiness/SKILL.md` to `.claude/skills/plan-readiness/SKILL.md` (it ships with this plugin, so no separate vetting; record the plugin version as its pin; its `evals/` folder stays behind).
- Copy `references/interface-design.md` to `docs/quality/interface-design.md`.
- Write the `CLAUDE.md` quality section from `assets/claude-md-quality.md`, filling in the gate command and the plans directory — under 20 lines, because `CLAUDE.md` loads into every session. Replace an earlier quality section rather than adding a second one.

### 7. Verify

- Run every gate locally and paste the result lines.
- Start a fresh non-interactive session in the repo (`claude -p "list the skills and plugins you can use" --output-format text` from the repo root; a session writes session files into the Claude config directory, so when the user's config must stay untouched, point `CLAUDE_CONFIG_DIR` at a temporary copy of it and delete the copy afterwards) and confirm approved tools (including `plan-readiness`) are present and blocked ones absent; then try invoking one blocked skill and confirm it is refused.
- Run `node <repo>/scripts/quality/test-guard.mjs selftest`, `node <repo>/scripts/quality/task-diff-check.mjs --selftest` and `node <repo>/scripts/quality/toolchain-audit.mjs --strict`.
- Prove the gates catch something: introduce one forbidden import, one `.skip` and one lint error on a scratch branch, confirm each is caught, then discard the branch.

### 8. Report and document

Write `docs/quality/toolchain.md` from `assets/toolchain-template.md`: the repo facts; each tool with job, stage, pinned version, scope, vetting result, how to update; the gates and how to run them; what the user must do by hand (user-scoped MCP removals, personal skills that shadow vendored ones, installs prompted on first trust, accounts); the managed-settings allowlist snippet for admins. Also write `docs/quality/approved.json`. Commit only the files you created or changed, one commit per step group (toolchain, enforcement, each gate).

End with a short summary: installed, blocked, gates added, manual actions left, anything dropped in vetting and why.

## Unattended runs

When invoked by a workflow or with "no questions", do not ask: use the recorded policy, skip optional conditional tools whose condition is ambiguous, and list every skipped decision in the report.

## Re-running

The skill is idempotent. On a repo that already has `docs/quality/toolchain.md`, compare the catalog with what is installed, propose upgrades (new pinned versions, newly added catalog entries, removed ones) and apply only what the user approves.
