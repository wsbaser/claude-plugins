---
name: wsbaser:acceptance-run
description: Builds an interactive acceptance-test runner for one ticket before it is closed — a one-screen page that walks the tester through a single continuous scenario step by step (Pass / Fail / Skip, notes, live test data, expected values, AC verdicts and a summary to paste into the ticket), opens with a "Why it exists" tab explaining the real-life domain behind the feature, and shows where the implementation stands against the ticket. Works for frontend-only, backend-only (steps become HTTP requests) and full vertical slices. Use whenever the user wants to acceptance-test, verify, QA, sign off or close a story / feature / ticket, asks "what should I click to test this", "prepare me a test run for S7C1-…", "how do I check this ticket works end to end", or wants to understand what a delivered ticket really does — even if they don't say "acceptance".
---

# Acceptance run

Turn a ticket into a page the user can run acceptance testing from, step by step, in the real app, and use to understand what was built and why it matters.

The page is built from a JSON file by `scripts/build.py` using `assets/template.html` and its script `assets/template.js.txt` (kept as .txt so code formatters leave it alone; the 7C look: navy top bar, white cards, tabs **Why it exists · Run · Test data · Expected results · How it works · Sign-off**). Your work is the content: research, the scenario, and the explanations. Don't hand-write HTML pages.

## Inputs

- A ticket key or URL (story, feature or task). Required.
- Optionally a branch or PR per repo, when the work is not merged yet. Without one, look for the ticket's commits on every branch.

## Project config

Read the project's `CLAUDE.md` and `CLAUDE.local.md`, including files they import with `@`. From them take:

- **Issue tracker** (e.g. the Jira site and project key).
- **Sibling repos** and their paths (e.g. `## Sibling Repos` with BE, FE, AI).
- **App URL, login and default tenant/company** for the test environment.

If you cannot proceed without the app URL or login, ask the user. Offer to save the answers in `CLAUDE.local.md` under `## Acceptance Testing`, for example:

```markdown
## Acceptance Testing
- App URL: https://dev.my7c.is
- Default company: Martin
- Login: from "App Credentials" above
```

Keep credentials out of the page. Never put them in the run data, step text or code snippets.

## Workflow

### 1. Read the ticket

Fetch the story with its description, ACs, comments, sub-tasks and linked issues. Use the tracker's MCP tools if they are available; otherwise use the tracker CLI. Then fetch every sub-task and linked bug too: sub-task ACs are often sharper than the story's, and a linked bug is a known issue the run must not fail for.

List the acceptance criteria as numbered `AC1…ACn`, using the ticket's own wording, shortened if needed.

### 2. Locate the implementation and decide the slice

For each repo in the config, find the ticket's commits and branches (commands in `references/research-briefs.md`). Record per repo whether the work is merged (PR number) or on a branch only.

The branch that counts is the one the ticket's PR merged into (its target branch). Git's default (`git symbolic-ref refs/remotes/origin/HEAD`) and the one `CLAUDE.md` names can disagree, and either can be stale: in one repo git said `develop`, untouched for weeks, while the work sat on `main`. Check which of them contains the ticket's commits (`git branch -r --contains <sha>`), use that one, and name it in the report when the two disagree.

