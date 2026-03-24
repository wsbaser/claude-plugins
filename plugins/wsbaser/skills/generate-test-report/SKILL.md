---
name: wsbaser:generate-test-report
description: "Produces a self-contained Allure-style multi-scenario HTML test report at .reports/{slug}.html with sidebar navigation, per-scenario step drill-down, issue cards, code analysis, and a 'Copy fix prompt' button. Invoke after browser testing completes or when the user says 'generate test report'. Use generate-bug-report instead for single-bug verdict reports."
---

Extract test execution results from the current conversation and produce a polished, self-contained HTML report saved to `.reports/{slug}.html`.

## When to Use This Skill

Invoke whenever:
- User says "generate test report", "save test results", "document testing outcomes", or "write the report"
- Direct invocation `/wsbaser:generate-test-report`
- `verify-feature` completes and requests report generation
- Multiple test scenarios were executed and the user wants them documented

**vs. generate-bug-report:** Use this skill when there are multiple scenarios, step logs, or a test suite. Use `generate-bug-report` when a single bug was verified and you need a verdict (MITIGATED/CONFIRMED/INCONCLUSIVE).

## Phase 1 — Context Extraction

Read the entire conversation and extract the following data model. Build it as a JSON object called `REPORT_DATA`.

### Top-level fields

| Field | Description |
|-------|-------------|
| `title` | Human-readable report title, e.g. "E2E Test Report — Invoice Module" |
| `slug` | Kebab-case filename, 3–5 words, e.g. "invoice-module-e2e" |
| `subtitle` | Optional subtitle or feature context |
| `branch` | Git branch under test (run `git branch --show-current` if not in context) |
| `date` | Test date YYYY-MM-DD (today if not in context) |
| `app_url` | Base URL of app tested |
| `tester` | Who ran the tests, e.g. "Claude automated browser test" or "Manual test" |
| `scenarios[]` | Array of scenario objects (see below) |
| `screenshots[]` | Flat array of all screenshot objects (see below) |

> Optional fields (`screenshot_index`, `file_path`, `line_number`, `console_error`) may be `null` when not available. `screenshot_index` is the index into the top-level `screenshots[]` array.

### Scenario object

```json
{
  "id": 0,
  "name": "Login Flow",
  "status": "pass",
  "steps": [...],
  "issues": [...],
  "code_analysis": null
}
```

| Field | Values | Description |
|-------|--------|-------------|
| `id` | integer | Zero-based index |
| `name` | string | Scenario/journey name |
| `status` | `"pass"` / `"fail"` / `"issue"` | `fail` = step failed; `issue` = completed but with findings; `pass` = all clear |
| `steps[]` | array | Step objects |
| `issues[]` | array | Issue objects found during this scenario |
| `code_analysis` | object or null | Code context for failed/issue scenarios |

### Step object

```json
{
  "n": 1,
  "title": "Navigate to login page",
  "description": "Opened http://localhost:7000/login and verified form rendered",
  "status": "pass",
  "screenshot_index": 0,
  "console_errors": []
}
```

### Issue object

```json
{
  "description": "Form submits without validating empty required fields",
  "severity": "high",
  "file_path": "src/Forms/LoginForm.razor",
  "line_number": 42,
  "screenshot_index": 2,
  "steps_to_reproduce": ["Navigate to /login", "Leave email blank", "Click Submit"],
  "console_error": "TypeError: Cannot read property 'value' of null"
}
```

### Code analysis object (for failed/issue scenarios only)

```json
{
  "filename": "src/Forms/LoginForm.razor",
  "line_start": 38,
  "line_end": 50,
  "language": "csharp",
  "code_html": "...",
  "explanation": "The null check on line 42 is missing, allowing the form to submit when email is empty."
}
```

`code_html` is pre-rendered HTML with syntax highlight spans (`.kw`, `.ty`, `.fnn`, `.nm`, `.co`) — same convention as `generate-bug-report`.

### Screenshot object

```json
{
  "path": ".reports/screenshots/login-flow/01-login-page.png",
  "caption": "Login page loaded",
  "scenario_id": 0,
  "step_n": 1,
  "data_uri": ""
}
```

`data_uri` is filled in Phase 2. Gather paths from conversation; if a step has no screenshot, omit it from this array.

### Extraction rules

- Look for structured agent results from `verify-feature` outputs (sections like "Steps completed:", "Issues found:", "Screenshots taken:", "DB validation results:").
- Also look for inline test notes, browser action logs, and any `mcp__chrome-*` or `mcp__plugin_playwright_*` tool output in the conversation.
- If a scenario has no issues and all steps passed, set `status: "pass"`. If it has issues but completed, set `status: "issue"`. If a step explicitly failed or the scenario could not complete, set `status: "fail"`.
- If any field cannot be determined, use a sensible default (`tester: "Manual test"`, `subtitle: ""`).

