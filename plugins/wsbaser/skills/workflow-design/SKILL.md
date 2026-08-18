---
name: wsbaser:workflow-design
description: Takes an ordered list of SKILL.md file paths (or skill names), reads each skill to infer its stage category and its named typed outputs, drafts stageSystemPrompt instructions using GATE/SPEC/BUILD/TEST templates, shows each draft to the user for approval, then generates a workflow YAML into the current project's existing workflows folder. Use this skill whenever the user wants to create a new Ask Jenny workflow from a set of known ordered skills, says "design a workflow from these skills", or to convert an existing skill pipeline into a workflow YAML. Also automatically invoked by wsbaser:workflow-discover after the user selects a candidate.
---

# Workflow Design

Design an Ask Jenny multi-stage workflow YAML from an ordered set of skills. Every `stageSystemPrompt` must be approved by the user before any file is written to disk.

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

## Step 5 — User Approval Loop

Present each stageSystemPrompt to the user for review and approval, **one at a time**, using `AskUserQuestion`. Do not proceed to Step 6 until every stage has been resolved.

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

## Step 6 — Generate Workflow YAML

Once all stageSystemPrompts are approved, assemble the `WorkflowDefinition` YAML.

**Derive fields for each stage:**
- `id`: kebab-case slug from the skill name (e.g., `interview` from `wsbaser:interview`)
- `label`: `/` + the skill's short name without namespace (e.g., `/interview`)
- `stagePrompt`: `/` + the full skill command (e.g., `/wsbaser:interview`)
- `position`: 0-based integer, incremented by 1 for each sequential stage
- `category`: the inferred category from Step 2 (a GATE stage emits `SPEC`)
- `required`: `true` for all stages unless the user requested otherwise
- `outputs`: the outputs inferred in Step 2, as `{name}: { type, required, description }`. **Always emit the key** — a stage that produces nothing gets `outputs: {}`, which is a declaration, not an omission. A GATE stage emits its verdict as `{ type: json, required: true, schema: { enum: [...] } }`.
- `inputs`: the input slots inferred in Step 2, as a list of `{ as, from, fallback, required }`. Omit the key on the first stage, and on any stage that simply consumes everything the immediately preceding stage produced — that is the default resolution. Emit `inputs: []` for a stage that should receive nothing, so it does not silently inherit whatever its predecessor later starts producing.
- `retryTarget`: for TEST stages, set to the `id` of the preceding BUILD stage
- `maxRetries`: set to `2` on the **TEST stage that returns `loop`** — the same stage that carries `retryTarget`. The loop budget belongs to the stage doing the rejecting, not the stage being re-run.

  > **This one fails silently.** The engine reads `maxRetries` off the stage that returned `loop`. Put it on the BUILD stage instead — the retry target — and the rejecting stage's budget resolves to `0`, so the loop is refused on the first rejection and the run ends looking like a clean failure. Nothing warns you. Equally, `maxRetries` on a stage with no `retryTarget` is unreachable configuration that reads to every future maintainer as a working retry loop.

**YAML structure:**

```yaml
id: {kebab-case slug derived from the workflow purpose, e.g. "spec-build-verify"}
name: {human-readable name, e.g. "Spec → Build → Verify"}
description: {one-liner summary of the pipeline}

stages:
  - id: {spec-stage-id}
    label: /{short-label}
    category: SPEC
    position: 0
    required: true
    description: {what this stage does}
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
    description: {what this stage does}
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
    description: {what this stage does}
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
- `id` and `name` are present at root
- Each stage has: `id`, `label`, `category`, `position`, `stagePrompt`, `stageSystemPrompt`, `outputs`
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

### Locate the existing workflows folder

Find where the current project already stores its workflow YAMLs — do not hardcode a path. Search the project for existing workflow definitions:
- Search for `*.yaml` files whose path contains a `workflows` segment (e.g. via Glob `**/workflows/*.yaml`), excluding `node_modules` and `.worktrees`.
- If matches are found, use the folder that contains the most existing workflow YAMLs as the destination.
- If no workflows folder exists, fall back to `.ask-jenny/workflows/` (create it).

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
