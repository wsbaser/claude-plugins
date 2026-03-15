---
description: Comprehensive E2E browser testing — parallel codebase research, 5 isolated Playwright CLI sessions, screenshots, DB validation, and HTML report
allowed-tools: Agent,
  Task,
  TaskCreate,
  TaskGet,
  TaskList,
  TaskOutput,
  TaskStop,
  TaskUpdate,
  Bash,
  Read,
  Write,
  Glob,
  Grep,
  WebFetch
---

# End-to-End Application Testing (Playwright CLI)

## Flags

- **`--responsive`** — Also run responsive testing across Mobile (375x812), Tablet (768x1024), and Desktop (1440x900) viewports. Without this flag, only desktop viewport is used.
- **`--headed`** — Run browsers in headed (visible) mode. Useful for watching test execution in real time. When passed, all `playwright-cli` commands will include the `--headed` flag.

## Pre-flight: Intent Analysis

Before any other pre-flight steps, analyze the user's intent to determine the appropriate testing mode. This determines research depth and execution approach.

### Context Gathering

Run the following commands to collect git context before analyzing the prompt:

```bash
git branch --show-current
git log --oneline -5
```

If `git branch --show-current` returns an empty string (detached HEAD), treat the branch as unclassified and do not apply the feature-branch heuristic.

Use this context when the prompt contains no explicit mode indicator — if you're on a feature branch (not `main`, `master`, `develop`, or similar) and the request is ambiguous (no mode keyword), default to verifying the current branch's changes rather than the whole application. Use the recent commit messages to infer the target area for FOCUSED mode when no area is explicitly named.

### Mode Detection

Analyze the invocation prompt/args to detect the testing mode:

| Mode | Indicators | Research | Execution |
|------|------------|----------|-----------|
| **SMOKE** | "smoke test", "quick test", "sanity check", "just verify", "basic check", "fast check" | Skip all | Single pass with UI discovery |
| **FOCUSED** | "verify [feature]", "test the [X]", "check if [Y] works", "test [component]", "validate [area]" | Targeted only on mentioned area | Test that area + direct dependencies |
| **CUSTOM** | Inline scenarios (comma-separated) OR file path (`.json`, `.md`, `.txt`, `.yaml`, `.yml`) OR explicit context reference ("use the scenarios above") | Skip all | Run provided scenarios |
| **FULL** | No indicators OR "comprehensive", "full regression", "complete test", "all scenarios" | All 3 agents | Complete testing |

### Detection Logic

1. **Check for SMOKE indicators** — if any smoke test phrases are present, set `TESTING_MODE = SMOKE`.
2. **Check for CUSTOM sources** — look for:
   - Inline scenarios: comma-separated items that describe test journeys
   - File path: ends in `.json`, `.md`, `.txt`, `.yaml`, `.yml`
   - Context reference: "use the scenarios above", "run the scenarios we discussed"
   - If found, read file if needed, extract scenarios, set `TESTING_MODE = CUSTOM` and store `SCENARIO_LIST`.
3. **Check for FOCUSED indicators** — if prompt mentions testing/verifying/checking a specific feature, component, or area (but not smoke or custom), set `TESTING_MODE = FOCUSED` and store `TARGET_AREA`.
4. **Default to FULL** — if no other mode matches, set `TESTING_MODE = FULL`.

### Mode Output

Print the detected mode and key details:

```
═══════════════════════════════════════════════════════
 Testing Mode: [SMOKE | FOCUSED | CUSTOM | FULL]
═══════════════════════════════════════════════════════
 [Mode-specific details:]
 SMOKE:    Skipping research, quick UI verification
 FOCUSED:  Target: [feature/area name]
 CUSTOM:   N predefined scenario(s) loaded
 FULL:     Complete research + all journeys
═══════════════════════════════════════════════════════
```

### Scenario Confirmation

Before proceeding, derive the scenario list from the detected mode:

