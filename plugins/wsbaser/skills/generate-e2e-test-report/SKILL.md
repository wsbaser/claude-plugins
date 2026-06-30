---
name: wsbaser:generate-e2e-test-report
description: Generates a self-contained, analyzable HTML report from on-disk Playwright/NUnit E2E diagnostic artifacts (the tests/results/{TestName}/{ts}/ tree, optional TRX + .feature files). Produces a run-overview dashboard, suite tree, per-test BDD-intent-vs-executed-steps view, and priority-ordered failure evidence (expected-vs-actual, failure screenshot, DOM-at-failure, correlated console + network, stack trace, flake attempts). Works BOTH in the same session that ran the tests AND in a separate session pointed at an existing results dir. Invoke on "generate e2e report", "report the test run", "show me the test results", or /wsbaser:generate-e2e-test-report. For ad-hoc manual browser testing notes use generate-test-report; for a single verified bug use generate-bug-report.
---

Turn the diagnostic artifacts a Playwright .NET + NUnit E2E run leaves on disk into one portable HTML report at `.reports/{slug}.html`. Unlike `generate-test-report` (which scrapes the conversation), this skill **reads structured artifacts from disk**, so it is deterministic and reproducible — and runnable long after the tests finished.

## When to Use

- "Generate an E2E report", "report the last test run", "show/visualize the test results", "why did these tests fail" with artifacts on disk.
- Direct: `/wsbaser:generate-e2e-test-report`.
- After running `dotnet test` on a Union/Playwright E2E project (same session) **or** against a results dir from an earlier run (separate session).

## What the report contains

L0 run-overview dashboard (totals incl. **flaky**, pass-rate bar, failure-category bars, slowest tests, status/search filters) → L1 suite/class tree → L2 per-test view: a **labelled Gherkin scenario** (matched from a `.feature` or, when none matches, **agent-generated from the test source**) followed for failures by an **agent failure-analysis card** (verdict + real one-line cause + expected/actual + the unrelated console/network noise to ignore) → L4 supporting evidence: failure screenshot, DOM-at-failure (with Blazor-crash detection), correlated console + network, stack trace, plus per-attempt tabs for flaky tests.

## Critical: capture durations + assertions (TRX)

The diagnostics tree does **not** persist per-test durations, assertion messages, or stack traces — only screenshots, console.json, network.json, page_state.json, failure_html.html, and a thin test_steps.log. Status is inferred from `final_state_PASSED|FAILED.png`. To get rich failure cards (expected-vs-actual, stack, durations, slowest-tests), the test run must emit a **TRX**:

```bash
dotnet test tests/7c.FrontEnd.E2ETests \
  --settings tests/7c.FrontEnd.E2ETests/agent.runsettings \
  --filter "FullyQualifiedName~YourTestClass" \
  --logger "trx;LogFileName=e2e.trx" 2>&1 | tee .reports/e2e-stdout.log
```

- **Same-session mode:** if you control the run, add `--logger "trx;..."` and `tee` the stdout — then pass both to this skill. If the run already happened without TRX, you can re-run to capture it, or proceed degraded.
- **Separate-session mode:** point `--results` at the existing tree; pass `--trx` if a `.trx` exists, else the report degrades gracefully (status + screenshots + console + network still render; durations/assertion/stack show as unavailable).
- Degraded is explicit, never fabricated — missing sections are labeled, and the overview shows a "run with --logger trx" hint.

## Input options (resolve these in Phase 0)

| Option | Meaning | Default |
|--------|---------|---------|
| `--results <dir>` | diagnostics results tree | `tests/7c.FrontEnd.E2ETests/bin/Debug/net8.0/tests/results` |
| `--features <dir>` | `.feature` files for BDD intent | `tests/BddScenarios` |
| `--trx <file>` | NUnit TRX (durations/assertion/stack); repeatable | none → degraded |
| `--stdout <file>` | captured `dotnet test` stdout (assertion + Output-Directory fallback when no TRX) | none |
| `--runs latest\|all` | one run per test, or every attempt (richer flake history) | `latest` |
| `--filter <regex>` | include only test folders matching | all |
| `--since <ISO\|yyyyMMdd_HHmmss_fff>` | only runs at/after this time — **scope to one session's runs** | all |
| `--screenshots failures\|all\|none` | which final-state shots to embed (size control) | `failures` |
| `--max-dom <kb>` | cap embedded failure DOM | `150` |
| `--title --branch --commit --runsettings` | run metadata for the header | inferred/empty |
| `--out <file>` | write JSON here instead of stdout | stdout |

