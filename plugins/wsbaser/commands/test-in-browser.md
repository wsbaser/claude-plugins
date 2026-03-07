---
description: Comprehensive E2E browser testing — parallel codebase research, Playwright user journey testing, screenshots, DB validation, and HTML report
allowed-tools: Agent, Task, TaskCreate, TaskGet, TaskList, TaskOutput, TaskStop, TaskUpdate, Bash, Read, Write, Glob, Grep, mcp__plugin_playwright_playwright__browser_navigate, mcp__plugin_playwright_playwright__browser_snapshot, mcp__plugin_playwright_playwright__browser_click, mcp__plugin_playwright_playwright__browser_fill_form, mcp__plugin_playwright_playwright__browser_type, mcp__plugin_playwright_playwright__browser_press_key, mcp__plugin_playwright_playwright__browser_select_option, mcp__plugin_playwright_playwright__browser_take_screenshot, mcp__plugin_playwright_playwright__browser_console_messages, mcp__plugin_playwright_playwright__browser_resize, mcp__plugin_playwright_playwright__browser_evaluate, mcp__plugin_playwright_playwright__browser_wait_for, mcp__plugin_playwright_playwright__browser_close
---

# End-to-End Application Testing

## Pre-flight: Playwright MCP Availability Check

Before starting any research, verify that Playwright MCP tools are accessible by attempting a simple operation (e.g., check if `playwright_navigate` is available).

- **If Playwright MCP tools ARE available:** Proceed normally through all phases.
- **If Playwright MCP tools are NOT available:** Run in **research-only mode** — execute Phase 1 (parallel research) only, then skip directly to Phase 6 (report) with just the bug hunt and schema findings. Do not attempt to start the app or run browser tests.

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
2. **Check if the app is already running** by probing the expected port (e.g., `curl -s -o /dev/null -w "%{http_code}" http://localhost:PORT`). If it returns 200, skip to Phase 3 — do not start a second instance.
3. If not running: install dependencies if needed, then start the dev server **in the background**.
4. Wait for the server to be ready (poll the port until it responds).

**If the application fails to start** (process exits immediately, port never becomes available, or a fatal error is printed): print the error to the console and **stop** — do NOT generate `.reports/` or any report. Ask the user to fix the startup issue and re-run.

## Phase 3: Create Task List & Parallelization Plan

Using the user journeys from Sub-agent 1 and findings from Sub-agent 3, create a task (using TaskCreate) for each user journey. Each task should include:

- **subject:** The journey name (e.g., "Test profile creation flow")
- **description:** Steps to execute, expected outcomes, database records to verify (if applicable), and any related bug findings from Sub-agent 3
- **activeForm:** Present continuous (e.g., "Testing profile creation flow")

Also create a final task: "Responsive testing across viewports."

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
4. Launch one Agent per selected scenario **in parallel** (all in the same tool call batch). Each agent receives the self-contained scenario prompt described in Section 4.2.
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

> You are running a single E2E browser test scenario. Execute it completely and return a structured result.
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
> **Instructions:**
>
> 1. Use Playwright MCP tools for all browser interaction.
> 2. After every navigation or DOM change, re-snapshot to get fresh element references.
> 3. At every meaningful step: take a screenshot and save it to `.reports/screenshots/[journey-slug]/[NN]-[step-name].png`. Analyze each screenshot for visual correctness, UX issues, broken layouts, missing content, and error states.
> 4. Check browser console after each significant interaction for JavaScript errors.
> 5. If a step fails (500 error, element not found, timeout, unexpected redirect): screenshot the error state as `ERROR-[NN]-[step-name].png`, document it, and continue with remaining steps.
> 6. After any interaction that modifies data, run the DB validation query to confirm the record was created/updated/deleted correctly.
> 7. Do NOT fix bugs — only document them.
> 8. Print each step to the console as you execute it:
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

The "Responsive testing across viewports" task is always independent (dispatch it as its own agent at the end, or include it in the last batch). Its agent receives the same context but with these instructions instead of a journey:

> Revisit every major page at three viewport sizes. At each viewport, take a screenshot of every major page and analyze for layout issues, overflow, broken alignment, and touch target sizes on mobile.
>
> Viewports:
> - **Mobile:** 375x812
> - **Tablet:** 768x1024
> - **Desktop:** 1440x900
>
> Print each page+viewport combination to the console as you test it.
> Return the same structured result format.

## Phase 5: Cleanup

After all agents have completed:
1. Stop the dev server background process
2. Close the browser session

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

