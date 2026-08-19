---
name: wsbaser:verify-bdd-scenarios
description: Fast browser verification of Gherkin scenarios bdd-scenarios already wrote (.feature files). Runs each scenario sequentially, verifies every Then against the real DOM (not just screenshots), and produces an HTML report with root-cause detail for any failure — pass means it genuinely works. Requires an explicit scenario source (file path(s), a scenario name, pasted Gherkin, or "what bdd-scenarios just produced") and does nothing without one. Not for full-app regression/responsive/DB validation — use verify-feature-playwright or verify-feature for those. Trigger on "verify these scenarios", "run/execute this .feature file", "check if this scenario passes", "verify [X].feature", or right after bdd-scenarios finishes.
---

# Verify BDD Scenarios

Runs already-written Gherkin scenarios against a real browser and reports, with evidence, whether they actually pass. A reader who sees "pass" should not need to open the app and check for themselves — that trust comes from verifying each `Then` against the real DOM, not from a screenshot alone and not from assuming a step worked because nothing threw. Where something doesn't work, the report has to carry enough to fix it without anyone re-investigating from scratch.

## Step 0 — Resolve the scenario source (stop if there isn't one)

Look for, in this priority order:

1. **Explicit `.feature` file path(s)** given in the invocation or recent conversation.
2. **A specific scenario name** ("verify the 'Can see the lowest active price...' scenario in X.feature") — filters to just that `Scenario` block.
3. **Pasted Gherkin** — raw `Scenario:` text in the prompt.
4. **"What bdd-scenarios just produced"** — if the immediately preceding turn ran `bdd-scenarios`, take its Output's **File** list and any `created`/`renamed`/`moved` rows from its Folder audit tables as the file list.

If none of these resolve to at least one concrete scenario, print exactly one line —
`No scenario source provided (feature file, scenario name, pasted Gherkin, or a preceding bdd-scenarios run). Nothing to verify.`
— and stop. Verifying nothing speculatively is itself part of being fast.

## Step 1 — Parse the scenarios

For each resolved `.feature` file: read it, merge in `Background` steps (if present) as leading steps of every scenario in that file, and extract each `Scenario` as `{title, tags, steps[]}` where a step is `{keyword, text, table?}` (`Given`/`When`/`Then`/`And`/`But` — keep the original keyword for report readability, but treat `And`/`But` as continuing the preceding keyword's intent for execution purposes).

For `Scenario Outline` + `Examples`: run only the **first** Examples row. This is a confidence check, not exhaustive coverage — note in the report that only one data row was exercised.

If a scenario name filter was given, keep only matching scenarios (case-insensitive substring on title is fine). Otherwise keep every scenario in every resolved file, in file order, in on-disk order within each file — same-feature scenarios need to stay adjacent for the report to group them correctly.

Carry each scenario's `@severity-*` tag through — it maps directly to the report's issue severity if that scenario fails.

## Step 2 — Pick a browser automation backend

Try in this order and stop at the first that works, detecting only — installing or configuring a backend is a setup decision, not something to do mid-run:

1. **Chrome DevTools MCP** — `ToolSearch` a keyword query (e.g. `"navigate page snapshot console messages"`) for a connected server exposing chrome-devtools-mcp's tool set (`navigate_page`, `take_snapshot`, `list_console_messages`, etc.). Its name/prefix varies by environment — never assume one; use whatever resolves. If more than one instance is connected, use any single one.
2. **Playwright CLI** — run `playwright-cli --version`. If it succeeds, use it with a single named session (e.g. `-s=verify`).
3. **Playwright MCP** — `ToolSearch` a keyword query (e.g. `"playwright browser navigate"`) for a connected server exposing Playwright's tool set (`browser_navigate`, `browser_snapshot`, etc.). Same rule — its name varies, use whatever resolves.

Read `references/tool-adapters.md` for the exact command/tool call for each action (navigate, snapshot, click, fill, type, key, screenshot, read-console, read-value) under whichever backend you picked. Bind these to the generic verbs used in Step 5 once, then reuse them for every scenario.

If none of the three are available, print what's missing and stop.

## Step 3 — `.reports/` setup

Append `.reports/` to `.gitignore` if missing, create `.reports/screenshots/` if it doesn't exist.

**Workspace-root sandbox:** an MCP browser server's own filesystem writes (e.g. `take_screenshot`'s `filePath`) are sandboxed to whatever workspace roots *that server* was launched with — fixed at launch, not something a client-side path (absolute or relative) can escape. If the app under test lives outside those roots, a direct MCP screenshot write there will fail every time. `Bash` and `Write` aren't subject to this. So: capture every screenshot to a path inside the MCP server's own allowed roots first, then immediately `mv`/`cp` it into the target repo's `.reports/screenshots/` via Bash. Confirm the very first screenshot actually lands there before trusting the rest of the run.

