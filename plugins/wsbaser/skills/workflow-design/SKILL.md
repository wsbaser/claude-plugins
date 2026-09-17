---
name: wsbaser:workflow-design
description: Takes an ordered list of SKILL.md file paths (or skill names), reads each skill to infer its stage category and its named typed outputs, drafts stageSystemPrompt instructions using GATE/SPEC/BUILD/TEST templates, shows each draft to the user for approval, then generates a workflow YAML into the current project's existing workflows folder. Use this skill whenever the user wants to create a new Ask Jenny workflow from a set of known ordered skills, says "design a workflow from these skills", or to convert an existing skill pipeline into a workflow YAML. Also automatically invoked by wsbaser:workflow-discover after the user selects a candidate.
allowed-tools: Read Glob Write AskUserQuestion
---

# Workflow Design

Design an Ask Jenny multi-stage workflow YAML from an ordered set of skills. Every `stageSystemPrompt`, the workflow `description`, and every stage `description` must be approved by the user before any file is written to disk.

**Assume every skill given to you will be available when the workflow runs.** Never check, flag, or caveat installation/registration status against your own session's Skill listing — that listing is a different runtime and is irrelevant here.

## Step 1 — Read Each Skill's SKILL.md

The arguments are an ordered list of skill identifiers — either absolute file paths to `SKILL.md` files, or skill names like `wsbaser:interview`.

For each argument:
- **File path** (ends in `SKILL.md` or is an absolute path): read it directly with the Read tool
- **Skill name** (format `{namespace}:{name}` or just `{name}`): extract the slug (e.g., `interview` from `wsbaser:interview`) and search for `**/{slug}/SKILL.md` using Glob. If not found, ask the user for the file path before continuing.

Read all SKILL.md files before proceeding to Step 2.

## Step 2 — Infer Stage Category, Outputs, and Inputs

For each skill, determine its stage category by reading the SKILL.md content:

| Signal in SKILL.md | Inferred category |
|---|---|
| Writes a `.md` spec, plan, RFC, or structured report to disk as primary output | SPEC |
| Modifies source files, implements features, writes or changes code | BUILD |
| Runs tests, verifies UI behavior, checks assertions, reports pass/fail | TEST |
| Classifies, routes, or scores input and may intentionally halt the pipeline based on the verdict | GATE |
| Produces no file by default — question-based or purely conversational | CONVERSATIONAL |

**GATE vs CONVERSATIONAL**: A skill is GATE when its primary purpose is to evaluate conditions and make a binary go/no-go decision for the rest of the pipeline (e.g., routing classification, preflight checks, complexity scoring). A skill is CONVERSATIONAL when it produces advisory output without a hard stop condition.

Also determine for each skill:

**`outputs`** — every value the skill produces that a later stage or the run's record needs. Each output has a **name**, a **type**, and a **required** flag:

- **name**: what the value *is*, not which stage made it — `spec`, `rfc`, `report`, `prUrl`, `verdict`. This name is the contract: it appears in the YAML, in the `stageSystemPrompt`, and as the slot name the consuming stage sees.
- **type**: one of `file`, `file[]`, `url`, `text`, `json`. A `file` value is checked for existence on disk when the stage completes, so only type something `file` if the skill really writes it.
- **required**: defaults to `true`. Use `required: false` for a value the skill only sometimes produces (e.g. a PR url that exists only when a PR was opened).
- A skill that produces nothing a later stage can consume — it only changes code — declares `outputs: {}`. Do not invent an output the skill does not actually write; changing what a skill produces means rewriting the skill, not the workflow.
- A GATE skill's verdict is `{ type: json, required: true, schema: { enum: [...] } }` with the allowed verdict values in the enum.

**`inputs`** — which upstream outputs this stage consumes. Each is a slot: `as` (the name the agent sees), `from` (`{stageId}.{outputName}`, or a list where the first available wins), optional `fallback` (`brief.description`, `brief.title`, or `brief.acceptanceCriteria`), and `required` (defaults to `false`). The first stage in a pipeline normally has no inputs.