**First, derive a descriptive report filename** (3–5 words, kebab-case) that summarizes the journeys tested (e.g., `login-profile-dashboard.html`, `checkout-cart-orders.html`, `signup-onboarding-settings.html`). Name it after the key journeys or feature areas covered — do not include the app name. Store this as `REPORT_FILENAME`.

Invoke the `frontend-design` skill to generate `.reports/[REPORT_FILENAME]`.

Provide the skill with all collected test data (aggregated from all agent results) and the following requirements. These requirements are prescriptive — follow the specified patterns and code structure exactly, while using your design judgment for visual polish, typography, and layout details.

---

**Requirements for the HTML report:**

#### Core constraints
- Single self-contained HTML file (inline CSS + JS, no external dependencies)
- All screenshots embedded as base64 data URIs (read each screenshot file and encode it)
- Light theme by default: white/near-white background (`#ffffff` / `#f6f8fa`), dark text (`#1f2328`), colored status accents
- System font for UI (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`), monospace for code/paths
- All UI updates are instant — no "Apply" buttons anywhere

#### State management pattern (required)

Use a single state object. Every filter, search, and preset writes to it; every render reads from it:

```javascript
const state = {
  filterStatus: 'all',       // 'all' | 'pass' | 'fail' | 'issue'
  filterSeverity: 'all',     // 'all' | 'high' | 'medium' | 'low'
  filterSource: 'all',       // 'all' | 'browser' | 'code-analysis' | 'db-validation'
  filterJourney: 'all',      // 'all' | journey slug
  searchQuery: '',
  activePreset: 'full',      // 'executive' | 'developer' | 'qa' | 'full'
  lightboxIndex: null        // index into screenshots array, or null
};

function updateAll() {
  renderFilters();
  renderIssueList();
  renderJourneyTabs();
  updatePresetHighlight();
  syncUrlHash();
}
// Every control calls updateAll() on change
```

#### Stakeholder presets

Four named presets that snap all filters to predefined combinations. Activating a preset updates `window.location.hash` (e.g., `#preset=developer`). On page load, read the hash and auto-activate the matching preset.

| Preset | filterStatus | filterSeverity | filterSource | What's visible |
|--------|-------------|----------------|-------------|----------------|
| **Executive Summary** | `issue` | `high` | `all` | Summary dashboard + high-severity issues only |
| **Developer View** | `issue` | `all` | `all` | All issues with file paths, line numbers, fix prompts |
| **QA View** | `all` | `all` | `browser` | All browser test steps with inline screenshots |
| **Full Report** | `all` | `all` | `all` | Everything (default) |

Preset buttons are displayed as a pill group at the top of the page. The active preset is highlighted.

```javascript
const PRESETS = {
  executive: { filterStatus: 'issue', filterSeverity: 'high', filterSource: 'all', filterJourney: 'all' },
  developer: { filterStatus: 'issue', filterSeverity: 'all', filterSource: 'all', filterJourney: 'all' },
  qa:        { filterStatus: 'all',   filterSeverity: 'all', filterSource: 'browser', filterJourney: 'all' },
  full:      { filterStatus: 'all',   filterSeverity: 'all', filterSource: 'all', filterJourney: 'all' }
};

function applyPreset(name) {
  Object.assign(state, PRESETS[name], { activePreset: name });
  updateAll();
}

function syncUrlHash() {
  window.location.hash = state.activePreset === 'full' ? '' : `preset=${state.activePreset}`;
}

// On load:
const hash = window.location.hash.replace('#', '');
const presetFromHash = hash.startsWith('preset=') ? hash.split('=')[1] : 'full';
if (PRESETS[presetFromHash]) applyPreset(presetFromHash);
```

#### Filter tabs with live counts

Display filter tabs for each dimension. Update counts live as other filters change:

```javascript
function getFilteredIssues() {
  return allIssues.filter(issue => {
    if (state.filterStatus !== 'all' && issue.status !== state.filterStatus) return false;
    if (state.filterSeverity !== 'all' && issue.severity !== state.filterSeverity) return false;
    if (state.filterSource !== 'all' && issue.source !== state.filterSource) return false;
    if (state.filterJourney !== 'all' && issue.journeySlug !== state.filterJourney) return false;
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      return issue.description.toLowerCase().includes(q)
          || issue.filePath?.toLowerCase().includes(q)
          || issue.journeyName.toLowerCase().includes(q)
          || issue.steps?.some(s => s.description.toLowerCase().includes(q));
    }
    return true;
  });
}
```

Each tab label shows the count for that filter value across the current filtered set (excluding its own dimension filter).

#### Live search

A search bar that filters across issue descriptions, step descriptions, file paths, and journey names. Calls `updateAll()` on every `input` event (not `change`).

#### Per-issue fix prompt

Each issue card has a "Copy fix prompt" button. When clicked:
1. Build a self-contained natural-language prompt for Claude to fix the bug
2. Include: issue description, severity, file path and line number (if available), steps to reproduce, error message or console output (if available), and the base64-encoded screenshot (if available)
3. Copy to clipboard
4. Show a brief "Copied!" toast (fades out after 1.5s)

```javascript
function buildFixPrompt(issue) {
  let prompt = `Please fix the following bug found during E2E testing:\n\n`;
  prompt += `**Issue:** ${issue.description}\n`;
  prompt += `**Severity:** ${issue.severity}\n`;
  if (issue.filePath) prompt += `**File:** ${issue.filePath}${issue.lineNumber ? `:${issue.lineNumber}` : ''}\n`;
  prompt += `\n**Steps to reproduce:**\n`;
  issue.steps?.forEach((s, i) => { prompt += `${i+1}. ${s}\n`; });
  if (issue.consoleError) prompt += `\n**Console error:**\n\`\`\`\n${issue.consoleError}\n\`\`\`\n`;
  if (issue.screenshotBase64) {
    prompt += `\n**Screenshot showing the issue:**\n`;
    prompt += `data:image/png;base64,${issue.screenshotBase64}`;
  }
  return prompt;
}

