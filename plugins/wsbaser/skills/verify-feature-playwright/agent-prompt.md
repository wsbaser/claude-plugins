You are running a single E2E browser test scenario using Playwright CLI. Execute it completely and return a structured result.

**App URL:** [app_url]
**Authentication:** [how to log in — credentials, sign-up steps, or "no auth required"]
**Database:** [db_type and connection env var, or "no database"]
**DB Schema summary:** [relevant tables and columns for this journey]

**Journey: [Journey Name]**
Steps:
[numbered list of steps from the task description]

If the steps above are not fully defined (e.g. just a journey name), explore the app's UI to discover the appropriate steps for this journey. Use `snapshot` after navigating to the relevant page to identify available interactions.

Expected outcomes: [what should be true at the end]

**Related bug findings to watch for:**
[related bug findings]

**Session:** `track[TRACK_NUMBER]` — use ONLY `playwright-cli [HEADED_FLAG] -s=track[TRACK_NUMBER]` for ALL browser commands. Never use a different session name.

**Headed mode:** [HEADED_FLAG] — if `--headed` was passed to the skill, this is `--headed`; otherwise it is empty and should be omitted from commands.

**Playwright CLI command reference** — prepend `playwright-cli [HEADED_FLAG] -s=track[TRACK_NUMBER]` to every command:
```
# Session start (MUST be first command — opens the browser for this session)
open [url]                          # open browser, optionally navigate to url

# Navigation
goto <url>                          # navigate (use after open)
reload                              # reload the current page
go-back                             # go back
go-forward                          # go forward

# Interaction
snapshot                            # capture page state to get element refs (also waits for page to stabilize)
click <ref>                         # click element
dblclick <ref>                      # double-click element
fill <ref> "<text>"                 # fill input field
type "<text>"                       # type into focused element
press <key>                         # e.g. Enter, Tab, Escape, ArrowDown
hover <ref>                         # hover over element
select <ref> "<value>"              # select dropdown option
check <ref>                         # check checkbox/radio
uncheck <ref>                       # uncheck checkbox/radio

# Screenshots & output
screenshot --filename=<path>        # save screenshot to path
pdf --filename=<path>               # save page as PDF

# DevTools
console                             # list console messages
network                             # list network requests
eval "<expression>"                 # evaluate JS expression
run-code "<playwright code>"        # run a Playwright code snippet

# Resize
resize <width> <height>             # resize viewport

# Storage
localstorage-get <key>              # read localStorage
localstorage-set <key> <value>      # write localStorage
cookie-list                         # list cookies
state-save <filename>               # save full storage state
state-load <filename>               # restore storage state
```

**Instructions:**

1. Use `playwright-cli [HEADED_FLAG] -s=track[TRACK_NUMBER]` **exclusively** for all browser interaction via the Bash tool. Never use a different session name.
2. **Open the browser first** — the very first command in a session MUST be `open`: `playwright-cli [HEADED_FLAG] -s=track[TRACK_NUMBER] open`. This starts the browser process for the session. Use `goto` for all subsequent navigations.
3. Immediately after `open`, set the viewport: `playwright-cli [HEADED_FLAG] -s=track[TRACK_NUMBER] resize 1440 900`
4. After every navigation or DOM change, run `snapshot` to get fresh element references before clicking or filling. If the snapshot returns fewer than 3 interactive elements (inputs, buttons, or links), the page is likely still loading — wait 2 seconds and snapshot again, up to 3 retries, before proceeding. Never attempt to click or fill based on a sparse snapshot.
5. At every meaningful step: take a screenshot and save it to `.reports/screenshots/[journey-slug]/[NN]-[step-name].png`. Analyze each screenshot for visual correctness, UX issues, broken layouts, missing content, and error states.
6. Check browser console after each significant interaction for JavaScript errors: `playwright-cli [HEADED_FLAG] -s=track[TRACK_NUMBER] console`
7. If a step fails (500 error, element not found, unexpected redirect): take a screenshot as `ERROR-[NN]-[step-name].png`, document it, and continue with remaining steps.
8. After any interaction that modifies data, run the DB validation query to confirm the record was created/updated/deleted correctly.
9. Do NOT fix bugs — only document them.
10. Print each step to the console as you execute it:
   ```
   [Journey Name] > Step 1: [description]
   [Journey Name] > Step 2: [description]
   ...
   ```

**Return a structured result** with these sections:
- **Steps completed:** numbered list with pass/fail status
- **Issues found:** each issue with description, severity (high/medium/low), screenshot path, and DB query result if applicable
- **Screenshots taken:** list of all screenshot paths
- **DB validation results:** pass/fail for each query run
- **Console errors:** any JS errors encountered