A stage that just wants everything the immediately preceding stage produced needs no `inputs:` at all — that is the default. Declare `inputs:` when the stage needs something from further back, needs more than one source, or needs a `fallback:` for when its source stage is disabled — and declare `inputs: []` when it should receive **nothing**. Omitting the key is not "no inputs": it opts the stage into default resolution, so the stage silently starts receiving a new slot the day its predecessor declares another output. That is not hypothetical — in `localize-open-audit`, `auto-open-pr` began receiving an undeclared `migrationReport` the moment the stage before it gained that output. An empty list is the only way to say "nothing" and have it stay true.

`from:` also takes a **list**, tried in order, first source to produce a value wins:

```yaml
inputs:
  - as: spec
    from: [interview.spec, grill-me.spec]
    fallback: brief.description
    required: true
```

Reach for the list form when two stages share a `position` — same-position stages are mutually exclusive alternatives, so whichever one actually ran fills the slot. If no source produced a value the `fallback:` applies; with no fallback the slot renders absent and names *every* source's reason, so the agent can tell "that stage was disabled" from "that stage failed".

## Step 3 — Handle GATE and Conversational Skills

### GATE skills

GATE skills classify input and may abort the workflow. They declare a `verdict` output typed `json` with the allowed values in its `schema.enum`, and use `category: SPEC` in the generated YAML. The `stageSystemPrompt` must instruct the agent to:
1. Write the verdict to a file before calling `StageComplete`, if the gate produces a verdict file (declare it as a second, `file`-typed output).
2. Call `StageComplete` with `status: 'success'` and the verdict in `outputs` when the pipeline should continue.
3. Call `StageComplete` with `status: 'abort'`, a required `reason` string, **and the same declared outputs** when the pipeline should stop.

**Required outputs are validated on the abort path too.** An abort is not an escape hatch from the contract: the verdict is precisely what justifies the halt, so it must be returned with the abort, not instead of it.

The `reason` passed to `StageComplete` must be a non-empty string explaining why the workflow is halted (e.g., `'Manual routing verdict — story requires human-led implementation'`). The workflow engine emits a `workflow_aborted` event containing this reason.

**Canonical GATE example**: `7c:route-implementation` — classifies a Jira ticket as Automated or Manual, declaring `verdict: { type: json, required: true, schema: { enum: [Automated, Manual] } }`. If the verdict is Manual, the agent calls `StageComplete({ status: 'abort', summary: ..., reason: 'Manual routing verdict — story requires human-led implementation', outputs: { verdict: 'Manual' } })` and subsequent stages (e.g., `implement-task`) are skipped. If the verdict is Automated, it calls `StageComplete({ status: 'success', summary: ..., outputs: { verdict: 'Automated' } })` and the pipeline continues.

Use the **GATE template** from Step 4 for these stages.

### Conversational skills

If any skill is CONVERSATIONAL (produces no file by default), evaluate whether the `stageSystemPrompt` can force file output before including it in the pipeline.

For each CONVERSATIONAL skill:

1. Read its SKILL.md to identify what the skill's final output is (answers, recommendations, decisions, critique, etc.).
2. Propose a file path to capture that output:
   - Interview or Q&A style → `.ask-jenny/features/{{featureId}}/decisions.md`
   - Critique or review style → `.ask-jenny/features/{{featureId}}/critique.md`
   - Analysis style → `.ask-jenny/features/{{featureId}}/analysis.md`
3. Present the proposal to the user via `AskUserQuestion`:

```
The skill "{skill-name}" is conversational — it produces no file by default.

To include it in this workflow, the stageSystemPrompt would instruct the agent to
write its output to:
  {proposed path}

This does not change the skill itself — only the instructions appended after the
skill runs change. The skill will still execute normally; it will just be asked to
also save its output to that file before calling StageComplete.

Include it with forced file output?
```

Options: **Yes, use proposed path** | **Yes, use different path** (ask for path) | **No, remove this skill**

If the user agrees, that file becomes a declared output for the stage like any other — give it a name and `type: file` in Step 2, or the agent's `StageComplete` call is rejected for returning an output nobody declared.

