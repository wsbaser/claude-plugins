---
name: wsbaser:acceptance-verify
description: Runs an acceptance-run page for real. Given the link to an acceptance test runner artifact (built by wsbaser:acceptance-run), it performs every step in the test environment's UI or API, checks each Expect against what the app actually shows or returns, and records evidence (asserted expected-vs-actual checks, screenshots, a real-time screen recording of every step, API calls with bodies, the action trail, console output, links to the records it created). It then republishes the same artifact with a Results tab, per-step proof and an Evidence gallery, so the user can trust the automated run instead of repeating it by hand. Use whenever the user shares an acceptance-run artifact link and asks to run it, execute it, test it, verify the ticket, "do the testing for me", collect test evidence, re-run failed steps, or check whether a story can be closed — even if they don't say "verify".
---

# Acceptance verify

Take an acceptance-run page, do what it says in the real app, and put the proof back on the same page.

**You test the way the user would, and you do all of it yourself.** You have what they have: the login, the app, the API, the code. Every step the page asks for is yours to do, including its set-up. A step you haven't done is a hole in the verdict, and "blocked" or "needs a human" on the page reads to the user as work handed back to them. So when something resists, it is a problem to solve (see "When the app resists" below), not a status to write down.

The person reading the result was not watching. They decide from the page whether the ticket can close. So every claim on the page must be something they can check: an expected value next to the actual value read from the app, a screenshot of the moment, the recording of the step, the API exchange, a link to the record. A pass without proof is worth nothing to them. A fail with a clear cause saves them an hour.

The page is the companion skill's template (`../acceptance-run/assets/template.html`), now with automated results in it. You produce results files and evidence files; `scripts/finish.py` merges them, validates them, builds the page and plans the publish. Don't hand-write HTML.

## Inputs

- The artifact link (claude.ai/artifact/… or claude.ai/code/artifact/…). Required.
- Optional scope: "only the failed steps", "phase 3", "skip the optional steps", "no video".

## 1. Load the run

1. Read the artifact with the Artifact tool (`action: "read"`). The result names the saved file holding the full page and says whether the user can edit it ("writer"). If they cannot, you will publish a new artifact at the end. Say so in the report.
2. Make a work folder in the scratchpad, e.g. `<scratchpad>/<ticket>-verify/`. Then run:
   ```bash
   python <skill-dir>/scripts/extract.py <saved page> <workdir>
   ```
   It writes `run-data.json` and prints the phases, steps, ACs, known issues and any earlier automated run.
3. Read the whole run before touching the app: every step's Do, Expect, `head` (deviation), `k` (backend) and `check` rows, the answer sheet (`key`), `how.deviations`, `meta.knownIssues` and the ACs. A deviation or known issue tells you, before you start, which failures are already explained.

## 2. Environment and safety

### Have everything the run needs before it starts

A run that discovers halfway through that it has no login, or tests the wrong build, wastes the whole run. So check once, up front, that you have each of these:

