---
name: wsbaser:verify-union
description: Automates E2E feature verification by generating and executing Union.Playwright.NUnit tests. Use when you want automated test code written and run. Use verify-feature when you want live browser verification without test code.
disable-model-invocation: true
---

# Union.Playwright.NUnit E2E Test Generation & Execution

## Pre-flight: Intent Analysis

Before any other steps, analyze the user's intent to determine the testing mode. This determines research depth and scenario generation approach.

### Context Gathering

Run each command separately with a labeled echo prefix so output sections are unambiguous:

```bash
echo "=== BRANCH ===" && git branch --show-current
echo "=== LOG ===" && git log --oneline -5
echo "=== STAGED ===" && git diff --staged --name-only
echo "=== UNSTAGED ===" && git diff --name-only
echo "=== BRANCH_DIFF ===" && git diff develop...HEAD --name-only 2>/dev/null || git diff main...HEAD --name-only 2>/dev/null
```

Parse each section by its label. The `STAGED` section is the output between `=== STAGED ===` and `=== UNSTAGED ===`, the `UNSTAGED` section is between `=== UNSTAGED ===` and `=== BRANCH_DIFF ===`, and so on.

**Target area inference — always applies regardless of mode:**
Use this priority order to determine what the current work is about:
1. **Unstaged changes** (`=== UNSTAGED ===` section) — highest priority. These are the most recent edits, not yet committed.
2. **Staged changes** (`=== STAGED ===` section) — if no unstaged changes.
3. **Branch diff vs develop/main** (`=== BRANCH_DIFF ===` section) — if no local changes at all, scope to everything this branch adds compared to the base branch.

Once you have identified which tier has changes, derive the target area **exclusively** from those file paths — do not use the branch name or commit messages to narrow, filter, or corroborate.

### Mode Detection

Analyze the invocation prompt/args to detect the testing mode:

| Mode | Indicators | Research | Scenarios |
|------|------------|----------|-----------|
| **SMOKE** | "smoke", "quick", "sanity", "basic check" | Skip all | Single minimal pass |
| **FOCUSED** | "verify [feature]", "test [area]", "check [X]" | Targeted (sub-agents 1 + 2 only, target area only) | 1–3 scenarios for target area |
| **CUSTOM** | Inline scenarios or file path provided | Skip all | User-provided scenarios |
| **FULL** | Default / "comprehensive" / "full regression" | All 3 sub-agents | Complete scenario set |

### Detection Logic

1. **Check for SMOKE indicators** — if any smoke phrases are present, set `TESTING_MODE = SMOKE`.
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
 SMOKE:    Skipping research, single minimal scenario
 FOCUSED:  Target: [feature/area name]
 CUSTOM:   N predefined scenario(s) loaded
 FULL:     Complete research + all scenarios
═══════════════════════════════════════════════════════
```

### Project Discovery

Resolve the test project `.csproj` path and store it as `TEST_PROJECT_PATH` for use throughout the skill:

1. **Check CLAUDE.md** — look for an explicit test project path or `dotnet test` command. If found, extract the project path.
2. **If not found in CLAUDE.md** — glob for test project files:
   ```bash
   find . -name "*.E2E*.csproj" -o -name "*.AutoTests.csproj" -o -name "*.Tests.csproj" 2>/dev/null
   ```
3. **If multiple found** — use `AskUserQuestion` to ask the user which test project to use.
4. **If none found** — use `AskUserQuestion` to ask the user for the test project path.

Print the resolved path:
```
 Test Project: [TEST_PROJECT_PATH]