- **SMOKE** — one scenario: "Smoke pass: navigate app, verify key UI elements load without errors"
- **FOCUSED** — one scenario per logical area implied by `TARGET_AREA` (usually 1–3)
- **CUSTOM** — the loaded `SCENARIO_LIST`
- **FULL** — scenarios will be defined after research; skip confirmation and proceed directly

For SMOKE, FOCUSED, and CUSTOM modes only, display the scenarios as a numbered list and ask the user for confirmation before continuing:

> **Planned scenarios:**
> 1. [scenario 1]
> 2. [scenario 2]
> ...
>
> Proceed with these scenarios, or would you like to adjust them?

Wait for the user's response.
- If they confirm (e.g. "yes", "go ahead", "looks good") — proceed with the displayed scenarios.
- If they request changes — update the scenario list to reflect their input, redisplay the updated list, and ask for confirmation again.
- If the response is ambiguous — ask a clarifying follow-up before proceeding.

Do not continue until an explicit confirmation is received.

## Pre-flight: Playwright CLI Setup

### Step 1 — Detect installation

Run the following to check if `playwright-cli` is available:

```bash
playwright-cli --version 2>/dev/null
```

**If the command fails (not installed):**

1. Install the Playwright CLI globally:
   ```bash
   npm install -g @playwright/cli@latest
   ```
2. Install the Chromium browser binary:
   ```bash
   playwright-cli install chromium
   ```

### Step 2 — Install skills

Check if the playwright-cli skills are installed in the current workspace by looking for `.claude/skills/playwright-cli/SKILL.md`.

**If the file does not exist:**

1. Run:
   ```bash
   playwright-cli install --skills
   ```
2. Print:
   ```
   ════════════════════════════════════════════════════════
    Playwright CLI: Skills Installed
   ════════════════════════════════════════════════════════
    Installed: .claude/skills/playwright-cli/

    ACTION REQUIRED:
    1. Restart Claude Code
    2. Re-run /wsbaser:verify-feature-playwright [with same flags]
   ════════════════════════════════════════════════════════
   ```
3. **STOP** — do not proceed with any further phases.

**If `.claude/skills/playwright-cli/SKILL.md` already exists:** proceed to Phase 1.

> **How browser sessions work:** each track uses a named session (`-s=track1` through `-s=track5`). Named sessions are independent browser contexts — you can run up to 5 in parallel without interference. After all tests complete, sessions are cleaned up with `playwright-cli kill-all`.

## Phase 1: Research (Mode-Conditional)

Research depth is determined by `TESTING_MODE`:

| Mode | Sub-agent 1 (Journeys) | Sub-agent 2 (DB) | Sub-agent 3 (Bugs) |
|------|------------------------|------------------|---------------------|
| **SMOKE** | SKIP | SKIP | SKIP |
| **CUSTOM** | SKIP | Conditional* | SKIP |
| **FOCUSED** | Targeted only | Targeted only | SKIP |
| **FULL** | Run | Run | Run |

*For CUSTOM: Run Sub-agent 2 ONLY if scenarios lack DB validation detail.

### Mode-Specific Instructions

**SMOKE:** Skip all research. Print: `Skipping research — smoke test mode.`

**CUSTOM:**
- Skip Sub-agents 1 and 3.
- Sub-agent 2: Run ONLY if scenarios lack DB validation detail (no queries, no expected record changes, no DB mention). Otherwise skip.
- Print: `Predefined scenarios detected — skipping journey discovery and bug hunting. Running DB research: [yes/no — reason].`

**FOCUSED:**
- Sub-agent 1: Run targeted research on `TARGET_AREA` only — document journeys involving that feature/area.
- Sub-agent 2: Run targeted research on tables/queries related to `TARGET_AREA` only.
- Skip Sub-agent 3 (bug hunting).
- Print: `Focused research on: [TARGET_AREA] — running targeted journey and DB analysis.`

**FULL:** Launch all three sub-agents below simultaneously. This is the default full-research flow.

---

### Sub-agent 1: Application Structure & User Journeys