**Decide with the user / context:** results dir (confirm if non-default project), whether a TRX exists (offer to re-run with `--logger trx` if not and they want full failure cards), `--since`/`--filter` to scope to the run of interest (a results tree accumulates hundreds of historical run folders — without scoping the report includes stale runs), and screenshot policy (`all` balloons file size; `failures` is the safe default).

## Phase 0 — Resolve sources

1. Confirm `--results` exists. If absent, ask for the path (don't guess another project's tree).
2. Detect a TRX (`Glob **/TestResults/*.trx` or a known path). If none and the user wants durations/assertions, recommend re-running with `--logger "trx;..."` (same-session) — otherwise proceed degraded.
3. Resolve `--features` (for BDD intent) and scope filters (`--since`/`--filter`) so only the runs of interest are included. In same-session mode, derive `--since` from when the run started.

## Phase 1 — Parse artifacts → REPORT_DATA

Use the bundled parser — do not hand-roll JSON extraction. Locate it (most recently modified):
`~/.claude/plugins/cache/wsbaser-plugins/wsbaser/*/skills/generate-e2e-test-report/scripts/parse-e2e-artifacts.js`
(or the source at `.../wsbaser/skills/generate-e2e-test-report/scripts/parse-e2e-artifacts.js`).

```bash
node "<parser>" --results "<dir>" --features "<feat>" \
  [--trx "<file>"] [--stdout "<log>"] [--since "<ts>"] [--filter "<re>"] \
  --screenshots failures --title "<title>" --branch "<branch>" --commit "<sha>" \
  --out ".reports/e2e-report-data.json"
```

The parser walks `{results}/{test}/{ts}/`, infers status from `final_state_*`, detects **flake** (a test with both passing and failing run folders), parses console/network/page-state/DOM/steps, matches each test to its `.feature` scenario (fuzzy by name; falls back to a `(derived)` Given/When/Then), categorizes failures (assertion / network / element-timeout / console-exception / infra), reads TRX for durations + assertion + stack when provided, and embeds screenshots as `data:` URIs per `--screenshots`. It prints a one-line summary to stderr and writes `REPORT_DATA` JSON. The data model is documented at the top of the parser and consumed by `assets/report-template.html` (`{{REPORT_DATA_JSON}}`).

If the parser prints 0 tests, the results dir is empty or fully `--since`-filtered — widen the scope and re-run.