```

---

## Phase 1: Research (Mode-Conditional)

Research depth is determined by `TESTING_MODE`:

| Mode | Sub-agent 1 (Journeys) | Sub-agent 2 (DB) | Sub-agent 3 (Bugs) | Print |
|------|------------------------|------------------|---------------------|-------|
| **SMOKE** | SKIP | SKIP | SKIP | `Skipping research — smoke test mode.` |
| **CUSTOM** | SKIP | SKIP | SKIP | `Predefined scenarios detected — skipping all research.` |
| **FOCUSED** | Targeted on `TARGET_AREA` only | Targeted on `TARGET_AREA` tables/queries only | SKIP | `Focused research on: [TARGET_AREA] — running targeted journey and DB analysis.` |
| **FULL** | Run | Run | Run | Launch all three sub-agents simultaneously. |

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

---

## Phase 2: Scenario Generation

### Step 1 — Generate Gherkin Scenarios

Invoke `wsbaser:bdd-scenarios` via the `Skill` tool with context from the research phase:
- Pass the target area, research findings, and mode information
- For SMOKE: request a single minimal scenario
- For FOCUSED: request 1–3 scenarios targeting `TARGET_AREA`
- For CUSTOM: skip generation — use `SCENARIO_LIST` directly
- For FULL: request comprehensive scenario coverage

### Step 2 — Parallelization Analysis

Analyze the Gherkin scenarios and group them into parallel implementation tracks:
- Group by **shared page objects and infrastructure dependencies** to avoid file conflicts between agents
- Scenarios sharing the same page objects should be in the same track
- Independent feature areas can run in separate tracks
- **Maximize parallelism** — split scenarios into as many independent tracks as possible (up to 7 agents) to parallelize implementation; prefer more smaller tracks over fewer large ones

### Step 3 — User Confirmation

Present the parallelization plan and scenarios to the user via `AskUserQuestion`:

```
Planned test scenarios and parallelization:

Track 1: [scenario names — shared page context]
Track 2: [scenario names — shared page context]
...

Total: [N] scenarios across [M] tracks

Proceed with these scenarios, or would you like to adjust them?
```

Wait for the user's response:
- If they confirm (e.g. "yes", "go ahead", "looks good") — proceed.
- If they request changes — update the scenario list and re-confirm.
- If the response is ambiguous — use `AskUserQuestion` to clarify.

Do not continue until an explicit confirmation is received.

---

## Phase 3: Team Setup

### Step 1 — Create Team

```
TeamCreate with name: verify-union-{timestamp}
```

Store the team name as `TEAM_NAME` for use throughout.

### Step 2 — Create Tasks

Create one task per implementation track using `TaskCreate`:
- **subject:** "Track N: [feature area / scenario names]"
- **description:** Include the assigned Gherkin scenarios, test project path, and file ownership rules
- **activeForm:** "Implementing Track N tests"

### Step 3 — Spawn Agents

Spawn all teammates in a **single message with multiple Agent tool calls**, all with `team_name: "verify-union-{timestamp}"` parameter:

- **One `wsbaser:union-dev` agent per track** — each with `name: "track-N"` and `team_name: TEAM_NAME`
- **One persistent `wsbaser:devils-advocate` agent** — with `name: "devils-advocate"` and `team_name: TEAM_NAME`, remains active for all 3 phase gates

**Do NOT spawn the union-testing-reviewer agent during team setup.** It is spawned in Phase 5 immediately after dispatching union-dev agents, so it can perform incremental reviews as each track completes.

All agents must use the `team_name` parameter so they can receive `SendMessage` messages and participate in team coordination.

---

## Phase 4: DA Gate A — Scenario Review

Activate the persistent DA agent with the Gherkin scenarios for review.

### DA Activation Message (Gate A)

```
PHASE GATE A — Scenario Review

Review these Gherkin scenarios for coverage gaps and automability:

[Insert full Gherkin scenarios here]