If the user says no: remove the skill from the pipeline and continue with the remaining skills.

## How the Prompt System Works

**`stagePrompt`** → **user prompt.** The engine renders a sectioned context block after it. Every stage receives the same four sections, in this order, plus a fifth when it is being retried:

```
## Task
{feature title — description}

## Acceptance criteria
{criteria, or "(none recorded)"}

## Prior stages
✓ interview   wrote the spec; settled on session cookies over JWT
              spec → specs/login.md
⊘ figma       [skipped] no design attached

## Your input
spec: specs/login.md

## Retry — attempt 2 of 3          ← present only when a later stage returned 'loop'
Rejected by: verify
Reason: {the rejecting stage's reason, verbatim}
```

`## Task` and `## Acceptance criteria` are rendered for **every** stage, so no stage has to reverse-engineer the goal from a file path.

**`inputs:`** → the `## Your input` section. Each declared slot arrives **by name** — not as a path appended to the end of the prompt. An absent slot is still listed, with the reason it is absent (`spec: (none — interview stage not enabled)`), so the agent is never left guessing whether it was given nothing or given something it failed to find.

**`outputs:`** → the contract the stage is held to. Every value declared in `outputs:` must be returned **by name** in the `StageComplete` call. The server rejects the call when a required output is missing, when a `file` path does not exist on disk, or when a name was never declared — the agent is told what it got wrong and gets to correct itself. A stage that produces nothing declares `outputs: {}`, and returns `outputs: {}`.

**`stageSystemPrompt`** → **system prompt.** StageComplete instructions only: which `status` to use and when, what belongs in `summary`, the exact output names to return, and — where the stage can loop or abort — what belongs in `reason`. Never mention the skill name. Do not tell the agent where to find its input; the context block already did.

`summary` is required on every call and is capped at 500 characters. It is what every later stage reads under `## Prior stages`, so instruct the agent to write it for the next agent, not for a human reading a log.

## Step 4 — Draft stageSystemPrompts

For each stage, select the matching template and fill in skill-specific details.

Every template instructs the agent to pass a `summary`. Keep the instruction phrased as a sentence count ("one to three sentences") rather than an open invitation to describe its work: the server rejects a `summary` over **500 characters** with a 400, and an agent told to "summarize everything you did" will periodically write past that and stall the stage.

### GATE template
Use when: category is GATE (classifies/routes input and may conditionally abort the pipeline)

```
After completing {brief task description}, call the StageComplete MCP tool as the
LAST action before stopping:

  If {continue condition}:
    status:  'success'
    summary: one to three sentences — the verdict and what drove it
    outputs: { {verdict output name}: '{continue value}' }

  If the pipeline should stop:
    status:  'abort'
    summary: one to three sentences — the verdict and what drove it
    reason:  '{example stop reason}'
    outputs: { {verdict output name}: '{stop value}' }

Return the verdict on the abort path too — it is what justifies the halt.
```

**A verdict is a value, not a file.** The canonical gate `7c:route-implementation` declares only `verdict: { type: json }` and writes nothing to disk, so the shape above is the default. Add a file only when the gate genuinely writes one: declare it as a second, `file`-typed output, open the prompt with `write your verdict to: {output path}`, add `{file output name}: {output path}` to both `outputs:` lines, and close with `Do NOT call StageComplete before the verdict file has been written to disk.` Never name a file output the stage does not declare — the server rejects the call as an undeclared output, and the gate burns its attempt on a file nobody asked for.

Map `category: GATE` to `category: SPEC` in the generated YAML (GATE is an internal classification only — the YAML engine does not need to distinguish gate from spec stages).

### SPEC template
Use when: category is SPEC (produces a named file output for a later stage to consume)

```
After completing {brief task description} and writing the {output description} to
{output path}, call the StageComplete MCP tool as the LAST action before stopping:

  status:  'success'
  summary: one to three sentences — what you produced and what you decided
  outputs: { {output name}: {output path} }

If this stage established acceptance criteria for the run, also pass:
  briefPatch: { acceptanceCriteria: '<testable criteria, one per line>' }

Do NOT call StageComplete before the file has been written to disk.
```