> Research this codebase thoroughly. Return a structured summary covering:
>
> 1. **Authentication/login** — if the app has protected routes, how to create a test account or log in (credentials from .env.example, seed data, or sign-up flow)
> 2. **Every user-facing route/page** — each URL path and what it renders
> 3. **Every user journey** — complete flows a user can take (e.g., "sign up -> create profile -> view public page"). For each journey, list the specific steps, interactions (clicks, form fills, navigation), and expected outcomes
> 4. **Key UI components** — forms, modals, dropdowns, pickers, toggles, and other interactive elements that need testing
>
> Be exhaustive. Testing will only cover what you identify here.

### Sub-agent 2: Database Schema & Data Flows

> Research this codebase's database layer. Read `.env.example` to understand environment variables for database connections. DO NOT read `.env` directly. Return a structured summary covering:
>
> 1. **Database type and connection** — what database is used (Postgres, MySQL, SQLite, etc.) and the environment variable name for the connection string (from .env.example)
> 2. **Full schema** — every table, its columns, types, and relationships
> 3. **Data flows per user action** — for each user-facing action (form submit, button click, etc.), document exactly what records are created, updated, or deleted and in which tables
> 4. **Validation queries** — for each data flow, provide the exact query to verify records are correct after the action
>
> If no database layer is detected, return: "No database layer found. Database validation will be skipped."

### Sub-agent 3: Bug Hunting

> Analyze this codebase for potential bugs, issues, and code quality problems. Focus on:
>
> 1. **Logic errors** — incorrect conditionals, off-by-one errors, missing null checks, race conditions
> 2. **UI/UX issues** — missing error handling in forms, no loading states, broken responsive layouts, accessibility problems
> 3. **Data integrity risks** — missing validation, potential orphaned records, incorrect cascade behavior
> 4. **Security concerns** — SQL injection, XSS, missing auth checks, exposed secrets
>
> Return a prioritized list with file paths and line numbers.

**Wait for all sub-agents that were launched to complete before proceeding.**

## Phase 1.5: Setup .reports/

Before starting the application:

1. Check if `.reports/` and `.playwright-cli` are listed in the project's `.gitignore`. Append any that are missing.
2. Create the directory `.reports/screenshots/` if it does not already exist.

## Phase 2: Start the Application

1. **Read CLAUDE.md** (already in context) to find the dev server startup command. Look for a section like "Run with hot reload" or "Run dev server". Use that exact command.
2. **Determine the correct dev URL**: From the startup command identified in step 1, find which launch profile it maps to, then read `launchSettings.json` (search for it under `Properties/launchSettings.json`) to get the `applicationUrl` for that exact profile. Use **only that URL** for all subsequent steps — do not guess a port or use a different profile's port.
3. **Check if the app is already running** by probing that exact URL
   (e.g., `curl -s -o /dev/null -w "%{http_code}" http://localhost:PORT`).

   **If it returns 200 (app is already running):**

   Print a warning:
   ```
   ════════════════════════════════════════════════════════
    ⚠ Application is already running on [URL]
    The running instance may be built from a different
    branch or commit and may NOT contain the changes you
    want to verify. Restarting ensures tests run against
    the correct version.
   ════════════════════════════════════════════════════════
   ```
   Ask the user: "Restart the application from the current directory and branch? (yes/no)"

   **If the user says YES (restart):**
   - Detect OS inline: run `uname -s`. If the output contains `MINGW`, `CYGWIN`, or `MSYS`, this is **Windows**; otherwise Unix/macOS.
   - Find and kill the process listening on the port:
     - Unix/macOS: `lsof -ti :<PORT> | xargs kill -9 2>/dev/null || true`
     - Windows: run `netstat -ano | findstr :<PORT>`, extract the PID from the last column, then `taskkill //PID <PID> //F` (use `//PID` and `//F` — double slash prevents MINGW64/Git Bash from converting `/PID` to a file path like `C:/Program Files/Git/PID`)
   - Wait 2 seconds for the port to be freed.
   - Proceed to step 4 (install dependencies if needed, start the dev server in the background).

   **If the user says NO (keep existing):**
   - Print: "Using existing running instance."
   - Skip to Phase 4 — do not start a second instance.