The parser emits each test with a `diagDir` (absolute path to that test's run folder) plus two null
placeholders — `scenario` and `failureAnalysis` — that Phase 1.5 fills in. It also still emits the
fuzzy `bdd` field as a fallback; when `scenario` is present the template renders that instead.

## Phase 1.5 — Subagent enrichment: readable scenarios + failure analysis

The raw artifacts alone are hard to read: `test_steps.log` is usually near-empty (tests rarely call
`LogStepAsync`), and the headline console error at failure is often unrelated noise (e.g. a mock-PDF
`InvalidPDFException` / 404s) rather than the real cause. So enrich every test with an LLM pass **before**
injecting. Use parallel subagents (the Agent tool). Each subagent writes ONE JSON file into
`.reports/analysis/` keyed by the test's `id`; `merge-analysis.js` folds them into REPORT_DATA.

Read `.reports/e2e-report-data.json` first to get the test list (`id`, `name`, `className`, `status`,
`diagDir`, `failure.message`, `failure.stack`).

1. **BDD matching (one subagent).** Give it the full test list (id, class, name) and the `--features`
   dir. It returns, per test, the best-matching `.feature` scenario — its title and Given/When/Then
   steps — or `null` if none is a genuine match. Write each match as `{ "id", "scenario": { "source":
   "feature", "title", "steps":[{keyword,text}], "note":"<feature file>" } }`.

2. **Scenario generation (one subagent PER unmatched test).** For each test the matcher returned `null`
   for, spawn a dedicated subagent. It reads the **test method source** (find the `[Test]` method by
   `className`/`name` under `tests/7c.FrontEnd.E2ETests/Tests/…`) — not `test_steps.log`, which is empty
   — and writes a readable Gherkin scenario describing what the test actually does:
   `{ "id", "scenario": { "source": "generated", "title", "steps":[…], "note":"generated from test source" } }`.

3. **Failure analysis (one subagent PER failed test).** For each test with `status==="fail"`, spawn a
   dedicated subagent. It reads the test method source + that test's `diagDir` artifacts
   (`failure_html.html`, `console.json`, `network.json`, `page_state.json`) + `failure.message`/`stack`,
   and explains the REAL cause — separating it from unrelated noise. It writes
   `{ "id", "failureAnalysis": { "verdict": "product-bug"|"test-issue"|"infra-noise"|"flaky"|"unknown",
   "headline": "<one-line real cause>", "detail": "<short paragraph>", "expected": "<if any>",
   "actual": "<if any>", "noise": ["<red-herring console/network line>", …] } }`.

Spawn these concurrently (one message, multiple Agent calls) where independent. Tell each subagent its
exact output file path (`.reports/analysis/<id>.json`) and the precise JSON shape; instruct it to ground
every claim in the artifacts/source and never invent. Then merge:

```bash
node "<.../scripts/merge-analysis.js>" ".reports/e2e-report-data.json" ".reports/analysis" ".reports/e2e-report-data.json"
```

The merge is idempotent (in-place); skip Phase 1.5 entirely for a quick/degraded report — the template
falls back to the parser's fuzzy `bdd` and the raw root-cause card.

## Phase 2 — Inject into the template

1. Read `assets/report-template.html` (Glob the same plugin path; use the most recently modified).
2. Read the `REPORT_DATA` JSON from Phase 1.
3. Replace `{{REPORT_DATA_JSON}}` with the JSON and `{{TITLE}}` with the run title.
4. Create `.reports/` if missing.

**Overwrite protection:** if `.reports/{slug}.html` exists, append `-2`, `-3`, … until free; log the rename. Use the resolved name for both the write and the open step.

Do the replacement with a tiny Node snippet (avoids shell-quoting issues with large JSON), e.g.:
Use the bundled injector (it handles the two embedding hazards):

```bash
node "<.../scripts/inject-report.js>" "<template>" ".reports/e2e-report-data.json" "<title>" ".reports/<slug>.html"
```

The injector uses **function** replacements (a string replacement would interpret `$&`/`$1`/`$$` inside embedded DOM/console data) and escapes `</` → `<\/` plus U+2028/U+2029 in the JSON before embedding — otherwise a literal `</script>` inside the captured `failure_html.html` closes the report's `<script>` early and the page renders blank.

## Phase 3 — Verify + open

1. Confirm no `{{` placeholder remains in the output and the file is non-trivial in size.
2. Optionally open it: `open ".reports/<slug>.html"` (or report the path). It is a single self-contained file — opens via `file://`, no server.
3. Clean up the intermediate `.reports/e2e-report-data.json` if desired (keep it for re-injection during iteration).

## Output rules

1. **Single self-contained file** — no external resources/CDN; screenshots are `data:` URIs.
2. **Never fabricate** — degrade gracefully: a missing TRX means durations/assertion/stack render as unavailable, not invented. This is the opposite of conversation-scraping.
3. **Scope before generating** — a results tree accumulates historical runs; use `--since`/`--filter` so the report reflects the intended run, not every run ever recorded.
4. **Size discipline** — `--screenshots failures` by default; warn if the output exceeds ~20 MB and suggest `--screenshots none` or tighter `--filter`.
5. Valid `REPORT_DATA` JSON is mandatory — the page renders entirely from it; malformed JSON yields a blank page.
