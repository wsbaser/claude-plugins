---
name: wsbaser:interview
description: Interview user to capture feature requirements, write spec to specs/. Add --plan for phased implementation plan, --scout to run pattern-scout reuse analysis. Trigger: spec a feature, share a ticket/doc/design link, or say "plan this out".
---

Interview the user in depth about a feature or requirement from the current conversation, then produce a structured specification document.

## Arguments

- `--plan` (optional): After generating the spec, perform deep codebase exploration and generate a phased implementation plan. Output goes to `specs/{slug}/`: `spec.md` + per-phase files (`phase-1-{name}.md`, `phase-2-{name}.md`, …). Without `--plan`, output is `specs/{slug}.md`.
- `--scout` (optional): After codebase exploration, invoke `wsbaser:pattern-scout` to build a reuse map and surface existing primitives before the interview begins.

Strip `--plan` and `--scout` from arguments before processing. Set `GENERATE_PLAN=true` if `--plan` is present. Set `RUN_SCOUT=true` if `--scout` is present.

## Step 1: Context Gathering

Review the conversation to identify the feature or requirement being discussed. If the arguments or conversation contain any URLs or external references (tickets, docs, designs, etc.), fetch and read those sources in full before proceeding. Extract:
- **Feature name / working title**
- **Initial description** (what the user has said so far)
- **Known constraints** (technology, timeline, scope limits)
- **Ambiguities** (anything unclear or underspecified)

Then explore the codebase to understand existing patterns relevant to the feature:
- Search for related files, components, services, models
- Identify architectural conventions and patterns in use
- Find similar implementations that could inform design decisions
- Note any infrastructure that can be reused

If `RUN_SCOUT=true`, invoke the `wsbaser:pattern-scout` skill, passing:
- The feature name and description
- Any files or areas identified so far
- The operations the feature needs to perform

Wait for the reuse map before continuing. The scout's verdict informs the entire interview — prefer solutions that reuse existing primitives. If a new abstraction is proposed during the interview or spec writing, explain why the scout's findings don't cover it.

Summarize what you found before starting the interview. Use the brutalist text-block format below — lowercase throughout, `▸` as the *label → content* pointer, `·` as the list separator, and Unicode box-drawing for the frame. Pad labels to a consistent column width (here, 8 chars).

```
╔══════════════════════════════════════════════════════════════╗
║  INTERVIEW · {feature name}                                  ║
╚══════════════════════════════════════════════════════════════╝

  context  ▸ {1-2 sentence summary}
  sources  ▸ {urls read, or "none"}
  extract  ▸ {e.g., "30-value enum with integer assignments" or "none"}
  codebase ▸ {key findings}
  reuse    ▸ {pattern-scout verdict — what exists and can be reused; or "skipped (--scout not set)"}
  topics   ▸ {list of identified ambiguities}
  mode     ▸ {spec only | spec + implementation plan}
```

## Step 2: Determine Interview Categories

Analyze the feature to select which topic categories are relevant. Only interview on categories that apply.

**Possible Categories:**

| Category | When Relevant |
|----------|---------------|
| Technical approach & architecture | Always |
| UI/UX design & interactions | Frontend or user-facing features |
| Data model & persistence | Features involving data storage or schemas |
| Edge cases & error handling | Any feature with user input or external dependencies |
| Performance & scalability | Data-heavy features, lists, search, real-time |
| Security & access control | Auth, data handling, APIs, sensitive data |
| Testing strategy | Complex logic, integrations, critical paths |
| Integration & dependencies | API changes, external systems, third-party libs |
| Maintenance & extensibility | New patterns, shared components, public APIs |

Display the selected categories before starting:

```
Interview will cover: {Category1}, {Category2}, {Category3}
(Based on feature type: {classification})
```

## Step 3: Conduct the Interview

Use `AskUserQuestion` for each question. Provide **3 options** per question (the tool automatically adds an "Other" option for custom input).

### Questioning Techniques (rotate between these)

1. **Devil's Advocate** — Challenge assumptions:
   - "What if we took the opposite approach — [alternative]?"
   - "What would break if we did X instead of Y?"
   - "Why not just [simpler solution]?"

2. **Scenario-Based** — Explore real usage:
   - "Imagine a user doing X, what happens when Y?"
   - "Walk me through what happens when [edge case]?"
   - "If someone [unexpected action], how should it behave?"

3. **Tradeoff Forcing** — Clarify priorities:
   - "If you had to choose between A and B, which matters more?"
   - "Would you sacrifice X for better Y?"
   - "What's the acceptable degradation if [constraint]?"

### Interview Rules