4. If not running: install dependencies if needed, then start the dev server **in the background**.
5. Wait for the server to be ready (poll the port until it responds).

**If the application fails to start** (process exits immediately, port never becomes available, or a fatal error is printed): print the error to the console and **stop** — do NOT generate `.reports/` or any report. Ask the user to fix the startup issue and re-run.

## Phase 3: Create Task List & Parallelization Plan

Task generation varies by `TESTING_MODE`:

### SMOKE Mode

Create a **single task**:
- **subject:** "Smoke test — basic app verification"
- **description:** "Adaptive smoke test — navigate to the app, explore the UI to understand what this application does, then design and execute a minimal smoke scenario covering the most critical paths for this specific app. Report any immediate visual or functional issues found."
- **activeForm:** "Running smoke test"

### FOCUSED Mode

Create tasks **only for journeys involving `TARGET_AREA`**:
- From Sub-agent 1 results, filter journeys to only those that touch the target feature/area.
- Include any prerequisite journeys needed to reach the target (e.g., login before testing profile).
- **subject:** Journey name (e.g., "Test profile update flow")
- **description:** Include steps, expected outcomes, and DB queries (from targeted Sub-agent 2 research if run).
- **activeForm:** Present continuous form.

### CUSTOM Mode

Use the **predefined scenario list**:
- Each scenario becomes one task.
- For minimal scenarios (just a name/description), include: "Steps not fully defined — execution agent will discover them from the app's UI."
- Include DB info from Sub-agent 2 if it was run.

### FULL Mode

Use **all discovered journeys**:
- From Sub-agent 1 (user journeys) and Sub-agent 3 (bug findings).
- Create a task for each journey.

---

For all modes, each task should include:

- **subject:** The journey name (e.g., "Test profile creation flow")
- **description:** Steps to execute, expected outcomes, database records to verify (if applicable), and any related bug findings from Sub-agent 3 (if it ran)
- **activeForm:** Present continuous (e.g., "Testing profile creation flow")

If the `--responsive` flag was passed, also create a final task: "Responsive testing across viewports."

### Parallelization Analysis

After creating all tasks, analyze the journeys and group them into **parallel tracks**:

- **Independent journeys** can run in parallel — they start from a clean state or use isolated test data and do not depend on outcomes of other journeys.
- **Sequential journeys** must run one after another within the same track — they depend on state created by a prior journey (e.g., "delete account" requires "create account" to have completed first).

Group journeys into tracks such that within each track journeys run sequentially, but all tracks can run concurrently. The maximum number of concurrent tracks is **5**.

Print the execution plan to the console before starting any tests:

```
## Test Execution Plan

Track 1: Journey A
Track 2: Journey B → Journey E
Track 3: Journey C → Journey F → Journey G
Track 4: Journey D
Track 5: Journey H

Total: [N] scenarios across [M] tracks
```

## Phase 4: Parallel Journey Execution

Execute all tracks in parallel using a rolling agent queue. At any moment, up to **5 agents** run concurrently, each handling exactly **one scenario**. When an agent finishes its scenario, the next unstarted scenario from the same track (if any) is immediately dispatched.

### 4.1 Orchestration Loop

Repeat until all scenarios are complete:

1. Identify all scenarios that are **ready to start** — either they have no prerequisite, or their prerequisite scenario (the previous one in the same track) has already completed.
2. From the ready list, pick enough scenarios to bring the number of running agents up to 5 (or fewer if there are not enough ready scenarios).
3. For each selected scenario, print:
   ```
   ▶ [scenario_number/total] Starting: [Journey Name] (Track [N])
   ```