Include the `briefPatch` line only when the skill genuinely settles what "done" means for the whole run (an interview or requirements skill). It is write-once — the first stage to set acceptance criteria wins, and later ones are ignored.

### BUILD template
Use when: category is BUILD (implements code; usually declares `outputs: {}`)

```
When your implementation work is fully complete, you MUST call the StageComplete MCP tool as the LAST action before stopping.
```

`outputs: {}` is the honest declaration for a stage whose only product is code changes. If the BUILD skill does hand a value onward — a PR url, a PR id — declare it in Step 2 and replace the line with `outputs: { prUrl: <pr url> }`.

### TEST template
Use when: category is TEST (verifies, can loop back to the preceding BUILD stage)

```
When your verification work is fully complete, you MUST do both of these in order:
  1. Write a detailed findings report to:
        .ask-jenny/features/{{featureId}}/verify-report.md
     Include every issue found, its severity, and suggested fixes.
  2. Call the StageComplete MCP tool as the LAST action before stopping:

       If no issues found:
         status:  'success'
         summary: what you exercised and the result
         outputs: { report: .ask-jenny/features/{{featureId}}/verify-report.md }

       If issues found:
         status:  'loop'
         summary: what you exercised and what failed
         reason:  the specific defect {preceding BUILD stage label} must fix — name the
                  file and the behavior, not "see the report"
         outputs: { report: .ask-jenny/features/{{featureId}}/verify-report.md }
```

`reason` is mandatory on `loop`. It is reproduced verbatim in the retried stage's `## Retry` section and is the only routing signal that stage acts on, so a vague reason wastes a whole retry.

Substitute all placeholders with skill-specific values from Step 2:
- `{brief task description}` → what the skill does (from its frontmatter description)
- `{output name}` → the name of the output from Step 2 (e.g. `spec`, `rfc`, `report`)
- `{output description}` → what that output is in words (e.g. "feature specification")
- `{output path}` → the path the skill writes it to
- `{verdict output name}` → the GATE stage's `json` verdict output
- `{file output name}` → the GATE stage's `file` output, **only if it declares one** — most gates do not
- `{preceding BUILD stage label}` → the `label` field of the most recent BUILD stage in the pipeline

### Linkable file outputs

Use when: a stage already declares a `file` output — from the SPEC, BUILD, or TEST template, category doesn't matter — and that file should be reachable by URL — for a human reading the PR, or for a later stage to surface as a link — not just as a worktree-relative path.

Layer this on top of whichever template already produces the file output. Before the stage's `StageComplete` call, insert a call to the `GetArtifactLink` MCP tool with the file's path, worktree-relative (the same string the stage passes to `StageComplete` — absolute paths are rejected), then declare a companion output of `type: url` alongside the existing `file` output. This is the same shape already used for `prUrl` in the BUILD template above: a URL is just another output a stage can hand forward. `GetArtifactLink` is how that URL gets minted specifically when the thing being linked is a file this run itself wrote, rather than an external resource like a PR.