- **Non-obvious questions only.** Do not ask about things already clear from the conversation or easily inferred from the codebase. Never ask "what framework?" when it's already obvious.
- **Push until clear.** If an answer is vague, follow up:
  - "Can you be more specific about [aspect]?"
  - "Give me a concrete example of that scenario."
  - "What exactly do you mean by [term]?"
- **Embed codebase context in questions.** For any question referencing an internal mechanism, explore it first if needed, then explain what it is and why it exists in the question text. Do not assume the user knows the internals.

  Bad: "Should the unified dialog always run `migrateModelId()` on the initial model?"
  Good: "The codebase has a `migrateModelId()` function that converts old short model names
  ('opus') to canonical prefixed names ('claude-opus') — this exists because older feature.json files may still contain the short format. In create mode the store default is already migrated, but in edit mode the value comes from disk. Should the dialog always run migration defensively, or only in edit mode?"
- **Mid-interview exploration.** If an answer reveals a gap in your codebase understanding, pause to explore:
  - "Let me check how [related feature] is implemented..."
  - Then return with an informed follow-up question.
- **Architecture fit.** Use `wsbaser:architecture-fit` when needed to evaluate whether a proposed approach fits the current architecture before committing to it.
- **Visual aids for UI/UX.** Use ASCII diagrams when clarifying layouts or interactions:
  ```
  Current:              Proposed:
  +--------+            +--------+
  | Item A |            | Item A |
  | Item B |            | Item B |
  +--------+            | Item C |
                        +--------+
  ```
- **Track coverage.** Mentally track which categories have been adequately covered.

### Question Format Example

```json
{
  "question": "For the notification feature, how should it handle the case where a user has notifications disabled at the OS level?",
  "header": "OS disabled",
  "options": [
    {"label": "Silent fallback", "description": "Fall back to in-app notifications without alerting the user"},
    {"label": "Prompt to enable", "description": "Show a one-time prompt explaining they're missing notifications"},
    {"label": "Badge only", "description": "Only update the badge count, no toasts or banners"}
  ]
}
```

### Turn Management

- Continue the interview until all categories are covered AND all clarifying questions are resolved.
- Do NOT offer to wrap up if there are unanswered questions that could be resolved by asking the user.
- If a question arises that you need answered, ask it rather than deferring to the spec.
- When coverage is complete and no questions remain, synthesize the interview into a solution summary and display it as a **text block** (before the `AskUserQuestion` call). Use the brutalist text-block format below. Only include sections for categories actually covered.

```
╔══════════════════════════════════════════════════════════════╗
║  SOLUTION SUMMARY · {feature name}                           ║
╚══════════════════════════════════════════════════════════════╝

  approach ▸ {1-2 sentence description of the chosen technical approach}

  ─── scope ────────────────────────────────────────────────────

   in  ▸ {what will be built, items joined by · separators;
          wrap onto continuation lines aligned under the first item}
   out ▸ {explicit exclusions if discussed; omit this row otherwise}

  ─── decisions ────────────────────────────────────────────────

   {group}    ▸ {related decisions joined by · separators}
   {group}    ▸ {related decisions joined by · separators}
   ...

  open items ▸ {unresolved items, or "none"}
```

**Format rules:**
- Lowercase throughout the block (preserve casing only inside backticked code identifiers when needed).
- `▸` is the *label → content* pointer. `·` is the list separator. Don't mix in other glyphs.
- Frame uses Unicode box-drawing (`╔ ═ ╗ ║ ╚ ╝`); section dividers use `─── label ───`.
- **Group decisions thematically** (e.g., `state`, `fsm`, `routing`, `rendering`, `persistence`, `ui`). Aim for 3–6 groups regardless of total decision count — collapse related decisions onto one line. Padding each group label to a consistent width within the block.
- The `out` row is optional — omit when nothing was explicitly excluded.

This bookends the interview with a concrete picture of what was agreed. The user can spot-check before committing to the spec.

Then offer to wrap up, referencing the summary:

```json
{
  "question": "The solution summary above reflects what we've discussed. Does it look right?",
  "header": "Wrap up?",
  "options": [
    {"label": "Looks good — wrap up", "description": "Summary is accurate — generate the spec"},
    {"label": "Continue exploring", "description": "I want to revisit or discuss more before wrapping up"},
    {"label": "Deep-dive on a topic", "description": "I want to go deeper on a specific area"}
  ]
}
```

- If user wants to continue or deep-dive, resume the interview.
- Continue checking periodically until the user confirms readiness.

## Step 4: Generate the Spec

After the interview is complete:

### 1. Generate a slug from the feature name

Convert the feature name to a filename-safe slug:
- Lowercase
- Replace spaces with hyphens
- Remove special characters
- Maximum 6 content words (skip stopwords like the, a, an, to, for, of, in, on, at, by, with)

