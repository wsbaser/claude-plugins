---
description: "Verify a bug from a code review — code analysis + browser test + HTML report. Usage: /wsbaser:verify-bug [description] [--no-start]"
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
  Edit,
  Glob,
  Grep,
  Skill,
  mcp__chrome-1__navigate_page,
  mcp__chrome-1__take_snapshot,
  mcp__chrome-1__take_screenshot,
  mcp__chrome-1__click,
  mcp__chrome-1__type_text,
  mcp__chrome-1__fill,
  mcp__chrome-1__fill_form,
  mcp__chrome-1__press_key,
  mcp__chrome-1__hover,
  mcp__chrome-1__wait_for,
  mcp__chrome-1__resize_page,
  mcp__chrome-1__evaluate_script,
  mcp__chrome-1__list_console_messages,
  mcp__chrome-1__get_network_request,
  mcp__chrome-1__list_network_requests,
  mcp__chrome-1__close_page,
  mcp__chrome-1__new_page,
  mcp__chrome-1__select_page,
  mcp__chrome-1__list_pages
---

# Bug Verification

## Flags

- **`--no-start`** — Skip dev server startup. Use when the app is already running.

## Step 0 — Resolve Bug Description

Parse the command arguments (everything that is not `--no-start`).

**If an argument was provided:** use it as the bug description.

**If no argument was provided:** scan the current conversation for a bug or code-review finding that has been discussed. Look for phrases like "bug", "issue", "finding", "DELETE fires", "null reference", "exception", etc. If a clear bug description is found in context, use it.

**If no description can be found:** ask the user:
> "What bug should I verify? Please describe the behaviour, the component or file involved, and what the expected vs actual outcome is."

Store the resolved description as `BUG_DESCRIPTION`.

## Step 1 — Chrome MCP Pre-flight

Read `~/.claude.json` using the Read tool. Parse the JSON and check whether `mcpServers` contains a key named `chrome-1`.

**If `chrome-1` is missing:**

Add it to `mcpServers`:

```json
"chrome-1": { "type": "stdio", "command": "npx", "args": ["-y", "chrome-devtools-mcp@latest", "--browser-url=http://127.0.0.1:9222"] }
```

Write the updated JSON back to `~/.claude.json`, then print:

```
════════════════════════════════════════════════════════
 Chrome DevTools MCP: Configuration Updated
════════════════════════════════════════════════════════
 Added: chrome-1 to ~/.claude.json

 ACTION REQUIRED:
 1. Restart Claude Code
 2. Re-run /wsbaser:verify-bug
════════════════════════════════════════════════════════
```

**STOP** — do not proceed further.

**If `chrome-1` is present:** continue to Step 2.

## Step 2 — Setup .reports/

1. Check if `.reports/` is in `.gitignore`. If not, append `.reports/` on a new line.
2. Create `.reports/screenshots/` if it does not exist.

## Step 3 — Start the App (skip if `--no-start`)

If `--no-start` was NOT passed:

1. Read `CLAUDE.md` (already in context) to find the dev server startup command (e.g. `npm run pb web:watch`).
2. Find `launchSettings.json` under `Properties/launchSettings.json` and read the `applicationUrl` for the profile that the startup command uses. This is the `APP_URL` for all subsequent steps.
3. Probe `APP_URL` with `curl -s -o /dev/null -w "%{http_code}" APP_URL`. If it returns `200`, the app is already running — skip startup.
4. If not running: start the dev server in the background. Poll until the port responds (15-second timeout). If it never responds, print the error and **STOP**.

If `--no-start` WAS passed: determine `APP_URL` by reading `launchSettings.json` as above (do not start the server).

## Step 4 — Launch Chrome

Run this script to launch one headless Chrome instance and store its PID:

```bash
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
PROFILE_DIR=$(mktemp -d "/tmp/chrome-verify-XXXXXX")
"$CHROME" \
  --headless=new \
  --disable-gpu \
  --disable-dev-shm-usage \
  --disable-extensions \
  --no-first-run \
  --no-default-browser-check \
  --remote-debugging-port=9222 \
  --user-data-dir="$PROFILE_DIR" \
  2>/dev/null &
CHROME_PID=$!
echo "$CHROME_PID" > /tmp/chrome-verify-pid.txt
echo "Chrome launched (PID: $CHROME_PID)"
```

Then poll `http://127.0.0.1:9222/json/version` until it returns HTTP 200, with a 15-second timeout. If it does not respond in time, print an error and **STOP**.

## Step 5 — Parallel Research

Launch **two agents simultaneously** using the Agent tool. Both run in parallel (send in a single message with two tool calls).

### Research Agent A — Code Analysis (subagent_type: Explore)

