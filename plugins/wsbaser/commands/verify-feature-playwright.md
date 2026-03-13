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

**If `playwright-cli` is available:** proceed to Phase 1.

> **How browser sessions work:** each track uses a named session (`-s=track1` through `-s=track5`). Named sessions are independent browser contexts — you can run up to 5 in parallel without interference. After all tests complete, sessions are cleaned up with `playwright-cli kill-all`.

## Phase 1: Parallel Research

Launch **three sub-agents simultaneously** using the Agent tool. All three run in parallel.

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

**Wait for all three sub-agents to complete before proceeding.**

## Phase 1.5: Setup .reports/

Before starting the application:

1. Check if `.reports/` is listed in the project's `.gitignore`. If it is not present, append `.reports/` to `.gitignore`.
2. Create the directory `.reports/screenshots/` if it does not already exist.

## Phase 2: Start the Application

1. **Read CLAUDE.md** (already in context) to find the dev server startup command. Look for a section like "Run with hot reload" or "Run dev server". Use that exact command.
2. **Determine the correct dev URL**: From the startup command identified in step 1, find which launch profile it maps to, then read `launchSettings.json` (search for it under `Properties/launchSettings.json`) to get the `applicationUrl` for that exact profile. Use **only that URL** for all subsequent steps — do not guess a port or use a different profile's port.
3. **Check if the app is already running** by probing that exact URL (e.g., `curl -s -o /dev/null -w "%{http_code}" http://localhost:PORT`). If it returns 200, skip to Phase 4 — do not start a second instance.
4. If not running: install dependencies if needed, then start the dev server **in the background**.
5. Wait for the server to be ready (poll the port until it responds).

**If the application fails to start** (process exits immediately, port never becomes available, or a fatal error is printed): print the error to the console and **stop** — do NOT generate `.reports/` or any report. Ask the user to fix the startup issue and re-run.

## Phase 3: Create Task List & Parallelization Plan

Using the user journeys from Sub-agent 1 and findings from Sub-agent 3, create a task (using TaskCreate) for each user journey. Each task should include:

- **subject:** The journey name (e.g., "Test profile creation flow")
- **description:** Steps to execute, expected outcomes, database records to verify (if applicable), and any related bug findings from Sub-agent 3
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
> Expected outcomes: [what should be true at the end]
>
> **Related bug findings to watch for:**
> [relevant findings from Sub-agent 3, or "none"]
>
> **Session:** `track[TRACK_NUMBER]` — use ONLY `playwright-cli -s=track[TRACK_NUMBER]` for ALL browser commands. Never use a different session name.
>
> **Playwright CLI command reference:**
> - Navigate: `playwright-cli -s=track[TRACK_NUMBER] goto <url>`
> - Snapshot (get element refs): `playwright-cli -s=track[TRACK_NUMBER] snapshot`
> - Click element: `playwright-cli -s=track[TRACK_NUMBER] click <ref>`
> - Fill input: `playwright-cli -s=track[TRACK_NUMBER] fill <ref> "<value>"`
> - Type text: `playwright-cli -s=track[TRACK_NUMBER] type "<text>"`
> - Press key: `playwright-cli -s=track[TRACK_NUMBER] press <key>` (e.g. `Enter`, `Tab`, `Escape`)
> - Hover: `playwright-cli -s=track[TRACK_NUMBER] hover <ref>`
> - Select dropdown: `playwright-cli -s=track[TRACK_NUMBER] select <ref> "<value>"`
> - Screenshot: `playwright-cli -s=track[TRACK_NUMBER] screenshot --filename=<path>`
> - Console messages: `playwright-cli -s=track[TRACK_NUMBER] console`
> - Resize viewport: `playwright-cli -s=track[TRACK_NUMBER] resize <width> <height>`
> - Run JS: `playwright-cli -s=track[TRACK_NUMBER] run-code "<js expression>"`
> - Wait: use `playwright-cli -s=track[TRACK_NUMBER] snapshot` (it waits for the page to stabilize)
>
> **Instructions:**
>
> 1. Use `playwright-cli -s=track[TRACK_NUMBER]` **exclusively** for all browser interaction via the Bash tool. Never use a different session name.
> 2. Before the first navigation, set the viewport to **1440x900** (desktop): `playwright-cli -s=track[TRACK_NUMBER] resize 1440 900`
> 3. After every navigation or DOM change, run `snapshot` to get fresh element references before clicking or filling.
> 4. At every meaningful step: take a screenshot and save it to `.reports/screenshots/[journey-slug]/[NN]-[step-name].png`. Analyze each screenshot for visual correctness, UX issues, broken layouts, missing content, and error states.
> 5. Check browser console after each significant interaction for JavaScript errors: `playwright-cli -s=track[TRACK_NUMBER] console`
> 6. If a step fails (500 error, element not found, unexpected redirect): take a screenshot as `ERROR-[NN]-[step-name].png`, document it, and continue with remaining steps.
> 7. After any interaction that modifies data, run the DB validation query to confirm the record was created/updated/deleted correctly.
> 8. Do NOT fix bugs — only document them.
> 9. Print each step to the console as you execute it:
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

> **Session:** `track1` — use ONLY `playwright-cli -s=track1` for all browser commands.
>
> Revisit every major page at three viewport sizes. At each viewport, take a screenshot of every major page and analyze for layout issues, overflow, broken alignment, and touch target sizes on mobile.
>
> Viewports:
> - **Mobile:** 375x812 — `playwright-cli -s=track1 resize 375 812`
> - **Tablet:** 768x1024 — `playwright-cli -s=track1 resize 768 1024`
> - **Desktop:** 1440x900 — `playwright-cli -s=track1 resize 1440 900`
>
> After resizing, navigate to each major page and take a screenshot: `playwright-cli -s=track1 screenshot --filename=<path>`
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

### Bug Hunt Findings (from code analysis)
- [Description] — [severity] — [file:line]

All results saved to: `.reports/[REPORT_FILENAME]`
```

### HTML Report

Invoke the `wsbaser:generate-test-report` skill to generate the HTML report from all collected test data.

After the report is successfully generated, delete the `.reports/screenshots/` directory — all screenshots are embedded in the report as base64 data URIs and the folder is no longer needed.
