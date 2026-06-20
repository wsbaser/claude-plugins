---
name: wsbaser:workflow-design
description: Takes an ordered list of SKILL.md file paths (or skill names), reads each skill to infer artifact types and stage categories, drafts stageSystemPrompt instructions using SPEC/BUILD/TEST templates, shows each draft to the user for approval, then generates a workflow YAML into the current project's existing workflows folder. Use this skill whenever the user wants to create a new Ask Jenny workflow from a set of known ordered skills, says "design a workflow from these skills", or to convert an existing skill pipeline into a workflow YAML. Also automatically invoked by wsbaser:workflow-discover after the user selects a candidate.
---

# Workflow Design

Design an Ask Jenny multi-stage workflow YAML from an ordered set of skills. Every `stageSystemPrompt` must be approved by the user before any file is written to disk.

## Step 1 — Read Each Skill's SKILL.md

The arguments are an ordered list of skill identifiers — either absolute file paths to `SKILL.md` files, or skill names like `wsbaser:interview`.

For each argument:
- **File path** (ends in `SKILL.md` or is an absolute path): read it directly with the Read tool
- **Skill name** (format `{namespace}:{name}` or just `{name}`): extract the slug (e.g., `interview` from `wsbaser:interview`) and search for `**/{slug}/SKILL.md` using Glob. If not found, ask the user for the file path before continuing.

Read all SKILL.md files before proceeding to Step 2.

## Step 2 — Infer Stage Category and Artifact Type

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
- **`artifactPath`**: file path pattern the skill naturally produces (e.g., `specs/{{slug}}.md` or `.ask-jenny/features/{{featureId}}/verify-report.md`). Use `null` if no file is produced.
- **`artifactDescription`**: brief label for the artifact (e.g., `"feature specification"`, `"RFC file"`, `"verification report"`).
- **`expects`**: what input this stage needs — `"feature description"` for the first stage, or `"artifact from [preceding stage label]"` for downstream stages.

## Step 3 — Handle GATE and Conversational Skills

### GATE skills

GATE skills classify input and may abort the workflow. They always produce an artifact (the verdict file) and use `category: SPEC` in the generated YAML. The `stageSystemPrompt` must instruct the agent to:
1. Write the verdict to a file before calling `StageComplete`.
2. Call `StageComplete` with `status: 'success'` when the pipeline should continue.
3. Call `StageComplete` with `status: 'abort'` and a required `reason` string when the pipeline should stop.

The `reason` passed to `StageComplete` must be a non-empty string explaining why the workflow is halted (e.g., `'Manual routing verdict — story requires human-led implementation'`). The workflow engine emits a `workflow_aborted` event containing this reason.

**Canonical GATE example**: `7c:route-implementation` — classifies a Jira ticket as Automated or Manual. If the verdict is Manual, the agent calls `StageComplete({ status: 'abort', reason: 'Manual routing verdict — story requires human-led implementation' })` and subsequent stages (e.g., `implement-task`) are skipped. If the verdict is Automated, the agent calls `StageComplete({ status: 'success' })` and the pipeline continues.

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

If the user says no: remove the skill from the pipeline and continue with the remaining skills.

## How the Prompt System Works

**`stagePrompt`** → **user prompt.** The engine appends the artifact path from the last successful prior stage as the skill's input argument. If no prior stage has artifacts, the feature description is appended instead. The skill receives its input automatically — no action needed.

**`stageSystemPrompt`** → **system prompt.** StageComplete instructions only. Never mention the skill name. Never reference artifacts — the artifact is already the skill's argument via the user prompt.

## Step 4 — Draft stageSystemPrompts

For each stage, select the matching template and fill in skill-specific details.

### GATE template
Use when: category is GATE (classifies/routes input and may conditionally abort the pipeline)

```
After completing {brief task description}, write your verdict to:
  {artifact path}

Then call the StageComplete MCP tool as the LAST action before stopping:

  If {continue condition}:
    status:  'success'

  If the pipeline should stop:
    status:  'abort'
    reason:  '{example stop reason}'

Do NOT call StageComplete before the verdict file has been written to disk.
```