> Analyse the codebase to investigate the following bug:
>
> **Bug description:** `[BUG_DESCRIPTION]`
>
> Your goal is to produce a complete technical picture of the bug for use in a browser verification test. Return:
>
> 1. **Relevant files** — the exact file paths involved (components, services, base classes). Search by keyword using Grep and Glob if no file names are mentioned in the description.
> 2. **Call chain** — step-by-step execution path from the user action that triggers the bug to the final effect (e.g., API call, exception, wrong state). For each step, identify the method name, file, and line number.
> 3. **Triggering conditions** — the exact state the app must be in for the bug to manifest (e.g., "component in new mode", "user is not a salesperson", "list is empty").
> 4. **Guard or lack thereof** — is there a guard/check in the code that prevents the bug? If yes, quote the exact condition and line. If no, describe what is missing.
> 5. **Verdict hypothesis** — based on code alone: MITIGATED (guard present), CONFIRMED (no guard), or INCONCLUSIVE (guard present but may have edge cases). Explain why.
> 6. **Proposed reproduction steps** — a numbered list of concrete steps to reproduce the bug in a running browser. Each step should be specific: navigate to URL, click element X, fill field Y, close dialog Z. Include the expected network request to watch for (e.g., "watch for DELETE /api/invoices/0").
> 7. **Code snippet to feature in the report** — the most relevant 5–15 lines of code (the guard, the buggy call, or the fix), with filename and line numbers.
>
> Return all findings as structured text. Be specific — include file paths, line numbers, method names, and exact code where relevant.

### Research Agent B — App Structure (subagent_type: Explore)

> Analyse this application's UI structure to support a browser-based bug verification test.
>
> **Bug description:** `[BUG_DESCRIPTION]`
>
> Return:
>
> 1. **Navigation path** — the exact sequence of URLs and UI interactions to reach the screen where the bug can be triggered. Start from the app root.
> 2. **Login required** — does the app require login? If yes, note that credentials will be read from CLAUDE.local.md.
> 3. **Relevant UI elements** — the specific buttons, form fields, dialogs, or navigation items the tester needs to interact with. Include their visible labels or ARIA roles where possible.
> 4. **App URL** — confirm the base URL from launchSettings.json or CLAUDE.md if not already known.
>
> Return as structured text with concrete UI interaction descriptions.

**Wait for both agents to complete before proceeding.**

## Step 6 — Browser Test

Using the outputs from Agents A and B, execute the browser verification test directly (do not dispatch a sub-agent — run the browser steps yourself using `mcp__chrome-1__*` tools).

### Login

Read `CLAUDE.local.md` to get the `App Credentials` (email and password). Check `CLAUDE.md` for a "Playwright Login Shortcut" section — if one exists, use that exact script. Otherwise, navigate to `APP_URL`, fill the email and password fields, submit the login form, and wait until the app's main page is loaded.

### Network monitoring

Before navigating to the bug trigger point, set up network interception to capture the specific HTTP request the bug would cause (e.g., a `DELETE`, `POST`, or `GET` with an invalid ID). Use `mcp__chrome-1__evaluate_script` to attach a `fetch` interceptor or use `mcp__chrome-1__list_network_requests` after each step.

### Execute reproduction steps

Follow the reproduction steps produced by Agent A. For each step:

1. Print to console: `[Step N] DESCRIPTION`
2. Perform the browser action.
3. Take a screenshot: `mcp__chrome-1__take_screenshot` → `.reports/screenshots/{slug}/{NN}-{step-name}.png`
4. Take a snapshot (`mcp__chrome-1__take_snapshot`) to refresh element references.
5. Check console for JS errors: `mcp__chrome-1__list_console_messages`.

### Capture verdict

After the reproduction steps complete:
- Record which HTTP requests were captured (if any).
- Note whether the expected buggy request fired or was blocked.
- Determine the verdict: **MITIGATED** (guard blocked it) / **CONFIRMED** (bug reproduced) / **INCONCLUSIVE** (ambiguous results).

Print a summary:
```
════════════════════════════════════════════
 Browser Test Complete
════════════════════════════════════════════
 Verdict:      MITIGATED / CONFIRMED / INCONCLUSIVE
 Steps:        N/N passed
 Screenshots:  N saved
 Network:      N matching requests captured
════════════════════════════════════════════
```

## Step 7 — Generate Report

Invoke the `wsbaser:generate-bug-report` skill. The skill reads all context from this conversation — the bug description, code analysis, reproduction steps, network findings, screenshots, and verdict — and writes `.reports/{slug}.html`.

## Step 8 — Cleanup

### Delete screenshots

After the report is generated (all screenshots are now embedded as base64 in the HTML):

```bash
rm -rf .reports/screenshots/
```

### Kill Chrome

```bash
if [ -f /tmp/chrome-verify-pid.txt ]; then
  PID=$(cat /tmp/chrome-verify-pid.txt)
  taskkill /PID "$PID" /F 2>/dev/null || kill "$PID" 2>/dev/null
  rm -f /tmp/chrome-verify-pid.txt
  echo "Chrome stopped (PID: $PID)"
fi
```

### Final output

```
════════════════════════════════════════════════════════
 Bug Verification Complete
════════════════════════════════════════════════════════
 Bug:     [BUG_DESCRIPTION (truncated to 60 chars)]
 Verdict: MITIGATED / CONFIRMED / INCONCLUSIVE
 Report:  .reports/{slug}.html
════════════════════════════════════════════════════════
```