## Step 4 — Start the app, always fresh, on a free port

Never reuse an already-running instance — a stale instance could be a different branch/commit, which would undermine the whole point of the report. Always boot a new one.

1. **Look for a free-port dev convention first** — grep `package.json` scripts and `CLAUDE.md` for something whose name or description mentions "free port" / "random port" (e.g. `npm run dev:free`). Use it if found — it already handles picking an unused port.
2. **Otherwise**, read `CLAUDE.md` for the standard dev-server command (the "hot reload" / "dev server" section, cross-referenced with `launchSettings.json` if it's a .NET project). Pick a free TCP port yourself and try to inject it via whatever mechanism the command supports (`--urls`, a `PORT` env var, a CLI arg); if there's no obvious override, start it as documented and read back whatever port it actually binds.
3. Start the command in the background using the tool's own backgrounding (e.g. Bash's `run_in_background: true`), redirecting stdout/stderr to a log file. The server command must *be* the backgrounded command — don't wrap it in your own `nohup … & disown` inside that call. Nesting can let the wrapper shell exit and take the server down with it silently, and can even make the launch call report failure while the server actually came up fine. Record the PID/process tree — Step 6 needs it regardless of whether this attempt succeeds.
4. Determine the real URL by watching the log for the first match of: `Using port:`, `Now listening on:` (Kestrel), `Local:` (Vite/webpack), or any `https?://(localhost|127\.0\.0\.1):\d+`. Poll that URL with `curl -s -o /dev/null -w "%{http_code}"` until it responds, capped at ~120s — a cold Blazor WASM / dotnet-watch build routinely takes 60-90s, and a shorter cap will misreport a healthy slow-starting server as failed.

If the server never comes up: print the last ~30 lines of the log and stop — do not generate a report, but still run Step 6 so nothing is left running.

