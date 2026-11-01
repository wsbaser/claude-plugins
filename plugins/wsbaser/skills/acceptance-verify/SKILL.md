---
name: wsbaser:acceptance-verify
description: Runs an acceptance-run page for real. Given the link to an acceptance test runner artifact (built by wsbaser:acceptance-run), it performs every step in the test environment's UI or API, checks each Expect against what the app actually shows or returns, and records evidence (asserted expected-vs-actual checks, screenshots, one screen recording per phase, API calls with bodies, the action trail, console output, links to the records it created). It then republishes the same artifact with a Results tab, per-step proof and an Evidence gallery, so the user can trust the automated run instead of repeating it by hand. Use whenever the user shares an acceptance-run artifact link and asks to run it, execute it, test it, verify the ticket, "do the testing for me", collect test evidence, re-run failed steps, or check whether a story can be closed — even if they don't say "verify".
---

# Acceptance verify

Take an acceptance-run page, do what it says in the real app, and put the proof back on the same page.

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

Take the app URL, login and default tenant from the project's `CLAUDE.md` / `CLAUDE.local.md`, including `@` imports. They must match `meta.appBase` and `meta.alias`. If they don't match, ask which one to use.

Invoking this skill is permission to run the page's own steps against the configured test environment. That includes the throwaway `AT …` data the steps create and their clean-up phase. Stop and ask before going further in these cases:
- The URL looks like production (no dev/test/staging/uat/localhost marker, and the config doesn't call it a test environment).
- A step would change data the run didn't create, and the page doesn't name that data as the step's own. If the user doesn't answer, mark the step `blocked` with the reason and continue.

Credentials never appear in evidence. Don't record or screenshot the login, and start recordings after it. Strip `Authorization`, `Cookie` and `Set-Cookie` headers. Replace tokens and passwords in bodies with `[redacted]`. `build.py` refuses run data that looks like it contains a credential.

## 3. Pre-flight

- **Is the work deployed?** Read what the environment reports as its version: an app footer, a `/version` or `/health` endpoint, a response header. Compare it with where the ticket's work was merged (the page's report and How it works tab name the PRs). If the build plainly predates the work, stop and report this. Every step would fail for an environment reason, and that run would only mislead. If you can't tell, record `unknown` and carry on.
- **Plan the automation.** Mark each step:
  - UI: browser actions;
  - API: an HTTP request, using the step's `code` snippet;
  - manual: needs a human, e.g. an email arriving, a printout, another device, a judgement about looks.

  Manual steps get `status: "manual"` with the exact thing to check. Don't fake them.
- **Browser.** Use a headless browser, unless the user says otherwise. Open an isolated page and set the viewport to 1440×900. Log in and pick the tenant.

## 4. Run the steps

Run the phases in order. Each one builds on the data the previous one created. For each phase:

1. Start a screen recording to `evidence/<run-id>/phase-<n>.mp4`. Note the clock (`Date.now()` in the page) right after it starts. Step and action times are seconds from that moment.
2. Do each step, verify it, capture the evidence and write `results/steps/<id>.json` before starting the next step. Writing step by step means a crash loses nothing and a re-run can resume. `references/evidence.md` covers how to capture each kind of evidence for UI, API and mixed steps, and how to choose the one screenshot that proves the step.
3. Stop the recording at the end of the phase and add the video to `results/run.json`. If a phase runs past about 8 minutes, stop and start a new part (`phase-<n>b.mp4`), so no file goes over the 15 MB limit for one file.

**Verify, don't eyeball.**
- Read the expected text or value from the DOM, or from the API response, and compare it to the Expect wording, normalising only whitespace. Record each comparison as a check with `expected`, `actual` (exactly as read), `ok` and `how`.
- A step whose every Expect clause is a check is `asserted`.
- Use `observed` only when the Expect is visual (a layout, a colour, an icon) and you judged it from a screenshot you actually looked at. Say what you looked at.
- `actual` is always what the app showed, never what you hoped for.

**Long runs.** If you can start subagents and the run has more than about 12 steps, give each phase to a subagent, one after another, never in parallel. Use the brief in `references/phase-brief.md`. Each subagent drives the same browser and page you logged into, writes its own step files, and returns only a few lines. This keeps your context free for judging results.

### When a step does not hold

1. Look once more. Wait for the network to go idle or the text to appear, then read again. If it holds now, it is a pass with `"retry": true`. The page shows that honestly.
2. If it still fails, capture failure evidence:
   - a full-page screenshot;
   - console errors;
   - the API calls behind the action, with the bodies.
3. Classify the `cause`:
   - `product`: the app is wrong;
   - `known`: it matches a known issue or a deviation the page already flags;
   - `run`: the step's own instruction or expectation is wrong. For example, the label in the app is right but the page quotes another. Say what the step should say.
   - `env`: data, deploy or permissions in the environment.

   For `product`, take one quick look at the code named in the step's `k` or `how` text and give `failure.where` as `file:line`.
4. Decide what this does to later steps. If they need what this step should have produced, try a reasonable workaround. If that fails, mark them `blocked`, give the reason ("needs J4 posted in 3.5"), and move on to the next independent phase.

## 5. Finish, preview, publish

1. Write `results/run.json`: run id, who ran it, start and end time, environment, builds, runner notes and the videos. Follow `references/results.md`. For a re-run of only some steps, set `"partial": true`, so earlier results and their published files are kept.
2. Build:
   ```bash
   python <skill-dir>/scripts/finish.py <workdir>
   ```
   Fix every `error:`. It checks that every referenced file exists, that every fail has a cause, and that nothing looks like a credential. It writes the page and `publish.json`.
3. Preview the page locally in the headless browser. A local copy needs `<!doctype html><meta charset="utf-8">` prepended, and a local static server so the evidence paths resolve. Check:
   - the Results tab;
   - one passed and one failed step on the Run tab;
   - a screenshot opened in the viewer, zoomed;
   - a "Watch this step" clip.

   Fix what looks wrong once.
4. Publish to the **same artifact** with the Artifact tool:
   - `url` = the artifact link;
   - `file_path` = the built page;
   - `root` = the work folder;
   - `files` = the first batch from `publish.json`.

   Publish any further batches to the same `url` and `file_path` with the next `files` map. A batch can include `null` entries; they remove the earlier run's files.

## 6. Report

Lead with the verdict and the link. Then, in a few lines:
- each AC: pass, fail or not complete;
- every failure, with its cause and the one-line expected vs actual;
- blocked and manual steps, with what the user has to do;
- what was not verified, and why;
- the records the run created.

For each `product` failure, offer to file a bug sub-task under the story (summary starting `Bug:`, with repro, expected, actual, the AC, the evidence link and where to start in the code). Then add it to `meta.knownIssues` and republish.

## What makes the evidence trustworthy

These principles shaped the page. Keep them when you adapt.

- **Proof of doing, proof of seeing, a way to check yourself.** The action trail and the recording show the step was done. The checks and screenshots show what was seen. Links to the created records let the reader look for themselves.
- **Strongest evidence first.** Each step leads with its status and the expected-vs-actual table, then the one proof screenshot. The rest of the trail is folded, and it opens by itself when the step failed.
- **Honest labels.** `asserted`, `observed` and `manual` tell the reader how much weight a pass carries. `retried`, `blocked` and `cause` stop a flaky or environmental problem from posing as a product verdict, or the other way round.
- **The reader's word wins.** Marks the user makes on the page override the automated ones, and a new automated run clears marks made against the old run.