Minting can fail (the file isn't `.html`, or resolves outside the worktree), so the companion output is always `required: false`, and the `stageSystemPrompt` must instruct the agent: if `GetArtifactLink` succeeds, include the URL in the `StageComplete` outputs; if it fails, note it in one line of `summary` and omit the output — never block or retry on it.

**Concrete example**: `bugfix-systematic-debugging.yaml`'s `fix-and-verify` stage (BUILD category) writes a `report` file output and adds a companion `reportUrl`:

```yaml
outputs:
  report: { type: file, required: true, description: HTML verification report }
  reportUrl: { type: url, required: false, description: Public link to the verify-report.html artifact }
stageSystemPrompt: |
  ...after writing the report to .reports/{{featureId}}/verify-report.html,
  call the GetArtifactLink MCP tool with that path before calling StageComplete.

  If it succeeds, include reportUrl in the outputs of your StageComplete call.
  If it fails, log a one-line warning in summary and omit reportUrl — do not
  block or retry on this failure.
```

The consuming stage (`commit-push-pr`) declares the matching input and surfaces it only when present:

```yaml
inputs:
  - as: reportUrl
    from: fix-and-verify.reportUrl
    required: false
stageSystemPrompt: |
  ...if reportUrl is present, put it as a bold line near the top of the PR
  description, e.g. **Verification report:** <reportUrl>
```

## Authoring the descriptions

The root `description` is the workflow's **selection contract**. The `/please` skill reads it — together with the stage descriptions — from the `ListWorkflows` catalog to pick a workflow without loading full definitions, so it is the most selection-critical text in the file. Draft it here, before the approval loop, from facts already gathered in Steps 1–3 — never from imagination.

### Locate the destination folder now

Step 7 writes into the project's existing workflows folder, and the "Not for" clause below needs that folder's workflow ids. Find it here — do not hardcode a path:

- Search for `*.yaml` files whose path contains a `workflows` segment (e.g. via Glob `**/workflows/*.yaml`), excluding `node_modules` and `.worktrees`.
- If matches are found, the folder that contains the most existing workflow YAMLs is the destination.
- If no workflows folder exists, the destination is `.ask-jenny/workflows/` (Step 7 creates it).
- Read the `id:` and `description:` lines of every YAML in the destination — these are the siblings the new workflow could be confused with.

Step 7 reuses this result; do not glob again there.

### Workflow `description` — six clauses, fixed order

One free-text sentence-run, ≤ ~500 characters, containing all six clauses in this order. Each is mandatory:

| # | Clause | Form |
|---|---|---|
| 1 | What it produces | one clause, plain words |
| 2 | Entry precondition | `Use when {what the task hands it: Jira story, Figma URL, PR id, known root cause, in-progress merge, …}` |
| 3 | Gates | `stops for a human at {stage(s) / what for}` **or** the literal `Runs unattended` |
| 4 | External deps | `Requires {Azure DevOps, Jira, Confluence, Figma, browser/running app, Storybook, Union, Chrome DevTools MCP, …}` **or** `Requires nothing external` |
| 5 | Delivery | `Ships {opens a PR \| posts a comment and vote \| posts a comment (no vote) \| report only \| code on the branch}` — one of these, or several joined with `and` (composition rule below) |
| 6 | Disambiguation | `Not for {sibling workflow id} ({the one fact that separates them})` — several siblings as `Not for {id-a} ({fact}), {id-b} ({fact})`, or `Not for {id-a}, {id-b} ({shared fact})` |

No slash-command names, no plugin provenance ("from the 7c-work-DEV plugin"), no implementation detail. The literal markers `Use when`, `Requires`, `Ships`, `Not for`, and `stops for a human` / `Runs unattended` must appear verbatim — Step 6 validates on them.

**Where each clause comes from:**

- **Produces / Use when** — the constituent skills' frontmatter `description` lines (Step 1), read as a pipeline: the first stage's precondition is the workflow's entry condition, the last stage's product is what the workflow produces.
- **Gates** — the Step 2/3 categories. An interview, approval, or CONVERSATIONAL stage, or any stage whose `stageSystemPrompt` asks the user something, is a human stop — name the stage and what it stops for. No such stage → `Runs unattended`. A GATE stage that can abort is not a human stop, but say so next to this clause (`Runs unattended, aborting when the ticket routes to Manual`).
- **Requires** — skills whose SKILL.md calls Azure DevOps, Jira, Confluence, Figma, a browser or running app, Storybook, Union, or Chrome DevTools MCP. Nothing of the kind → `Requires nothing external`.
- **Ships** — a stage declaring a `prUrl` output → `opens a PR`; a stage that posts a review comment and sets a vote → `posts a comment and vote`; a comment without a vote → `posts a comment (no vote)`; only a `report` file output → `report only`; code changes and no PR → `code on the branch`. **Composition rule:** a workflow often makes more than one delivery — list every one it makes, in the fixed order PR → comment/vote → report → code, joined with `and` (`opens a PR and posts a comment and vote`, `code on the branch and posts a comment (no vote)`). Append `, uncommitted` to `code on the branch` when nothing is committed, and name optional downstream stages after a semicolon (`code on the branch, uncommitted; optional PR and audit stages`).
- **Not for** — the sibling in the destination folder with the most overlapping purpose; put the single fact that decides between them in parentheses right after the id (where the spec comes from, known vs unknown root cause, PR opened vs not, output medium, …). When two or more siblings are confusable, list each with its own parenthetical fact, or share one parenthetical when the same fact separates them all.

**Worked example** — a hypothetical `bugfix-known-cause` pipeline (plan and implement a diagnosed fix with in-browser verification → re-run the reproduction → commit/push/PR), landing next to an existing `bugfix-systematic-debugging` workflow:

```yaml
description: >-
  Fixes a bug whose root cause is already known and delivers the fix as a pull request with
  a before/after verification report. Use when the task hands you a diagnosed defect plus a
  reproduction — not a symptom still to be investigated. Runs unattended. Requires a running
  app and Chrome DevTools MCP for the screenshots. Ships opens a PR. Not for
  bugfix-systematic-debugging (unknown root cause).
```

**Multi-sibling "Not for"** — a PR-audit workflow that is confusable with three siblings lists each with its own separating fact; two siblings separated by the same fact share one parenthetical:

```yaml
# per-sibling facts
description: … Ships opens a PR and posts a comment and vote. Not for review-pr (posts nothing), collect-test-evidence (no vote), fix-pr-comment (changes code).
# one shared fact
description: … Ships opens a PR. Not for bugfix-plan-implement-auto, mp-triage-implement-ship (they build first).
```

### Stage `description` — one sentence each

Every stage carries a `description` (one sentence, ≤ ~200 characters) that states, in this order:

1. what the stage does;
2. whether it **stops for a human** (interview, approval, `AskUserQuestion`) or is **unattended**;
3. for a stage carrying `retryTarget`: `loops back to {retryTarget} when {condition}`.

Draft each from the skill's frontmatter description plus its Step 2 category and Step 4 template — a TEST stage that returns `loop` always gets clause 3. A stage that interviews the user reads, e.g., `…; stops for a human to approve the scenarios`.

**Worked example** — the same pipeline:

```yaml
- id: plan-implement-and-verify
  description: Plans and implements the known fix, confirms it in-browser with before/after screenshots, and writes the verification report; unattended.
- id: verify-fix
  description: Re-runs the reproduction against the fix and loops back to plan-implement-and-verify when the defect still reproduces; unattended.
- id: commit-push-pr
  description: Commits, pushes, opens the PR, and attaches the verification report as a PR comment; unattended.
```

Keep the drafted workflow `description` and every stage `description`; Step 5b puts them in front of the user.

## Step 5 — User Approval Loop

Present each stageSystemPrompt to the user for review and approval, **one at a time**, using `AskUserQuestion`. Do not proceed to Step 5b until every stage has been resolved.

```
Stage {N}/{Total} — {skill-name} ({SPEC|BUILD|TEST})
────────────────────────────────────────
Skill:    {full skill name, e.g. wsbaser:interview}
Category: {SPEC | BUILD | TEST}
Produces: {each output as "name: type → path", or "nothing (outputs: {})"}
Consumes: {each input slot as "name ← stageId.output", or "nothing"}

Proposed stageSystemPrompt:
┌──────────────────────────────────────────────────────┐
{draft text}
└──────────────────────────────────────────────────────┘
```

Options per stage:
- **Approve** — accept as-is
- **Edit** — replace with custom text (prompt the user to paste their version)
- **Skip this stage** — remove it from the pipeline (confirm before removing)

Store each approved or edited text; it will be used verbatim in the YAML.

## Step 5b — Approve the Descriptions

Once every `stageSystemPrompt` is resolved, present the drafted workflow `description` and **every** stage `description` from "Authoring the descriptions" in one `AskUserQuestion`, next to the clause checklist. Mark a clause `[x]` when its literal marker is present in the draft and `[ ]` when it is not — a `[ ]` means the draft is not approvable yet, so fix it before asking:

```
Workflow description
────────────────────────────────────────
{drafted description}

  [x] produces        [x] Use when        [x] stops for a human / Runs unattended
  [x] Requires        [x] Ships           [x] Not for {sibling id} ({separating fact})
  length: {N} chars (target ≤ 500)

Stage descriptions
────────────────────────────────────────
{stage-id}   {drafted stage description}
             [x] what it does   [x] stops for a human / unattended   [x] loops back to … (retryTarget stages only)
{stage-id}   …
```

Options:
- **Approve** — accept the workflow description and all stage descriptions as drafted
- **Edit** — the user supplies replacement text for one or more entries (ask which, then the text); re-render the whole block with the changes applied and ask again

Loop until the user picks **Approve**. Do not proceed to Step 6 — and do not write any file — until then. The approved texts are used verbatim in the YAML.

## Step 6 — Generate Workflow YAML

Once all stageSystemPrompts and descriptions are approved, assemble the `WorkflowDefinition` YAML.

**Derive fields for each stage:**
- `id`: kebab-case slug from the skill name (e.g., `interview` from `wsbaser:interview`)
- `label`: `/` + the skill's short name without namespace (e.g., `/interview`)
- `stagePrompt`: `/` + the full skill command (e.g., `/wsbaser:interview`)
- `position`: 0-based integer, incremented by 1 for each sequential stage
- `category`: the inferred category from Step 2 (a GATE stage emits `SPEC`)
- `required`: `true` for all stages unless the user requested otherwise
- `description`: the stage description approved in Step 5b, verbatim
- `outputs`: the outputs inferred in Step 2, as `{name}: { type, required, description }`. **Always emit the key** — a stage that produces nothing gets `outputs: {}`, which is a declaration, not an omission. A GATE stage emits its verdict as `{ type: json, required: true, schema: { enum: [...] } }`.
- `inputs`: the input slots inferred in Step 2, as a list of `{ as, from, fallback, required }`. Omit the key on the first stage, and on any stage that simply consumes everything the immediately preceding stage produced — that is the default resolution. Emit `inputs: []` for a stage that should receive nothing, so it does not silently inherit whatever its predecessor later starts producing.
- `retryTarget`: for TEST stages, set to the `id` of the preceding BUILD stage
- `maxRetries`: set to `2` on the **TEST stage that returns `loop`** — the same stage that carries `retryTarget`. The loop budget belongs to the stage doing the rejecting, not the stage being re-run.

  > **This one fails silently.** The engine reads `maxRetries` off the stage that returned `loop`. Put it on the BUILD stage instead — the retry target — and the rejecting stage's budget resolves to `0`, so the loop is refused on the first rejection and the run ends looking like a clean failure. Nothing warns you. Equally, `maxRetries` on a stage with no `retryTarget` is unreachable configuration that reads to every future maintainer as a working retry loop.

**Root fields:** `id`, `name`, and `description` are all required. `description` is the six-clause selection contract approved in Step 5b, verbatim — the loader skips a workflow whose `description` is missing or blank, exactly as it skips one without an `id`.

**YAML structure:**

```yaml
id: {kebab-case slug derived from the workflow purpose, e.g. "spec-build-verify"}
name: {human-readable name, e.g. "Spec → Build → Verify"}
description: {REQUIRED — the approved six-clause selection contract: produces · Use when · stops for a human at / Runs unattended · Requires · Ships · Not for}

stages:
  - id: {spec-stage-id}
    label: /{short-label}
    category: SPEC
    position: 0
    required: true
    description: {approved Step 5b text — what it does; unattended or stops for a human}
    stagePrompt: /{full-skill-command}
    outputs:
      {output-name}: { type: file, required: true, description: {what it is} }
    stageSystemPrompt: |
      {approved text verbatim}

  - id: {build-stage-id}
    label: /{short-label}
    category: BUILD
    position: 1
    required: true
    description: {approved Step 5b text — what it does; unattended or stops for a human}
    stagePrompt: /{full-skill-command}
    inputs:
      - as: {slot-name}
        from: {spec-stage-id}.{output-name}
        fallback: brief.description
        required: true
    outputs: {}
    stageSystemPrompt: |
      {approved text verbatim}

  - id: {test-stage-id}
    label: /{short-label}
    category: TEST
    position: 2
    required: true
    description: {approved Step 5b text — what it does; unattended or stops for a human; loops back to {build-stage-id} when …}
    retryTarget: {build-stage-id}
    maxRetries: 2
    stagePrompt: /{full-skill-command}
    inputs:
      - as: {slot-name}
        from: {spec-stage-id}.{output-name}
        fallback: brief.description
        required: true
    outputs:
      report: { type: file, required: true }
    stageSystemPrompt: |
      {approved text verbatim}
```

Note the TEST stage's `inputs:`. Default resolution would give it the outputs of the stage immediately before it — which is a BUILD stage declaring `outputs: {}`, so it would arrive with nothing to verify against and would declare victory on whatever it found. Reach past the BUILD stage to the SPEC output that defines what "correct" means. Any stage separated from the thing it needs by a stage that produces nothing has the same problem.

**Validate before writing:**
- `id`, `name`, and `description` are present at root, and `description` is non-blank — the loader skips the whole workflow otherwise
- The root `description` contains the six clauses from "Authoring the descriptions": at minimum the literal markers `Use when`, then either `stops for a human` or `Runs unattended`, then `Requires`, then `Ships`, then `Not for`, in that order. A missing marker fails validation — go back to Step 5b. Length ≤ ~500 characters (the bundled-workflow conformance test rejects over 600)
- Every stage has a non-empty `description` that says what it does and whether it stops for a human; a stage with `retryTarget` also says `loops back to`
- Each stage has: `id`, `label`, `category`, `position`, `description`, `stagePrompt`, `stageSystemPrompt`, `outputs`
- Every stage declares `outputs:` — `{}` is valid, a missing key is not
- Every output has a `type` from: `file`, `file[]`, `url`, `text`, `json`; a `json` verdict also has `schema: { enum: [...] }`
- Every `inputs[].from` reads `{stageId}.{outputName}` where `stageId` is a stage at an **earlier** position and `outputName` is declared in that stage's `outputs:`. A forward reference or an undeclared output name is rejected by the loader and drops the whole workflow. Where `from:` is a list, **every element** must satisfy this rule on its own — one bad entry fails the workflow even if the others resolve.
- Every `inputs[].fallback` is one of `brief.description`, `brief.title`, `brief.acceptanceCriteria`
- Any `required: true` input whose source stage is optional (`required: false`) carries a `fallback:` — without one, the run breaks the moment the user deselects that stage
- `maxRetries` appears only together with `retryTarget`, on the stage that emits `loop`; every `retryTarget` names a stage at an earlier position
- `category` is one of: `SPEC`, `BUILD`, `TEST` (GATE stages use `SPEC` in the YAML)
- Every `stageSystemPrompt` instructs the agent to pass `summary`, and to pass `reason` wherever it may return `loop` or `abort`
- Every output name used in a `stageSystemPrompt` matches a name declared in that stage's `outputs:` — a mismatch is rejected at runtime as an undeclared output
- All stage `id` values are unique within the workflow
- Each sequential stage has a unique `position` value (same position = mutually exclusive alternatives)

## Step 7 — Write YAML

### Destination folder

Use the workflows folder located in "Authoring the descriptions" — do not glob again and do not hardcode a path. If no folder existed then, create `.ask-jenny/workflows/` now.

Write the workflow YAML to:
```
{discovered-workflows-folder}/{workflow-id}.yaml
```

Do not write any README or companion `.md` file — the YAML is the only file this skill produces.

## Final Confirmation

After the YAML is written, confirm to the user:

```
✓ Workflow written to {discovered-workflows-folder}/{workflow-id}.yaml

To use this workflow, select "{Workflow Name}" in the Ask Jenny workflow selector
when creating or editing a feature.
```