Respond with APPROVED or CHANGES REQUESTED (with specific additions/removals/modifications).
```

### Process DA Feedback

- If DA responds APPROVED: proceed to Phase 5.
- If DA requests changes: incorporate the changes into the scenario list. If changes are significant (new scenarios added, existing ones removed), re-confirm with the user via `AskUserQuestion`. Then proceed.

---

## Phase 5: Implementation

Send each union-dev agent its track scenarios and implementation instructions.

### Union-Dev Activation Message

Use the template in `references/union-dev-activation.md`, filling in `[N]`, `[TEST_PROJECT_PATH]`, `[TEAM_NAME]`, and the track-specific Gherkin scenarios.

### Monitor Implementation & Dynamic Review

The union-testing-reviewer is spawned once, early in Phase 5, and performs **incremental reviews as each union-dev agent completes its track** plus a **final comprehensive review** after all tracks finish.

#### Step 1 — Spawn Reviewer Agent

Immediately after dispatching union-dev agents, spawn the reviewer as a persistent team member:

Launch a single `Agent` with `subagent_type: "default"` and `team_name: TEAM_NAME`:

```
name: "union-testing-reviewer"
```

> **Why `subagent_type: "default"`:** No dedicated `wsbaser:union-testing-reviewer` agent definition exists. The reviewer's behavior is fully defined by its activation message and the `wsbaser:union-testing` skill it loads at startup.

#### Step 2 — Reviewer Initialization Message

Send the reviewer its standing instructions immediately after spawn:

```
UNION-TESTING FRAMEWORK COMPLIANCE REVIEWER

You are a persistent code reviewer specializing in Union.Playwright.NUnit framework compliance. You will receive review requests throughout this session.

SETUP: Load the `wsbaser:union-testing` skill by invoking the Skill tool with skill: "wsbaser:union-testing". This is your single source of truth for all rules. Read it thoroughly and use it for every review.

REVIEW PROTOCOL (applied to every review request you receive):

1. Read every file in the request.
2. Check each file against ALL rules from the `wsbaser:union-testing` skill.
3. For each violation, produce:
   - File path and line number
   - Rule violated (cite the skill section)
   - Current code (the violating snippet)
   - Required fix (what it should be changed to)
   - Which union-dev agent owns this file (by track)
4. If violations found: send fix instructions to each relevant union-dev agent via SendMessage, grouped by agent. Then re-review fixed files when agents report back. Maximum 2 re-review cycles per review request. If violations persist after 2 cycles, report remaining violations to team lead and proceed.
5. When review is complete (clean or after fix cycles), send a single summary to team lead: "REVIEW COMPLETE — [result summary]"