4. Launch one Agent per selected scenario **in parallel** (all in the same tool call batch). Each agent receives the self-contained scenario prompt described in Section 4.2, with `[TRACK_NUMBER]` set to the agent's track number (Track 1 → 1, Track 2 → 2, etc.). Each agent uses exclusively its own `playwright-cli -s=track[TRACK_NUMBER]` session.
5. Wait for all launched agents to complete.
6. For each completed agent, print:
   ```
   ✓ [scenario_number/total] Complete: [Journey Name] — [X issues, Y screenshots]
   ```
   Or, if the agent reported a failure:
   ```
   ✗ [scenario_number/total] Failed: [Journey Name] — [brief reason]
   ```
7. Mark the corresponding task as `completed` (or `failed`) using TaskUpdate.
8. Collect the structured result returned by the agent (issues found, screenshots taken, DB validation results, steps log).

### 4.2 Per-Scenario Agent Prompt

Each agent is dispatched with the following self-contained prompt. Fill in all bracketed values before dispatching.

---

> You are running a single E2E browser test scenario using Playwright CLI. Execute it completely and return a structured result.
>
> **App URL:** [app_url]
> **Authentication:** [how to log in — credentials, sign-up steps, or "no auth required"]
> **Database:** [db_type and connection env var, or "no database"]
> **DB Schema summary:** [relevant tables and columns for this journey]
>
> **Journey: [Journey Name]**
> Steps:
> [numbered list of steps from the task description]
>
> If the steps above are not fully defined (e.g. just a journey name), explore the app's UI to discover the appropriate steps for this journey. Use `snapshot` after navigating to the relevant page to identify available interactions.
>
> Expected outcomes: [what should be true at the end]
>
> **Related bug findings to watch for:**
> [relevant findings from Sub-agent 3, or "none"]
>
> **Session:** `track[TRACK_NUMBER]` — use ONLY `playwright-cli [HEADED_FLAG] -s=track[TRACK_NUMBER]` for ALL browser commands. Never use a different session name.
>
> **Headed mode:** [HEADED_FLAG] — if `--headed` was passed to the skill, this is `--headed`; otherwise it is empty and should be omitted from commands.
>
> **Playwright CLI command reference** — prepend `playwright-cli [HEADED_FLAG] -s=track[TRACK_NUMBER]` to every command:
> ```
> # Session start (MUST be first command — opens the browser for this session)
> open [url]                          # open browser, optionally navigate to url
>
> # Navigation
> goto <url>                          # navigate (use after open)
> reload                              # reload the current page
> go-back                             # go back
> go-forward                          # go forward
>
> # Interaction
> snapshot                            # capture page state to get element refs (also waits for page to stabilize)
> click <ref>                         # click element
> dblclick <ref>                      # double-click element
> fill <ref> "<text>"                 # fill input field
> type "<text>"                       # type into focused element
> press <key>                         # e.g. Enter, Tab, Escape, ArrowDown
> hover <ref>                         # hover over element
> select <ref> "<value>"              # select dropdown option
> check <ref>                         # check checkbox/radio
> uncheck <ref>                       # uncheck checkbox/radio
>
> # Screenshots & output
> screenshot --filename=<path>        # save screenshot to path
> pdf --filename=<path>               # save page as PDF
>
> # DevTools
> console                             # list console messages
> network                             # list network requests
> eval "<expression>"                 # evaluate JS expression
> run-code "<playwright code>"        # run a Playwright code snippet
>
> # Resize
> resize <width> <height>             # resize viewport
>
> # Storage
> localstorage-get <key>              # read localStorage
> localstorage-set <key> <value>      # write localStorage
> cookie-list                         # list cookies
> state-save <filename>               # save full storage state
> state-load <filename>               # restore storage state
> ```
>
> **Instructions:**
>
> 1. Use `playwright-cli [HEADED_FLAG] -s=track[TRACK_NUMBER]` **exclusively** for all browser interaction via the Bash tool. Never use a different session name.
> 2. **Open the browser first** — the very first command in a session MUST be `open`: `playwright-cli [HEADED_FLAG] -s=track[TRACK_NUMBER] open`. This starts the browser process for the session. Use `goto` for all subsequent navigations.
> 3. Immediately after `open`, set the viewport: `playwright-cli [HEADED_FLAG] -s=track[TRACK_NUMBER] resize 1440 900`
> 4. After every navigation or DOM change, run `snapshot` to get fresh element references before clicking or filling. If the snapshot returns fewer than 3 interactive elements (inputs, buttons, or links), the page is likely still loading — wait 2 seconds and snapshot again, up to 3 retries, before proceeding. Never attempt to click or fill based on a sparse snapshot.
> 5. At every meaningful step: take a screenshot and save it to `.reports/screenshots/[journey-slug]/[NN]-[step-name].png`. Analyze each screenshot for visual correctness, UX issues, broken layouts, missing content, and error states.
> 6. Check browser console after each significant interaction for JavaScript errors: `playwright-cli [HEADED_FLAG] -s=track[TRACK_NUMBER] console`
> 7. If a step fails (500 error, element not found, unexpected redirect): take a screenshot as `ERROR-[NN]-[step-name].png`, document it, and continue with remaining steps.
> 8. After any interaction that modifies data, run the DB validation query to confirm the record was created/updated/deleted correctly.
> 9. Do NOT fix bugs — only document them.
> 10. Print each step to the console as you execute it:
>    ```
>    [Journey Name] > Step 1: [description]
>    [Journey Name] > Step 2: [description]
>    ...
>    ```
>
> **Return a structured result** with these sections:
> - **Steps completed:** numbered list with pass/fail status
> - **Issues found:** each issue with description, severity (high/medium/low), screenshot path, and DB query result if applicable
> - **Screenshots taken:** list of all screenshot paths
> - **DB validation results:** pass/fail for each query run
> - **Console errors:** any JS errors encountered