function copyFixPrompt(issueId) {
  const issue = allIssues.find(i => i.id === issueId);
  navigator.clipboard.writeText(buildFixPrompt(issue));
  showToast('Copied!');
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 1500);
}
```

Toast CSS:
```css
#toast {
  position: fixed; bottom: 24px; right: 24px;
  background: #1f2328; color: #fff;
  padding: 8px 16px; border-radius: 6px;
  opacity: 0; transition: opacity 0.2s;
  pointer-events: none; z-index: 1000;
}
#toast.visible { opacity: 1; }
```

#### Screenshots: thumbnail grid + lightbox

Display screenshots as a thumbnail grid (3–4 per row) within each journey step. Clicking a thumbnail opens a full-screen lightbox with prev/next navigation:

```javascript
// Lightbox open/close
function openLightbox(screenshotIndex) {
  state.lightboxIndex = screenshotIndex;
  document.getElementById('lightbox').classList.add('active');
  renderLightboxImage();
}

function closeLightbox() {
  state.lightboxIndex = null;
  document.getElementById('lightbox').classList.remove('active');
}

function navigateLightbox(delta) {
  const total = allScreenshots.length;
  state.lightboxIndex = (state.lightboxIndex + delta + total) % total;
  renderLightboxImage();
}

// Keyboard navigation
document.addEventListener('keydown', e => {
  if (state.lightboxIndex === null) return;
  if (e.key === 'ArrowRight') navigateLightbox(1);
  if (e.key === 'ArrowLeft') navigateLightbox(-1);
  if (e.key === 'Escape') closeLightbox();
});
```

Thumbnail CSS:
```css
.screenshot-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
.screenshot-thumb { width: 100%; aspect-ratio: 16/9; object-fit: cover; cursor: pointer;
  border-radius: 4px; border: 1px solid #d0d7de; transition: border-color 0.15s; }
.screenshot-thumb:hover { border-color: #0969da; }
```

#### Status color coding (from playground document-critique pattern)

| Status | Border color | Background tint |
|--------|-------------|-----------------|
| pass | `#1a7f37` (green) | `rgba(26,127,55,0.08)` |
| fail | `#cf222e` (red) | `rgba(207,34,46,0.08)` |
| issue | `#bf8700` (amber) | `rgba(191,135,0,0.08)` |

Apply as left border + background on issue cards and step rows.

#### Report sections (required content)

- **Summary dashboard** (always visible, not filtered): total journeys tested, total screenshots, issues by severity (high/med/low), pass rate, bug hunt findings count
- **Preset pill group**: Executive Summary | Developer View | QA View | Full Report (active preset highlighted)
- **Filter bar**: status tabs + severity tabs + source tabs + journey dropdown + search input
- **Issue list**: filtered and sorted by severity (high first), each card shows journey, source, description, file:line, severity badge, "Copy fix prompt" button, screenshot thumbnails
- **Journey tabs**: one tab per journey, showing ordered steps with pass/fail status, screenshots, and inline issues for that journey
- **Bug hunt findings section**: all findings from code analysis (Sub-agent 3), with file paths and line numbers, not affected by browser/db filters
- **Database validation results** section (if database validation was performed)

---

After the HTML file is successfully generated, delete the `.reports/screenshots/` directory — all screenshots are embedded in the report as base64 data URIs and the folder is no longer needed.

Print the report path to the console: `Report saved to: .reports/[REPORT_FILENAME]`