| Needed | Where it usually is |
|---|---|
| App URL of the test environment | `## Acceptance Testing` in `CLAUDE.local.md`, the project's `CLAUDE.md`, `meta.appBase` |
| Login (user and password) | `CLAUDE.local.md` ("App Credentials" or `## Acceptance Testing`) |
| Company / tenant | the same, or `meta.alias` |
| Which build to test, when the work isn't deployed | the same; otherwise the page's report names the branch |
| How to run the stack locally (only when the work isn't deployed) | backend: `verify-backend`'s `env.py` (below); frontend: `launchSettings.json`; anything else under `## Acceptance Testing` → "Local stack" |
| API base URL, only when the page has API steps | the app's own config (`appsettings*.json`) |

Read the project's `CLAUDE.md` and the repo root's `CLAUDE.local.md`, including their `@` imports. Values in the config must match `meta.appBase` and `meta.alias`.

**Missing or conflicting values: ask, then remember.** If you cannot proceed without a value (missing or conflicting), ask the user for it in one round before touching the app. Use one question per call, with the likely answers as options (e.g. the URL from the page and the one from the config when they disagree) and let the user type their own. Then save the answers in `CLAUDE.local.md` at the repo root under `## Acceptance Testing`, so the next run doesn't ask again:

```markdown
## Acceptance Testing
- App URL: https://dev.example.com
- Company: Demo
- Login: tester@example.com / <password>
- Unmerged work: build the branch's worktree and serve it on http://localhost:7000 against the dev API
```

- Add to the section; never rewrite other sections of the file. If the value already exists elsewhere in the file (an "App Credentials" section), point to it ("Login: from App Credentials above") instead of copying it.
- `CLAUDE.local.md` holds a password, so it must stay out of git. Check `git check-ignore CLAUDE.local.md`; if it isn't ignored, add it to `.git/info/exclude` (local, not committed) and say so in the report.
- The password goes nowhere else: not into run data, evidence, notes or the report.

Ask only for what is truly missing: anything you can find yourself (the API base in the app's config, the branch from the page) you look up instead. If you cannot proceed without user input, ask; never stop or write a "blocked" page instead.

Invoking this skill is permission to run the page's own steps against the configured test environment. That includes the throwaway `AT …` data the steps create and their clean-up phase. Stop and ask before going further in these cases:
- The URL looks like production (no dev/test/staging/uat/localhost marker, and the config doesn't call it a test environment).
- A step would change data the run didn't create, and the page doesn't name that data as the step's own. Ask before touching it, or create the run's own copy and use that; say so on the step.

Credentials never appear in evidence. Don't record or screenshot the login, and start recordings after it. Strip `Authorization`, `Cookie` and `Set-Cookie` headers. Replace tokens and passwords in bodies with `[redacted]`. `build.py` refuses run data that looks like it contains a credential.

## 3. Pre-flight

- **Is the work deployed? Check each repo, before any step.** A run against an environment that lacks the work only produces a page of environment failures: in one run the dev API didn't have the PR's backend, so drafts failed and most steps were blocked, and the verdict said "re-run once it is deployed". Check instead of finding out:
  1. For each repo with the ticket's work (the page's report names the PRs and branches), note the commit that holds it.
  2. Ask the environment what it runs: an app footer, a `/version` or `/health` endpoint, a response header. Compare with that commit.
  3. When it reports no version, probe for the change itself, once and read-only: a new endpoint, a new response field or error code (one `GET`, or the API's OpenAPI document), a new screen or label. Pick something from the PR's diff that only exists with the work.
  4. Deployed in every repo: test the environment. Missing in any repo: run that repo locally (next point). Say in `run.notes` which it was and how you know.
- **Not deployed: run it locally.** Test the build that holds the work, not the one that happens to be deployed.
  - **Frontend only:** build the branch's worktree and serve it against the test environment's API.
  - **Backend involved: reuse `verify-backend`'s environment** (the `7c:verify-backend` skill; its scripts are in `<7c plugin>/skills/verify-backend/scripts/`, found through the skill list's base directory or the plugin cache). It already solves the hard parts: a SQL Server container on the branch's own volume (it refuses a shared database), every migration, local-only config and secrets, and the API as a process. From the backend branch's worktree:
    ```bash
    python <vb>/env.py preflight          # read-only; exit 1 names each blocker and its fix
    python <vb>/env.py setup              # idempotent; never overwrites the developer's values
    python <vb>/env.py start              # lite: API on http://localhost:5199; --mode aspire for Dapr/pub-sub work
    python <vb>/env.py status             # api_stale: true means old code: stop, then start
    ```
    The local login is its dev user, `dev@7c.local` on company `IS000001` (password in `vb_common.py`; local-only). Its `references/troubleshooting.md` covers a failed start; read it before improvising. A fresh volume starts nearly empty, so phase 0 also creates any lookup a step needs (a customer, a period), through the app.
  - **A project without `verify-backend`:** run the backend from its worktree as its `CLAUDE.md` says, on a local database only. Never apply a branch's migrations to a shared database; if a shared one is all there is and the branch changes its schema, ask first.
  - **Frontend against the local backend:** serve the frontend worktree (the branch's, or `main` when the frontend isn't part of the work) with an untracked `7c.FrontEnd.Web/wwwroot/appsettings.Development.json` holding `{ "apiBaseUrl": "http://localhost:5199/" }`; the dev server loads it over `appsettings.json`. Check `git check-ignore` on it (the 7C frontend already ignores it); if it isn't ignored, add it to `.git/info/exclude`. Delete it when the run ends. The local API allows any origin, so nothing else changes.
  - **Database for evidence:** in the same backend worktree, `python <vb>/api.py new-run --scope <ticket>` once, then `python <vb>/api.py sql "SELECT … FROM [{{SCHEMA}}].[Table] WHERE …"` for each read. It resolves the company schema, never prints the SQL password, and writes its own evidence file, from which you take the rows for the step's `tables` entry.
  - Start every other process (the frontend) detached, so the agent harness doesn't reap it: `Start-Process … -PassThru` on Windows, `nohup setsid …` elsewhere. Wait for its ready line, check it serves the worktree you mean, keep the PID. Build before starting, never while it runs.
  - Record each build under `env.builds` (`BE: feature/x @ 1a2b3c (local, :5199)`), and say in `run.notes` that the run was local and why.
  - **When the run ends**, even BLOCKED or failed: stop the frontend you started, delete the `appsettings.Development.json` you added, and run `python <vb>/env.py stop` (it stops only what it started, refuses while another verify-backend run uses the branch, and keeps the branch volume for the next start).
  - Only when the stack truly can't be started here, after `preflight` and the troubleshooting guide, stop before phase 0 and report exactly what is missing. Don't run the steps against an environment that lacks the work.
- **Plan the automation.** Mark each step:
  - UI: browser actions;
  - API: an HTTP request, using the step's `code` snippet, sent with the app's own login (`__av.api`, below).

  There is no "manual" plan. The only steps a human must do are the ones the page itself marks `human` (something outside the browser and the API: a real inbox or phone, paper, a device, another company's system). They get `status: "manual"` with the page's reason. Every other step is yours, including visual judgements: look at the screenshot and record `observed`.
- **Set-up is not optional.** Phase 0 (or whatever creates the run's own data) always runs. Never swap the run's throwaway records for existing data: the expected values, the answer sheet and every later check are about those records, so a run on other data proves little and blocks half the page. If creating the data fails, that is the first problem to solve (see "When the app resists").
- **Unique throwaway names.** Names the page gives its throwaway data (`AT-REV1`, `AT journal`) collide with an earlier run's leftovers: a second run found the item already there and had to improvise. Give every name the run's short suffix, e.g. `AT-REV1-1101a` for run `r-2026-11-01T1700`, and put each renamed value in the first step's `values`. Values prefill Test data, so every later step and link uses the new name.
- **Assumptions and known failures.** A step's `assume` lists what the page took from the code without seeing it in the app; those are the first places to expect a correction (see "Judge, don't just compare"). A step's `known` names an issue it is expected to fail on; such a failure is cause `known`.
- **Browser.** Use a headless browser, unless the user says otherwise. Open an isolated page and set the viewport to 1440×900. Log in and pick the tenant. For a phone-size step use the browser tool's `emulate` with the page's width (e.g. 390×844, mobile, touch); a resized window stops at about 500 px.

## 4. Run the steps

Run the phases in order. Each one builds on the data the previous one created.

**You orchestrate; subagents run the phases.** If you can start subagents, give each phase to one subagent, one after another, never in parallel. Use the brief in `references/phase-brief.md`. Your own context stays free for judging results, deciding on workarounds and writing the report. A run of 27 steps done in a single context took 100 minutes and left no room for judgement. Run the phases yourself only when you cannot start subagents, or when the whole run has fewer than about 8 steps.

**After login, install the page helper.** Copy `scripts/capture.js.txt` into the work folder as `capture.js` and load it with `evaluate_script`'s `sourcePath` (the browser tool reads files only from its allowed roots: the scratchpad, not the plugin folder; if that fails, pass the text as the function). For every full page load use `navigate_page` with `initScript` set to `(<capture.js text>)()` followed by any patch, so the helper, the patch and a running ticker are back before the app starts. Prefer in-app navigation anyway; it keeps the API log. The helper gives `window.__av`:
- `begin(id)`: drops older API calls, starts the ticker, opens the step's check list;
- `check(what, target, expected, { how, ac, mode })`: reads the element (a selector or `{ text }`), compares it with the Expect wording (whitespace-normalised, `contains` by default) and keeps the check;
- `end()`: stops the ticker and returns timing, checks and the step's API calls in one object;
- `api(method, path, body)`: sends a request with the same `Authorization` header the app itself last used, so API steps run as the logged-in user. The header stays in page memory only; it is never returned, logged or written anywhere. Call it after the app has made at least one API request (any screen load does);
- `pick(inputSelector, text)`: types into a dropdown and clicks the option whose text is exactly `text`, for dropdowns whose options render outside the accessibility tree;
- `outline(selector, text)` / `clear()` for the proof shot, `text(selector)` and `has(text)` for reads, `take({ keep })` for the raw API log, `uncheck(i)` to drop a wrong check.

**Each step, five moves.** For every UI step:
1. `screencast_start` to `evidence/<run-id>/<id>.mp4`, then `__av.begin("<id>")`.
2. Do the step, then one `check` per Expect clause. For a `check` step add one per answer-sheet item with `ac` = `key.colAc[i]`, so a wrong price fails only the AC it belongs to.
3. Proof screenshot to `evidence/<run-id>/<id>-1.webp` (more as `-2`, `-3`).
4. `__av.end()` saved with `evaluate_script`'s `filePath` to `results/raw/<id>.json`, then `screencast_stop`.
5. Write `results/drafts/<id>.json` only for what a script can't know (summary, cause, failure, issue, captions, records, values, actions), then `python <skill-dir>/scripts/step.py <workdir> <run-id> <id> --key N`. It writes `results/steps/<id>.json`: status from the checks, per-AC verdicts, shots, clip, redacted API calls.

The screencast stores a frame only when the screen changes. The ticker keeps it changing, so the clip plays in real time. Never open a second tab while recording: it damaged every clip of a phase.

The step file exists before the next step starts, so a crash loses nothing and a re-run can resume. `references/evidence.md` covers each kind of evidence for UI, API and mixed steps, and how to choose the screenshot that proves the step.

**After each phase:**
1. Check the clips: `python <skill-dir>/scripts/clipcheck.py <workdir>`, open the printed `file:///…/clipcheck.html` in a page that is not recording, wait for the title `done`, save `() => window.__clipcheck` to `results/clipcheck.json`, then `clipcheck.py <workdir> --apply results/clipcheck.json`. It drops damaged clips and fixes compressed ones, with a note on the step. A problem found here is fixed in the next phase (restart the ticker, no second tab), not discovered by the reader.
2. Publish the progress: `run.json` with `"inProgress": true`, then step 5 below. The page says "Run in progress: 9 of 27 steps done". The user sees results while the run goes on and never has to ask for status.

**When the environment blocks every step** (for example, the deployed frontend and backend disagree), first try a workaround that keeps the user's path real. For a request the app sends wrong or incomplete, copy `scripts/patch.js.txt` to `<workdir>/patches/<name>.js` and fill in its rule: it already decodes Blazor's byte bodies, only fills what is missing, and counts what it changed (`window.__avPatch_<name>.hits()`). Load it after the helper, and in every `initScript`. If it works:
- mark the first affected step `fail` with cause `env`;
- describe the workaround exactly in `run.notes`, and name it in `workarounds` on each step it touched;
- carry on.

If no workaround keeps the test meaningful, stop and report.

**Verify, don't eyeball.**
- Read the expected text or value from the DOM, or from the API response, and compare it to the Expect wording, normalising only whitespace. Record each comparison as a check with `expected`, `actual` (exactly as read), `ok` and `how`.
- A step whose every Expect clause is a check is `asserted`.
- Use `observed` only when the Expect is visual (a layout, a colour, an icon) and you judged it from a screenshot you actually looked at. Say what you looked at.
- `actual` is always what the app showed, never what you hoped for.

**Judge, don't just compare.** The page was written before anyone ran it, from the ticket and the code. Some of its details will be wrong: a value sent as `0` where the page wrote `SALES`, wording quoted from another moment, numbers the form can't take, an answer-sheet value an earlier step already changed. Nobody could have known that in advance, and it is fine. What isn't fine is failing a working feature over it, or passing a broken one.

So when what you see differs from the page, stop and decide which of the two is wrong, using what is in front of you: the AC and the ticket, the contract and the code, what the app shows elsewhere, what an earlier step changed, and on a local run the database (what was actually stored tells you whether the screen or the write is wrong).
- **The app does what the AC asks; the page's detail was off.** Correct the expectation and go on. Record the check with the corrected value as `expected`, the page's text as `pageSaid` and the evidence as `why` (`"0 is StockMovementType.SALES; every enum in this API is sent as a number"`). The check holds and the step can pass. Corrections are never silent: the step and the Results tab show each one, and they feed the next version of the page.
- **The app does not do what the AC asks.** That is a failure, whatever the page said. Cause `product`, or `known` when a filed issue covers it.
- **The page can't be followed as written** (a value the form won't accept, a record that no longer exists). Adapt: pick the nearest input that tests the same thing, work out what the app should then show, and check that. Say what you changed on the step.
- **You can't tell.** Fail with cause `run` and write down what would settle it. This should be rare; look at the code first.

The test is always the AC, not the page's wording of it. Never correct an expectation to make a step pass when the behaviour the AC asks for is missing.

**One reason, one item.** Steps that fail for the same reason share an `issue`, a short title such as "Strip wording differs from the page". The Results tab then shows one item with all its steps as chips, instead of six red cards the reader takes for six problems.

### When a step does not hold

1. Look once more. Wait for the network to go idle or the text to appear, then read again. If it holds now, it is a pass with `"retry": true`. The page shows that honestly.
2. If it still fails, capture failure evidence:
   - a full-page screenshot;
   - console errors;
   - the API calls behind the action, with the bodies.
3. Classify the `cause`:
   - `product`: the app is wrong;
   - `known`: it matches a known issue or a deviation the page already flags;
   - `run`: you couldn't settle whether the app or the page is right (see "Judge, don't just compare"; a page detail you could settle is a correction, not a failure).
   - `env`: data or permissions in the environment. A missing deploy is not a cause here: pre-flight already moved the run to a local build.

   For `product`, take one quick look at the code named in the step's `k` or `how` text and give `failure.where` as `file:line`.
4. Decide what this does to later steps. If they need what this step should have produced, produce it another way (the API with the app's login, another screen, a fresh record) and carry on; say on the later step how its starting state was made. `blocked` is only for a later step whose starting state truly cannot exist without this one, and it names that step in `needs` (e.g. `"needs": "3.5"`). `build.py` refuses a `blocked` step without it.

### Where the run happens decides what you can see

Pre-flight settled where the run happens. Use everything that place gives you.

- **Test environment (deployed):** you see what a user sees, plus the API with the app's login. Server-side effects are checked through read endpoints.
- **Local run:** you also have the database the local backend writes to. Use it, read-only:
  - **Evidence.** For every step whose Expect is about stored data (a posting, a stock ledger row, a status, a total), read the rows the step wrote and add them as a `tables` entry with `source: "SQL: <query>"` (with `key: true` when that read is what proves the step, so it shows next to the screenshot), and as checks where the Expect names a value (`how: "SQL: dbo.X.Col for row 34"`). A screenshot shows what the app displays; the row shows what it stored. Together they prove the whole slice.
  - **Analysis.** When a step fails, look at the rows before deciding the cause: stored right and shown wrong points at the frontend or the read query; stored wrong points at the write path. Name the table and row in `failure.diagnosis`.
  - **Rules.** Only `SELECT`. Scope every query to the run's own records (their ids, the run's suffix) and the company's schema. Never set up or repair data through SQL: the app makes the data, the database only confirms it. Mask personal data and secrets in what you keep. Keep each table small (the rows that prove the point, a few columns).
  - **Access.** Through `verify-backend`'s `api.py sql` (see "Not deployed: run it locally"): it targets the branch's own container and the company schema and keeps the password out of the output. The connection string never goes into evidence.

Say in `run.notes` which of the two it was, so the reader knows how deep the evidence goes.

### When the app resists

A control you can't operate, a screen you can't reach, a request that isn't authorised: these are the runner's problems, never the user's. Work down this list and stop at the first that works:
1. The accessibility snapshot: `click`, `fill`, `press_key` by uid.
2. The DOM: find the element with `evaluate_script` (portals, popups and grid cells often sit outside the accessibility tree), then click, type or press keys on it. `__av.pick` covers dropdowns.
3. How the repo's own E2E tests drive that component (search the test project for the component or its CSS class): they encode the waits and retries it needs.
4. The component's source: which event commits the value (blur, Enter, a click on the option, a debounce), then reproduce exactly that.
5. For set-up only (data a step needs, not the action it tests): the API with the app's login.

Write what worked into the app notes so the next run starts with it. If all five fail, the step is `fail`, cause `run`, with every approach you tried in `failure.diagnosis`. That is honest about whose problem it is, and it stays red until someone fixes the runner or the app.

**Before finishing, count.** Every step has a result; no `blocked` without a failed `needs` step; no `manual` the page didn't mark `human`; no step passed on data other than the run's own. If any of these fail, go back and do the step.

## 5. Finish, preview, publish

1. Write `results/run.json`: run id, who ran it, start and end time, environment, builds and runner notes. Follow `references/results.md`. Step recordings sit on their steps, not here. For a re-run of only some steps, set `"partial": true`, so earlier results and their published files are kept. Set `"inProgress": true` for the publishes after each phase, and leave it out of the last one.
2. Build:
   ```bash
   python <skill-dir>/scripts/finish.py <workdir>
   ```
   Fix every `error:`. It checks that every referenced file exists, that every fail has a cause, and that nothing looks like a credential. It writes the page and `publish.json`.
3. Preview the page locally in the headless browser. A local copy needs `<!doctype html><meta charset="utf-8">` prepended, and a local static server so the evidence paths resolve. Check:
   - the Results tab;
   - one passed and one failed step on the Run tab;
   - a screenshot opened in the viewer, zoomed;
   - a step's recording, which must play in real time.

   Fix what looks wrong once.
4. Publish to the **same artifact** with the Artifact tool:
   - `url` = the artifact link;
   - `file_path` = the built page;
   - `root` = the work folder;
   - `files` = the first batch from `publish.json`.

   Publish any further batches to the same `url` and `file_path` with the next `files` map. A batch can include `null` entries; they remove the earlier run's files. When `batches` is empty, publish the page alone.
5. After every batch succeeded: `python <skill-dir>/scripts/finish.py <workdir> --mark-published`. The next publish then sends only new or changed files. Batches stay under 12 MB; one 42 MB publish failed with ECONNRESET.

## 6. Report

Lead with the verdict and the link. Then, in a few lines:
- each AC: pass, fail or not complete;
- every failure, with its cause and the one-line expected vs actual;
- any `human` steps from the page, with what to check (there should be none of your own making);
- what was not verified, and why;
- the records the run created.

For each `product` failure, offer to file a bug sub-task under the story (summary starting `Bug:`, with repro, expected, actual, the AC, the evidence link and where to start in the code). Then add it to `meta.knownIssues` and republish.

## What makes the evidence trustworthy

These principles shaped the page. Keep them when you adapt.

- **Proof of doing, proof of seeing, a way to check yourself.** The action trail and the recording show the step was done. The checks and screenshots show what was seen. Links to the created records let the reader look for themselves.
- **Strongest evidence first, everything reachable from the step.** On the Run tab, each step leads with its status and the expected-vs-actual table. Then come the proof screenshot and the step's recording side by side, then the key API call. The rest of the trail (actions, all API calls, data reads, console, records) is folded under the step, and it opens by itself when the step failed. The Evidence tab only regroups the same material for browsing.
- **Honest labels.** `asserted`, `observed` and `manual` tell the reader how much weight a pass carries. `retried`, `blocked` and `cause` stop a flaky or environmental problem from posing as a product verdict, or the other way round.
- **The reader's word wins.** Marks the user makes on the page override the automated ones, and a new automated run clears marks made against the old run.