---

### 4.3 Responsive Testing

**Only run this section if the `--responsive` flag was passed.** Otherwise skip entirely.

The "Responsive testing across viewports" task runs **after all main tracks have completed**, using `track1` session (which is free by then). Dispatch it as its own agent with these instructions:

> **Session:** `track1` — use ONLY `playwright-cli [HEADED_FLAG] -s=track1` for all browser commands (same `[HEADED_FLAG]` as the main scenarios).
>
> Start with `playwright-cli [HEADED_FLAG] -s=track1 open` to open the browser, then revisit every major page at three viewport sizes. At each viewport, take a screenshot of every major page and analyze for layout issues, overflow, broken alignment, and touch target sizes on mobile.
>
> Viewports:
> - **Mobile:** 375x812 — `playwright-cli [HEADED_FLAG] -s=track1 resize 375 812`
> - **Tablet:** 768x1024 — `playwright-cli [HEADED_FLAG] -s=track1 resize 768 1024`
> - **Desktop:** 1440x900 — `playwright-cli [HEADED_FLAG] -s=track1 resize 1440 900`
>
> After resizing, navigate to each major page and take a screenshot: `playwright-cli [HEADED_FLAG] -s=track1 screenshot --filename=<path>`
>
> Print each page+viewport combination to the console as you test it.
> Return the same structured result format.

## Phase 5: Cleanup

After all agents have completed:

1. Stop the dev server background process (if started in Phase 2).
2. Clean up all Playwright CLI sessions: `playwright-cli kill-all`

## Phase 6: Report

### Console Summary

Output a brief summary to the console:

```
## E2E Testing Complete

**Journeys Tested:** [count]
**Screenshots Captured:** [count]
**Issues Found:** [count]

### Issues Found During Testing
- [Description] — [severity: high/medium/low] — [screenshot path]

### Bug Hunt Findings (from code analysis)  ← only include if Sub-agent 3 ran
- [Description] — [severity] — [file:line]

All results saved to: `.reports/[REPORT_FILENAME]`
```

### HTML Report

Invoke the `wsbaser:generate-test-report` skill to generate the HTML report from all collected test data.

After the report is successfully generated, delete the `.reports/screenshots/` directory — all screenshots are embedded in the report as base64 data URIs and the folder is no longer needed.