- **FE only:** the steps are UI actions. The backend notes describe the existing API behaviour the screens rely on. Research the backend anyway: what the screen sends and what the server does with it decides most Expect values (a FE-only run once assumed posting sets item prices; it doesn't).
- **BE only:** the steps are HTTP requests (see "Backend-only runs" below). The UI is used only where an existing screen shows the result.
- **Vertical slice:** UI steps, with backend notes on what each action triggers server-side.

### 3. Research in parallel

Launch read-only agents in one message: one per repo that has changes, plus the backend for a FE-only ticket, using the briefs in `references/research-briefs.md`. Write the domain explanation (step 4) while they work.

While they work, read the ticket again and note what each AC really demands. Note especially the cases a happy-path click-through misses:
- validation and rejection;
- something added later still works;
- state that changes between steps;
- already-saved data that must not change.

### 4. Explain the domain

Work out what problem the feature solves in real life, how that works outside the software, and why the rules are the way they are. Write this into the **Why it exists** tab.

The tab opens with **one picture** (`domain.figures`, full width above the cards). It shows what the story changes for the user. Read `references/domain-picture.md` before making it. In short:
- It is a **Before / Now storyboard** of one concrete situation.
- Each lane shows the records as the app shows them, the action between them (in the Now lane, the new button), and the result as ✓ / ✕ lines in business terms, with numbers.
- Guard rails go underneath.
- Pick the example where the Before lane visibly goes wrong.
- Build it with `scripts/storyboard.py`.
- Don't draw a data chart there (axes, bars, layers, event timelines). Those belong on the answer sheet or How it works.

`build.py` refuses a run without a picture. Then add these cards:

- **main column:** the real-life problem; how it works in practice, with a before/after if the feature replaces an old approach; why it is built this way, one bullet per rule, each rule tied to its reason.
- **side column:**
  - one worked example in the domain's own form (ledger entries, a document, a request and response);
  - who feels the difference;
  - a short glossary of terms the tester will meet, including local-language terms seen in the data;
  - "Keep in mind while testing": the two or three things that actually prove the feature.

This tab is for someone who knows the software but not the business. Write it so they understand why the feature will work in real life, not only what it does.

### 5. Read the live environment (read-only)

If the config has an app URL and login, open the app in a **headless** browser. Log in and pick the default tenant, then:

- Read the tenant or company URL segment, and use it in every route link.
- Find existing records the run can use: accounts, groups, customers, items, and their real names and numbers. Prefill the test-data fields with them.
- Open the main screens once to confirm the routes load. Catch labels that differ from the code or the ticket, for example an empty cell reading "None" rather than "—".

Do not create or change anything during preparation. The run itself creates its throwaway data, named with an `AT ` prefix (`wsbaser:acceptance-verify` adds a per-run suffix, so a second run doesn't collide with the first). If there is no login, leave the fields empty: they show as amber "fill in" values.

Some text appears only after an action: a toast, a status strip after posting, an error message. Preparation can't see it, so it comes from the code. Quote it, and add it to the step's `assume` list ("strip wording after posting, from `JournalStatusStrip.razor`"). Do the same for any behaviour you inferred and did not see: a field the server sets, a total it recalculates. The page then says "Not confirmed in the app yet", and a runner that sees otherwise checks the code before calling it a product bug. In the last run, two unconfirmed assumptions (strip wording, prices set on posting) became seven red steps.

### 6. Design the run

Write **one continuous scenario**. Each step uses data that earlier steps created, so the user can run it top to bottom without planning.

- **Phases:**
  - 0 prepares the data;
  - then setup, the main behaviour, edge cases, and changes over time;
  - last, clean-up or removal.
- **Own data:** when a step changes data other people or tests rely on (an item's price, a shared setting), create a throwaway record in phase 0 and use that instead.
- **Steps:** each step is one action and one observable result. Split a step that needs two ticks.
- **Do:**
  - the menu path in bold, the `{R:route}` link, and the exact values as `{TOKEN}`s;
  - the app's own button and field names.
- **Expect:**
  - what must be on screen, quoting labels, hints and messages exactly as the code or the live app shows them;
  - for a result that is a value (an account, a total, a status, a response field), add a `key` row and set `check`, so the expected values show as a table inside the step and on the answer sheet;
  - when answer-sheet columns prove different ACs (a quantity for AC1, a price for AC2), set `key.colAc`, one AC per column. A wrong price then fails AC2 only, not every AC the step covers.
- **b (business):** one or two plain sentences on why this step matters to the end user.
- **k (backend):** endpoint, rule, error code, table, event. It is shown folded and opens when the step fails, so write it for debugging.
- **Fields:** any value the tester only learns during the run (a created id, a document number) gets a field on that step. Later steps refer to it.
- **Deviations:** where the build differs from the ticket, put a `head` on the step it affects and also list it under `how.deviations`.
- **Expected failures:** a step that fails today because of an open bug gets `known` naming it ("S7C1-5074: raw error code until the mapping ships"). The page says "Expected to fail", the summary lists the bug, and a runner classifies the failure as `known` rather than new.
- **Automatable by default:** an agent will run this page with the same login and access as the tester. Write every step so it can be done in the browser or the API, set-up included. Mark a step `human` only when it needs something outside both (a real inbox or phone, paper, a device), and first look for a way around it (the sent message in the app's log, an API read).
- **Coverage:** every AC has at least one step; check this in `ac`. Include the negative and "added later" cases from step 3. Include one step proving that already-saved or posted data does not change, whenever the feature changes rules that act on data.

Draw diagrams only where they show a mechanism the prose can't. Follow the `artifact-diagramming` skill, and use the template's SVG classes.
- A rule or decision diagram for "how the system decides".
- A run timeline on the answer-sheet tab, when the setup changes during the run and different checks expect different values.

#### Backend-only runs

Each step carries a `code` snippet the tester can paste:
- `.http` style, with the method, `{BASE}` URL, headers with a `{TOKEN}` field, and a JSON body;
- or curl.

The `e` field states the status code and the response fields to check. Add a SQL snippet only where the response cannot show the result, for example rows written to another table.

Phase 0 explains how to get a token, for example from the browser session's network tab. The token is a field on the Test data tab and never a prefilled value.

### 7. Build and look once

Write the run data as JSON, following `references/run-data.md`. Then build it:

```bash
python <skill-dir>/scripts/build.py <workdir>/run-data.json <workdir>/<ticket>-acceptance.html
```

Fix every `error:` the script reports. Read the warnings: an undefined `{TOKEN}` renders literally.

Preview once in the headless browser. A local copy needs `<!doctype html><meta charset="utf-8">` prepended; the artifact host adds it in production. Look at the **Run** tab at 1280×720 and the other tabs at 1660×820. Check that:
- the page itself does not scroll;
- nothing is clipped;
- diagrams keep their size;
- the console has no errors.

Make one pass of fixes, then publish the HTML with the Artifact tool. Use the icon `checklist` and a one-sentence description.

### 8. Report

Give the link, then say in a few lines:
- the slice and where each repo stands (merged PR or branch);
- the deviations found;
- the fields that still need values;
- anything you could not verify.

Mention that `wsbaser:acceptance-verify` can run the page automatically and put the evidence on it. The template already renders its `results` object, described in that skill's `references/results.md`.

When the user reports a defect found during the run, offer to file it under the story. Use the tracker's sub-task type with a summary starting `Bug:`, with repro steps, expected and actual results, the AC it breaks, and where in the code to start. Then add it to `meta.knownIssues` and to the affected step's `head`, and republish.

## Why the page is built this way

These come from using it on real tickets. Keep them when you adapt.

- **One screen, tabs, Previous/Next.** The tester switches between this page and the app all the time. The page must never need scrolling to find your place, and only the panes inside it scroll. Pass and Skip jump to the next open step.
- **The right thing at the right moment.**
  - Test-data inputs sit on the step that needs them.
  - A deviation note sits on the step it affects.
  - Backend detail stays folded until a step fails.
  - The answer sheet shows inside the check step.
  - Everything is also reachable from the tabs.
- **Exact strings.** Testers compare words on screen. Paraphrased labels cause false failures.
- **Domain first.** A feature that looks pointless to a developer usually solves a real bookkeeping, legal or operational problem. The first tab makes that visible before testing starts.
- **Sign-off from results.** AC verdicts are computed from the step results, and the summary copies straight into the ticket, so the outcome of a run is a record and not only a feeling.