Map `category: GATE` to `category: SPEC` in the generated YAML (GATE is an internal classification only — the YAML engine does not need to distinguish gate from spec stages).

### SPEC template
Use when: category is SPEC (produces a file artifact for the next stage to consume)

```
After completing {brief task description} and writing the {artifact description} to
{artifact path}, call the StageComplete MCP tool as the LAST action before stopping:

  status:    'success'
  artifacts: [{artifact path}]

Do NOT call StageComplete before the file has been written to disk.
```

### BUILD template
Use when: category is BUILD (implements code; no artifact passed to next stage)

```
When your implementation work is fully complete, you MUST call the StageComplete
MCP tool as the LAST action before stopping.
DO NOT run any verify commands — the workflow engine handles the next stage
automatically after you call StageComplete. Your only job is to call StageComplete.
```

### TEST template
Use when: category is TEST (verifies, can loop back to the preceding BUILD stage)

```
When your verification work is fully complete, you MUST do both of these in order:
  1. Write a detailed findings report to:
        .ask-jenny/features/{{featureId}}/verify-report.md
     Include every issue found, its severity, and suggested fixes.
  2. Call the StageComplete MCP tool as the LAST action before stopping:

       If no issues found:
         status:    'success'
         artifacts: [.ask-jenny/features/{{featureId}}/verify-report.md]

       If issues found:
         status:    'loop'
         artifacts: [.ask-jenny/features/{{featureId}}/verify-report.md]
```

Substitute all placeholders with skill-specific values from Step 2:
- `{brief task description}` → what the skill does (from its frontmatter description)
- `{artifact description}` → `artifactDescription` from Step 2
- `{artifact path}` → `artifactPath` from Step 2
- `{preceding BUILD stage label}` → the `label` field of the most recent BUILD stage in the pipeline

## Step 5 — User Approval Loop

Present each stageSystemPrompt to the user for review and approval, **one at a time**, using `AskUserQuestion`. Do not proceed to Step 6 until every stage has been resolved.

```
Stage {N}/{Total} — {skill-name} ({SPEC|BUILD|TEST})
────────────────────────────────────────
Skill:    {full skill name, e.g. wsbaser:interview}
Category: {SPEC | BUILD | TEST}
Produces: {artifact path, or "code changes"}
Consumes: {expects value from Step 2}

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
- `category`: the inferred category from Step 2
- `required`: `true` for all stages unless the user requested otherwise
- `retryTarget`: for TEST stages, set to the `id` of the preceding BUILD stage
- `maxRetries`: set to `2` on BUILD stages that have a TEST stage downstream

**YAML structure:**

```yaml
id: {kebab-case slug derived from the workflow purpose, e.g. "spec-build-verify"}
name: {human-readable name, e.g. "Spec → Build → Verify"}
description: {one-liner summary of the pipeline}

stages:
  - id: {stage-id}
    label: /{short-label}
    category: {SPEC|BUILD|TEST}
    position: {0-based integer}
    required: true
    description: {what this stage does}
    stagePrompt: /{full-skill-command}
    stageSystemPrompt: |
      {approved text verbatim}
```

**Validate before writing:**
- `id` and `name` are present at root
- Each stage has: `id`, `label`, `category`, `position`, `stagePrompt`, `stageSystemPrompt`
- `category` is one of: `SPEC`, `BUILD`, `TEST` (GATE stages use `SPEC` in the YAML)
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

Do not write any README or companion `.md` file — the YAML is the only artifact this skill produces.

## Step 8 — Executor Fix Notice

Check: does any SPEC or CONVERSATIONAL stage produce an artifact that a subsequent stage (other than `implement-spec`) would consume via the artifact injection mechanism?

If yes, print this block to the terminal:

```
⚠  This workflow requires the executor artifact injection fix.
   Apply: specs/workflow-executor-artifact-injection.md
   Without it, artifact paths will not be passed between stages.
```

## Final Confirmation

After the YAML is written, confirm to the user:

```
✓ Workflow written to {discovered-workflows-folder}/{workflow-id}.yaml
{executor fix notice if applicable}

To use this workflow, select "{Workflow Name}" in the Ask Jenny workflow selector
when creating or editing a feature.
```