---

## Phase 2 — Screenshot Encoding

Use the bundled Node.js script — do **not** write inline bash/node/python code for encoding. Inline scripts using backticks (template literals) break bash quoting, and `python3` is not available on Windows.

**Step 1 — Locate the script:**
Use Glob to find:
`~/.claude/plugins/cache/wsbaser-plugins/wsbaser/*/skills/generate-test-report/scripts/encode-screenshots.js`
Use the **most recently modified** result (Glob returns paths sorted by modification time — use the first).

**Step 2 — Build the path list:**
Collect all `path` values from `screenshots[]` into a JSON array string, e.g.:
`'[".reports/screenshots/login/01.png",".reports/screenshots/login/02.png"]'`

If `screenshots[]` is empty, skip to Phase 3 — the script and encoding steps are not needed.

**Step 3 — Run the script:**
```bash
node "<script_path>" '<json-array>' > .reports/screenshot-data.tmp
```
> Run this in bash (Git Bash on Windows). Single-quoted strings are safe in bash; if running in cmd/PowerShell, use double quotes around the JSON array instead. Always redirect to `.reports/screenshot-data.tmp` — never use `/tmp/` or env-var paths, which may not exist or resolve to Windows 8.3 short paths.

**Step 4 — Apply results:**
Read `.reports/screenshot-data.tmp` with the Read tool. Match each result by `path` back to `screenshots[]` and set `data_uri`. If `data_uri` is `null`, the file was not found — keep the entry in `screenshots[]` with `data_uri: null` (the renderer silently skips it). Delete `.reports/screenshot-data.tmp` after reading.

**Fallback:** If the script is not found, set `data_uri: null` for all screenshots and continue — the report generates without images.

---

## Phase 3 — HTML Report Generation

Locate and read the HTML template:
1. Use Glob to find it: `~/.claude/plugins/cache/wsbaser-plugins/wsbaser/*/skills/generate-test-report/assets/report-template.html`
2. Read the first result with the Read tool (use the most recently modified file if multiple versions exist)

Create `.reports/` if it does not exist.

### Overwrite protection

Before writing the file, check whether `.reports/{slug}.html` already exists:

1. Run `test -f .reports/{slug}.html` to check.
2. If the file **already exists**, find a unique name by appending an incrementing numeric suffix: try `.reports/{slug}-2.html`, then `.reports/{slug}-3.html`, and so on until the filename is available.
3. When a rename occurs, log a message: `Report file .reports/{slug}.html already exists, saving as .reports/{slug}-N.html` (where N is the suffix chosen).
4. Use the resolved filename (original or suffixed) for **both** the file write in this phase **and** the browser open command in Phase 4.

Write the resolved output file.

Embed `REPORT_DATA` at the `{{REPORT_DATA_JSON}}` placeholder. Replace `{{TITLE}}` in `<title>` with the report title (fall back to `slug` if `title` is empty).

### Status color mapping

| Status | Color var | Border | Background |
|--------|-----------|--------|------------|
| `pass` | `--green` | `--gbd` | `--gbg` |
| `fail` | `--red` | `--rbd` | `--rbg` |
| `issue` | `--amber` | `--abd` | `--abg` |

### Severity badge mapping

| Severity | Class | Text |
|----------|-------|------|
| `high` | `badge fail` | `HIGH` |
| `medium` | `badge warn` | `MED` |
| `low` | `badge info` | `LOW` |

---

## Output Rules

1. **Single self-contained file** — no external resources, no CDN imports.
2. **Screenshots as `data:` URIs only** — never file paths.
3. **Save to the resolved output filename** (see Overwrite protection in Phase 3) — create `.reports/` if it does not exist.
4. **`REPORT_DATA_JSON` must be valid JSON** — escape any special characters in strings. The entire report renders from this inline JS object; malformed JSON causes a blank page.
5. **`screenshots[]` must include `data_uri` for every screenshot that exists on disk** — set `data_uri: null` for any file not found (silently skipped in rendering).
6. If no scenarios could be extracted from context, write a minimal report with a single scenario named "No test data found" with `status: "issue"` and one step explaining that no test results were detected in the conversation.
7. **The HTML must open in a browser with no console errors** — validate all placeholders are replaced before writing.

---

## Phase 4 — Open in Browser

After writing the report file, run `open <output-filename>` to launch it in the user's default browser (use the resolved filename from Phase 3, which may include a numeric suffix if overwrite protection renamed the file).