A resolved port can land on one the browser itself refuses to load (e.g. Chrome's restricted-ports list — 465, 587, 995, and others historically used by mail/network protocols). If the very first navigation in Step 5 fails with an unsafe/restricted-port-style error, that's a port collision, not an app failure — go back to Step 4 and start again to get a different port.

## Step 5 — Execute, one scenario at a time, one session

Open the browser once. Start from a clean slate for the origin under test — clear cookies/localStorage or open a fresh isolated context if the backend supports it. A "pass" riding on a leftover authenticated session from unrelated prior activity is false confidence, and makes runs non-reproducible.

**Resolve authentication once, before the first scenario, if any scenario needs it.** Check `CLAUDE.local.md` (repo root and `.claude/`) for an "App Credentials" section, then `.env.example` / README for a documented test/demo account. If nothing turns up, do not fall back to signing up a new account — a real signup flow can require verification this skill has no way to complete. If no usable credentials exist and a scenario needs to be logged in, stop scenario execution there, mark every scenario that needed auth as `issue` with the reason "blocked: no usable credentials found," and proceed to Step 6/7 — an honest "couldn't verify, here's why" beats grinding toward nothing.

For each scenario, in order:

When a scenario's steps don't name a URL (Gherkin describes intent, not routes), grep the app's route/nav/page definitions for the scenario file's own folder path or the Feature's tags before opening the browser — that's usually a strong hint at where the screen lives, and is worth more than trial-and-error clicking. Finding the right component isn't always the same as finding the right entry point into it — a picker can have more than one trigger behind the same input (an icon opening a full browse/manage dialog vs. typing a character to trigger the real inline typeahead). Match the entry point to what the scenario's wording actually implies.

1. Print `[Scenario N/Total] <title>`.
2. Before capturing a screenshot or reading a value, confirm your own page is still the selected/active one — a browser instance shared with unrelated concurrent activity can have its selection change from something other than your own actions, not just at the start of the run. Walk its steps in order, translating each into the chosen backend's actions. Re-snapshot after every navigation or DOM-changing action before the next interaction — stale references are the single biggest cause of a false failure. If a snapshot right after navigation comes back sparse, the app is still hydrating — wait ~2s and snapshot again, up to 3 times, before treating the page as loaded. After any `fill`/`type`, re-read the field to confirm it holds the intended text before moving on — a debounced or slow-hydrating input can silently drop characters. The same caution applies to any value read while a `busy`/`loading`/`aria-busy` flag is set nearby — a count read mid-load can look final and be completely wrong.
3. **`Given` steps that describe backend state** (existing records, prices, configured data) can't be created here — there's no DB access, by design. Search the live UI for data that already satisfies the `Given` instead — check what's visible in a list/grid view first, and don't chase more than a couple of individual records. If nothing turns up, don't guess or force a pass — mark the scenario `issue` with a note explaining the precondition couldn't be established. A "pass" must mean the precondition was genuinely real.
4. **`When` steps** are the actions — screenshot right after the action settles.
5. **`Then` steps decide pass/fail — verify them programmatically, not visually.** Extract the actual value/text/state from the page and compare it to what the step asserts ("is 80.00" isn't satisfied by "a number is visible somewhere"). Record both the expected and the actual value in the step's description. Screenshot too, for the report. Fall back to screenshot-only evidence solely for assertions with no meaningful DOM readout (layout, an element's visual state).
6. After each scenario, check the console for errors caused by the scenario's own action, as distinct from noise the app already produces regardless of what's being tested — a client-rendered app's "since last navigation" window resets on every route change, so judge by whether an error's signature (message/URL) matches something already seen as harmless baseline noise, not by whether this exact instance happened before the current scenario. A genuinely new error demotes an otherwise-passing scenario to `issue`; recurring unrelated noise doesn't — treating it as a failure would be a false negative as damaging to trust in this report as a false pass.
7. Capture every screenshot per the workspace-root sandbox note in Step 3, landed at `.reports/screenshots/<scenario-slug>/<NN>-<step-name>.png` in the target repo.
8. Determine scenario status: `pass` only if every `Then` was verified against a real extracted value, no unexplained console errors, and no step technically failed. Otherwise `issue` (completed but something's off) or `fail` (a step itself couldn't execute).

On any `issue`/`fail`, do the root-cause pass immediately, before moving to the next scenario — this is the other half of the skill's purpose:

1. Capture what's needed to diagnose it: the failing step's expected vs. actual, any console error text, any failed/4xx/5xx network request touching the action.
2. Grep the target codebase for the visible text, component name, or endpoint involved to find the responsible file. Read just the relevant section.
3. Write a short root-cause hypothesis naming the file:line and what in the code most likely produces the observed behavior.
4. Record: the symptom (expected vs. actual), `file:line`, plain-English reproduction steps up to and including the failing one, the console error verbatim if any, severity (from `@severity-*`, else by impact), and the code snippet plus explanation — everything another Claude session needs to fix it with no other context.

Do not fix anything. This skill only diagnoses.

## Step 6 — Cleanup (always, regardless of outcome)

Run this even if a scenario failed, even if Step 4 never got the server up, even if execution was interrupted:

1. Kill whatever is listening on the port Step 4 bound (`netstat -ano | findstr :<PORT>` → `taskkill //PID <PID> //T //F` on Windows — `//T` kills the whole process tree, not just the wrapper — `lsof -ti :<PORT> | xargs kill -9` on Unix). Verify the port is actually free afterward rather than assuming the kill worked.
2. If Step 4 needed more than one attempt, the failed attempt may never have opened the port, so step 1 won't find it — it can sit there holding a file lock and break the next run's build. Kill by the PID/process tree recorded when the command was launched, in addition to killing by port.
3. Close the browser session/backend cleanly.

## Step 7 — Report

Read `references/report-generation.md` for what the report must contain and guarantee, then write the HTML directly — no bundled template, no bundled script, no other skill invoked.

After the report writes successfully, delete `.reports/screenshots/` (everything is embedded as base64 now), and open the report file.

Print a short console summary: scenarios run, pass/issue/fail counts, screenshot count, and the report path.