Example: "User notification preferences panel" -> `user-notification-preferences-panel`

### 2. Create the output directory

- If `GENERATE_PLAN=true`: Create `specs/{slug}/` and write to `specs/{slug}/spec.md`
- Otherwise: Write to `specs/{slug}.md` (create `specs/` if needed)

### 3. Write the spec file

**Self-containment rule:** The spec must be fully self-contained. Every implementation-critical constant gathered during context gathering — exact enum values with integer assignments, type names, service identifiers, constraints — must be embedded inline in the spec. A developer must be able to implement entirely from the spec without consulting any external source.

Write the spec with the following structure:

```markdown
# {Feature Name}

**Date**: {YYYY-MM-DD}
**Status**: Draft
**Sources**: {list every URL provided by the user, or "N/A"}

---

## Overview

{2-3 sentence summary of the feature, its purpose, and the problem it solves}

---

## Technical Specifications

> Source data extracted from external documents. Implementors must use these exact values.

### {Domain} — {e.g., Enum Values}

| Name | Value | Notes |
|------|-------|-------|
| {EnumMember} | {integer} | {e.g., priority / non-priority} |

### {Other technical tables as needed}

{e.g., Type Mappings, Service Dependencies, etc.}

> **Note:** Include this section only when implementation-critical constants were extracted from external sources. Omit entirely if the feature has no external spec data.

---

## Requirements

### Functional Requirements

{Numbered list of concrete, testable requirements derived from the interview}

1. {Requirement}
2. {Requirement}
...

### Non-Functional Requirements

{Performance, security, accessibility, or other quality requirements — only if discussed}

1. {Requirement}
...

---

## Design Decisions

{Key decisions made during the interview, with rationale}

### {Decision Title}

**Decision:** {What was decided}

**Rationale:** {Why — include the tradeoffs considered}

**Alternatives rejected:**
- {Alternative} — {Why rejected}

---

## Acceptance Criteria

{Clear, testable criteria that define "done"}

- [ ] {Criterion}
- [ ] {Criterion}
...

---

## Open Questions

{Any unresolved items that need external input — omit section if none. Only include questions that CANNOT be answered by the user in this interview (e.g., require stakeholder input, team decisions, external API verification).}

- {Question}
...
```

### 4. Confirm completion or proceed to plan

**If `GENERATE_PLAN=false`:** Spec complete: `specs/{slug}.md` ({count} requirements, {count} decisions, {count or "None"} open questions). **Next:** `/wsbaser:implement-spec specs/{slug}.md`

**If `GENERATE_PLAN=true`:** Spec complete: `specs/{slug}/spec.md` ({count} requirements, {count} decisions). Proceeding to implementation plan…

## Step 5: Generate Implementation Plan (only when `GENERATE_PLAN=true`)

This step runs only when the `--plan` flag was provided. The goal is to produce a comprehensive, self-contained implementation plan that a fresh Claude session can execute with zero additional context.

### 5a. Deep codebase exploration

Launch **up to 3 Task-tool subagents** in parallel to gather codebase context for the plan. Tailor exploration to the feature — common topics: design system (colors, theme maps, SCSS), component patterns (file conventions, base classes, namespaces), icon system, similar existing components, story/test patterns, build commands, API/service patterns, and routing conventions.

Each agent should return **actual code snippets** from the codebase, not just descriptions. The plan must contain enough real code context that a developer with zero prior knowledge of this codebase can implement correctly.

### 5b. Write phase files

For each logical phase, generate a slug (lowercase, hyphens, 2-4 words) and write `specs/{slug}/phase-N-{phase-slug}.md`. Each file must include:
- **Goal** — 1-2 sentences on what this phase accomplishes
- **Files** — list of paths to create/modify (annotated Create/Modify)
- **Codebase Context** *(optional)* — include only when non-obvious patterns, conventions, or code snippets are needed; omit when steps are self-evident
- **Steps** — numbered steps with exact code changes (before/after or full content)
- **Verify** — commands and expected output
- **Design Reference** *(optional, UI phases only)* — Figma measurements mapped to theme keys, color values, icon names

**Rules:** Each phase must be self-contained (a fresh `/wsbaser:implement-spec` session must implement it without reading other phases). Include enough prior-phase context for the implementor to proceed confidently. Order phases by dependency; aim for 2-6 phases.

### 5c. Display completion summary

Spec + phased plan complete. Spec: `specs/{slug}/spec.md` ({count} phases, {count} requirements, {count or "None"} open questions).

Run phases sequentially:
```
/wsbaser:implement-spec specs/{slug}/phase-1-{name}.md
/wsbaser:implement-spec specs/{slug}/phase-2-{name}.md
...
```
