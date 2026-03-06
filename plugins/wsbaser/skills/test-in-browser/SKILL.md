---
name: test-in-browser
description: Comprehensive end-to-end testing skill. Launches parallel sub-agents to research the codebase (structure, database schema, potential bugs), then uses Playwright MCP tools to test every user journey — taking screenshots, validating UI/UX, and optionally querying the database to verify records. Run after implementation to validate everything before code review.
disable-model-invocation: true
---

# End-to-End Application Testing

## Pre-flight: Playwright MCP Availability Check

Before starting any research, verify that Playwright MCP tools are accessible by attempting a simple operation (e.g., check if `playwright_navigate` is available).

- **If Playwright MCP tools ARE available:** Proceed normally through all phases.
- **If Playwright MCP tools are NOT available:** Run in **research-only mode** — execute Phase 1 (parallel research) only, then skip directly to Phase 6 (report) with just the bug hunt and schema findings. Do not attempt to start the app or run browser tests.

## Phase 1: Parallel Research

Launch **three sub-agents simultaneously** using the Task tool. All three run in parallel.

### Sub-agent 1: Application Structure & User Journeys

> Research this codebase thoroughly. Return a structured summary covering:
>
> 1. **How to start the application** — exact commands to install dependencies and run the dev server, including the URL and port it serves on
> 2. **Authentication/login** — if the app has protected routes, how to create a test account or log in (credentials from .env.example, seed data, or sign-up flow)
> 3. **Every user-facing route/page** — each URL path and what it renders
> 4. **Every user journey** — complete flows a user can take (e.g., "sign up -> create profile -> view public page"). For each journey, list the specific steps, interactions (clicks, form fills, navigation), and expected outcomes
> 5. **Key UI components** — forms, modals, dropdowns, pickers, toggles, and other interactive elements that need testing
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

Using Sub-agent 1's startup instructions:

1. Install dependencies if needed
2. Start the dev server **in the background** (e.g., `npm run dev &`)
3. Wait for the server to be ready

**If the application fails to start** (process exits immediately, port never becomes available, or a fatal error is printed): print the error to the console and **stop** — do NOT generate `.reports/` or any report. Ask the user to fix the startup issue and re-run.

## Phase 3: Create Task List

Using the user journeys from Sub-agent 1 and findings from Sub-agent 3, create a task (using TaskCreate) for each user journey. Each task should include:

- **subject:** The journey name (e.g., "Test profile creation flow")
- **description:** Steps to execute, expected outcomes, database records to verify (if applicable), and any related bug findings from Sub-agent 3
- **activeForm:** Present continuous (e.g., "Testing profile creation flow")

Also create a final task: "Responsive testing across viewports."

## Phase 4: User Journey Testing

For each task, mark it `in_progress` with TaskUpdate and execute the following.

### 4a. Browser Testing with Playwright MCP

Use the Playwright MCP tools for all browser interaction: navigating to pages, clicking elements, filling forms, selecting options, pressing keys, taking screenshots, and reading page content.

**Key principles:**

- After navigation or DOM changes, always re-snapshot to get fresh element references
- Take screenshots at every meaningful step and save them to descriptive paths under `.reports/screenshots/` organized by journey (e.g., `.reports/screenshots/profile-creation/03-form-submitted.png`)
- **Analyze each screenshot** — use the Read tool to view the screenshot image. Check for visual correctness, UX issues, broken layouts, missing content, error states
- Check the browser console periodically for JavaScript errors

For each step in a user journey:

1. Get current page state and interactive elements
2. Perform the interaction
3. Wait for the page to settle
4. **Take a screenshot** and save to the organized path
5. **Analyze the screenshot** for visual and UX issues
6. Check console for JS errors

**Mid-journey failure handling:** If a step fails (500 error, element not found, timeout, unexpected redirect):
1. Screenshot the error state and save it (e.g., `.reports/screenshots/profile-creation/ERROR-03-form-submitted.png`)
2. Document the failure: what step failed, what was expected, what happened
3. **Continue** with the remaining steps of the journey if possible, and with all other journeys — do not abort the full test run

Be thorough. Go through EVERY interaction, EVERY form field, EVERY button. The goal is that by the time this finishes, every part of the UI has been exercised and screenshotted.

### 4b. Database Validation (Optional)

**Skip this section if Sub-agent 2 reported no database layer.**

After any interaction that should modify data (form submits, deletions, updates):

1. Query the database to verify records. Use the environment variable from Sub-agent 2's research for the connection string and the schema docs to know what to check.
   - **Postgres:** use `psql` directly — e.g., `psql "$DATABASE_URL" -c "SELECT theme FROM profiles WHERE username = 'testuser'"`
   - **SQLite:** use `sqlite3` directly — e.g., `sqlite3 db.sqlite "SELECT theme FROM profiles WHERE username = 'testuser'"`
   - **Other databases:** write a small ad hoc script in the application's language, run it, then delete it
2. Verify:
   - Records created/updated/deleted as expected
   - Values match what was entered in the UI
   - Relationships between records are correct
   - No orphaned or duplicate records

### 4c. Issue Documentation

When an issue is found (UI bug, database mismatch, JS error):

1. **Document it:** what was expected vs what happened, screenshot path, relevant DB query results
2. **Do NOT fix the code** — only document the issue for the report
3. **Continue testing** the remaining steps in the journey

### 4d. Responsive Testing

For the responsive testing task, revisit key pages at these viewports:

- **Mobile:** 375x812
- **Tablet:** 768x1024
- **Desktop:** 1440x900

At each viewport, screenshot every major page. Analyze for layout issues, overflow, broken alignment, and touch target sizes on mobile.

After completing each journey, mark its task as `completed` with TaskUpdate.

## Phase 5: Cleanup

After all testing is complete:
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

All results saved to: `.reports/`
```

### HTML Report

Invoke the `frontend-design` skill to generate `.reports/report.html`.

Provide the skill with all collected test data and the following requirements:

**Requirements for the HTML report:**
- Single self-contained HTML file (inline CSS + JS, no external dependencies)
- All screenshots embedded as base64 data URIs (read each screenshot file and encode it)
- **Tabbed interface:** one tab per journey tested, plus a summary tab
- **Filter by status:** pass / fail / issue (filter tabs or journey steps)
- **Search functionality** across step descriptions and issue text
- **Per-journey breakdown:** steps taken in order, inline screenshots, issues found during that journey
- **Summary dashboard:** total journeys, total screenshots, issues by severity, pass rate
- **Bug hunt findings section:** all findings from the code analysis sub-agent (Sub-agent 3), with file paths and line numbers
- **Database validation results** section (if database validation was performed)
- **Recommendations** for every unresolved issue found during testing

After the HTML file is successfully generated, delete the `.reports/screenshots/` directory — all screenshots are embedded in the report as base64 data URIs and the folder is no longer needed.