Stand by for review requests.
```

#### Step 3 — Incremental Per-Track Reviews

As each union-dev agent completes its track and reports to team lead:

1. Collect the agent's file list from its completion report.
2. Send a review request to the reviewer:
   ```
   INCREMENTAL REVIEW — Track [N]

   Track [N] (agent: track-[N]) has completed implementation.

   Files to review:
   [INSERT FILE LIST FROM THIS TRACK'S COMPLETION REPORT]

   Review these files per your standing protocol. Send violations to track-[N] for fixing.
   ```
3. Do not wait for the review to complete before processing the next track completion — reviews run in parallel with other tracks still implementing.

#### Step 4 — Final Comprehensive Review

After **all** union-dev agents have completed and **all** incremental reviews have finished:

1. Collect the complete file list across all tracks.
2. Send a final review request to the reviewer:
   ```
   FINAL COMPREHENSIVE REVIEW

   All tracks have completed implementation. Perform a cross-track review of the complete file set.

   All files created/modified:
   [INSERT COMPLETE FILE LIST]

   Focus on issues that only appear when viewing files across tracks together:
   - Duplicate page objects or components created by different tracks
   - Inconsistent patterns across tracks
   - Cross-track [UnionInit] compatibility issues

   Per-file rule compliance was already checked in incremental reviews — only re-check files that were modified during fix cycles.
   ```
3. Wait for the reviewer to send its "REVIEW COMPLETE" message.
4. Collect the final reviewer summary and proceed to DA Gate B.

---

## Phase 6: DA Gate B — Code Review

Activate the persistent DA agent with the implemented test code for review.

### DA Activation Message (Gate B)

```
PHASE GATE B — Code Quality Review

Review the implemented test code for quality, coverage completeness, and pattern adherence.

Union-testing-reviewer findings (already addressed):
[INSERT REVIEWER SUMMARY — what violations were found and fixed, or "No violations found"]

Files created/modified by union-dev agents:
[INSERT FILE LIST]

Review focus:
1. Coverage completeness — do the implemented tests fully cover the Gherkin scenarios?
2. Test quality — are assertions meaningful? Are edge cases handled?
3. Pattern adherence — consistent naming, proper test structure, appropriate use of scenarios vs inline steps
4. Cross-track consistency — do page objects from different tracks work together coherently?

Note: Framework compliance (raw Playwright usage, [UnionInit] correctness, navigation patterns, component base classes) was already verified by the union-testing-reviewer. Focus on higher-level quality concerns.

Send findings to team lead via SendMessage.
```

### Process DA Findings

- Review the DA's findings from their message.
- If critical issues identified: assign fixes to the relevant union-dev agents via `SendMessage`, wait for completion.
- If only warnings: note them and proceed to Phase 7.

---

## Phase 7: Full Test Run

Run the complete test suite (unfiltered) to detect cross-track integration issues.

### Execute

```bash
dotnet test [TEST_PROJECT_PATH]
```

### Collect Diagnostics

Gather all test output:
- **Exit code** — 0 = all pass, non-zero = failures
- **Console output** — full test run log
- **TRX files** — look in `TestResults/` directory under the test project
- **Failure screenshots** — explore `Infrastructure/Diagnostics/` in the test project to discover where the Union framework writes them

### Display Results

```
═══════════════════════════════════════════════════════
 Full Test Run Results
═══════════════════════════════════════════════════════
 Total:   [count]
 Passed:  [count]
 Failed:  [count]
 Skipped: [count]
═══════════════════════════════════════════════════════
```

If all tests pass: skip to Phase 9.
If failures exist: proceed to Phase 8.

---

## Phase 8: DA Gate C — Failure Analysis (if failures exist)

Activate the persistent DA agent with the full test run output for failure analysis.

### DA Activation Message (Gate C)

```
PHASE GATE C — Failure Analysis

The full test run produced failures. Analyze the output and direct fixes.

Test run output:
[Insert full console output]

TRX file path: [path if found]
Screenshot paths: [paths if found]

For each failure, determine:
1. Root cause category: selector issue / timing issue / wrong assertion / environment issue / cross-track conflict / framework misuse
2. Which union-dev agent owns the failing test (by file/class)
3. Specific fix instructions

Produce structured fix instructions per agent:
  Agent: [Track N agent name]
  Failing test: [test method name]
  Root cause: [category]
  Fix: [specific actionable instructions]

Send fix instructions to each relevant union-dev agent directly.
Send a summary to team lead.
```

### Fix Cycle

1. DA sends fix instructions to relevant union-dev agents.
2. Union-dev agents apply fixes and re-run their filtered tests.
3. After all agents complete fixes, run full `dotnet test [TEST_PROJECT_PATH]` again.
4. If failures remain, repeat from DA Gate C activation.
5. **Maximum 3 fix cycles total.** After 3 cycles, proceed to Phase 9 with remaining failures noted.

---

## Phase 9: Report & Cleanup

### Step 1 — Generate Report

Invoke `wsbaser:generate-test-report` via the `Skill` tool with test results mapped from Gherkin scenarios:
- Each Gherkin scenario = one report scenario
- Each Given/When/Then step = one report step
- Include pass/fail status, failure details, screenshot paths

### Step 2 — Console Summary

```
═══════════════════════════════════════════════════════
 Union E2E Testing Complete
═══════════════════════════════════════════════════════
 Scenarios Tested:  [count]
 Tests Passed:      [count]
 Tests Failed:      [count]
 Fix Cycles Used:   [count]/3
═══════════════════════════════════════════════════════

 Report: .reports/[filename].html
═══════════════════════════════════════════════════════
```

### Step 3 — Shutdown Team

1. Send `shutdown_request` to all teammates:
   ```json
   {"type": "shutdown_request", "reason": "Verification complete"}
   ```
2. Wait for shutdown responses.
3. `TeamDelete` to clean up the team.

### Completion Checklist

Before ending this workflow, verify all of these are done:
- [ ] Console summary printed with scenario count, pass/fail counts, fix cycle count
- [ ] `wsbaser:generate-test-report` skill invoked and HTML report generated
- [ ] Shutdown requests sent to all teammates
- [ ] TeamDelete executed
- [ ] Test files left as uncommitted changes for user review
