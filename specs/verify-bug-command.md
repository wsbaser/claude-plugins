# verify-bug Command

**Date**: 2026-03-13
**Status**: Draft

---

## Overview

`/wsbaser:verify-bug` is a command that takes a bug description (from argument, conversation context, or prompt), performs targeted code analysis and UI journey mapping in parallel, then runs a focused browser test to confirm or disprove the bug — concluding by invoking the `wsbaser:generate-bug-report` skill to produce a self-contained HTML report saved to `.reports/`.

---

## Requirements

### Functional Requirements

1. Accept a bug description via: (a) inline command argument, (b) reading from the current conversation context, or (c) prompting the user if neither is found.
2. Support a `--no-start` flag that skips launching the dev server (assumes the app is already running).
3. Read the dev server URL from `launchSettings.json` (same approach as `test-in-browser`) unless `--no-start` is active.
4. Launch a single headless Chrome instance on port 9222 (`chrome-1`) for browser testing.
5. Kill the Chrome instance after the test completes (using PID stored in `/tmp/chrome-verify-pid.txt`).
6. Run two parallel research agents before the browser test:
   - **Agent A** (Explore): targeted code analysis — traces the call chain for the described bug, identifies the triggering conditions, the guard (or absence of one), and proposed reproduction steps.
   - **Agent B** (Explore): app structure / UI journey mapping — identifies the exact navigation path, page URLs, and UI interactions needed to reach the state where the bug can be triggered.
7. The browser test agent derives its reproduction steps autonomously from the outputs of Agents A and B — no hardcoded steps in the command.
8. The browser test agent uses `chrome-1` exclusively and must:
   - Log in using credentials from the `App Credentials` section of `CLAUDE.local.md`, following the login shortcut pattern from `CLAUDE.md`.
   - Monitor network requests to detect relevant HTTP calls during the test.
   - Take screenshots at each meaningful step and save them to `.reports/screenshots/{slug}/`.
   - Check browser console for JavaScript errors after each significant interaction.
9. After the browser test, invoke the `wsbaser:generate-bug-report` skill (reading all collected context from the conversation) to produce `.reports/{slug}.html`.
10. The report filename slug is auto-generated from the bug description (kebab-case, 4–6 words).
11. The `.reports/screenshots/` folder is deleted after the report is generated (all screenshots are embedded as base64 in the HTML).
12. Verify Chrome MCP configuration (`chrome-1` in `~/.claude.json`) before launching, adding the entry if missing (same logic as `test-in-browser`).
13. Create `.reports/` directory and add it to `.gitignore` if not already present (same as `test-in-browser`).

### Non-Functional Requirements

1. The command must work in isolation — no dependency on `test-in-browser` infrastructure.
2. The total `allowed-tools` list in the command frontmatter must include only `chrome-1` tools (not chrome-2 through chrome-5), plus standard tools (`Agent`, `Task*`, `Bash`, `Read`, `Write`, `Glob`, `Grep`).

---

## Design Decisions

### `generate-bug-report` becomes a skill, not an agent+command pair

**Decision:** Delete `plugins/wsbaser/agents/bug-report-generator.md` and replace `plugins/wsbaser/commands/generate-bug-report.md` with a proper skill at `plugins/wsbaser/skills/generate-bug-report/SKILL.md`.

**Rationale:** A skill is loaded into conversation context and executed inline — it reads all the test data that was collected during `verify-bug` directly from context without needing a structured hand-off payload. This is simpler and more flexible than dispatching a sub-agent. It also allows the skill to be independently invoked by users who conducted manual browser testing without running `verify-bug`.

**Alternatives rejected:**
- Keep as agent — requires explicit structured prompt with all data serialized, fragile to schema mismatches
- Keep as thin command dispatching agent — extra indirection with no benefit

### Single Chrome instance (not 5)

**Decision:** Only `chrome-1` on port 9222.

**Rationale:** Bug verification is a single, focused scenario — not a multi-journey parallel test. Launching 5 instances adds startup time and resource overhead for no benefit. Chrome MCP configuration check still validates `chrome-1` is present.

**Alternatives rejected:**
- 5 instances (overkill for one scenario)
- 2 instances for test + network monitor (Chrome DevTools MCP already provides network monitoring within a single instance via `evaluate_script`)

### Two-agent parallel research (code + app structure)

**Decision:** Run an Explore agent for code analysis and a separate Explore agent for UI journey mapping in parallel.

**Rationale:** These two research tasks are independent and take roughly equal time. Parallelising them halves the pre-test wait. A DB schema agent is not needed unless the bug involves data persistence — this can be added later if required.

**Alternatives rejected:**
- One agent for everything (slower, context overload)
- Three agents matching test-in-browser (bug hunt third agent is redundant — we already know the bug we're investigating)

### Test steps derived autonomously by browser agent

**Decision:** The browser agent reads code analysis output and derives its own reproduction steps. The command does not hardcode a step template.

**Rationale:** Each bug has a different reproduction path. A dynamic approach based on code analysis produces more accurate steps tailored to the specific bug than a generic template. The code analysis agent is explicitly asked to produce a "proposed reproduction plan" that the browser agent can follow.

**Alternatives rejected:**
- User provides steps in the description (extra friction)
- Command generates a plan and asks for user approval (interrupts the automated flow)

---

## Acceptance Criteria

- [ ] Running `/wsbaser:verify-bug "DELETE fires when new invoice dialog is closed"` completes without manual intervention and produces `.reports/delete-fires-new-invoice-dialog.html`.
- [ ] Running `/wsbaser:verify-bug` with no argument and no conversation context causes the command to ask the user for the bug description before proceeding.
- [ ] With `--no-start`, the command skips server startup and proceeds directly to Chrome launch.
- [ ] The HTML report contains: verdict banner, test steps, network capture result, call chain, code snippet, findings table, and (if screenshots were taken) screenshot grid with lightbox.
- [ ] After report generation, `.reports/screenshots/` is removed and no screenshot files remain on disk.
- [ ] Chrome process is killed after the command completes.
- [ ] `chrome-1` entry is added to `~/.claude.json` if missing, and the command stops with an "ACTION REQUIRED: restart Claude Code" message.
- [ ] `/wsbaser:generate-bug-report` (the skill) can be invoked standalone after a manual browser test and produces the same HTML output.
- [ ] The old `agents/bug-report-generator.md` and the old thin `commands/generate-bug-report.md` are deleted.

---

## Files to Create / Modify / Delete

| File | Action |
|------|--------|
| `plugins/wsbaser/commands/verify-bug.md` | **Create** |
| `plugins/wsbaser/skills/generate-bug-report/SKILL.md` | **Create** |
| `plugins/wsbaser/agents/bug-report-generator.md` | **Delete** |
| `plugins/wsbaser/commands/generate-bug-report.md` | **Delete** |

---

## Open Questions

- None.
