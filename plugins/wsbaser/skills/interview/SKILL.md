---
name: wsbaser:interview
description: Interview user to capture feature requirements, write spec to specs/. Open points are researched, decided and presented on one review page instead of asked one by one. Add --plan for phased implementation plan, --scout to run pattern-scout reuse analysis. Trigger: spec a feature, share a ticket/doc/design link, or say "plan this out".
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

## Step 3: Settle the open points

The open points are not asked one by one. `wsbaser:review` researches each point, recommends a decision, and shows all of them on one review page where the user confirms or changes each.

1. **List the open points.** From the categories selected in Step 2, list every non-obvious open point. Skip anything already clear from the conversation or easily inferred from the codebase; never list "what framework?" when it is obvious. Use these techniques to find points, not to phrase questions:
   - **Devil's Advocate**: challenge assumptions ("what if we took the opposite approach?", "why not just a simpler solution?").
   - **Scenario-Based**: explore real usage ("what happens when a user does X and then Y?", "how should an unexpected action behave?").
   - **Tradeoff Forcing**: clarify priorities ("if A and B conflict, which matters more?", "what degradation is acceptable if a constraint hits?").

   Write each point so the reader needs no other context. For a point about an internal mechanism, explore it first and say in the point what it is and why it exists. Track which categories have points or are clearly covered.

2. **Hand the points to review.** Invoke `wsbaser:review` through the `Skill` tool (`Skill({ skill: "wsbaser:review", args: "..." })`) with the feature name, the context gathered in Step 1 (conversation, sources, files with paths, the reuse map when `--scout` ran) and the list of points. Also pass `specs/{slug}/` as the folder for `review-<id>/review.json`, with `{slug}` made by the rule in Step 4, so the record outlives the session. Tell `review` that you announce the page and collect the owner's answer yourself: it returns the link and the "n of m need you" line, then takes your answer as the paste. This is review's supplied-issues intake: one point becomes one issue, in your order. Every round after the first passes the existing `review.json` and only the new points. Pass a pure preference point as it is; it appears on the page with nothing preselected. Never use the `Agent` tool for this.

3. **Announce the page.** When `review` has published, it gives you the link and the count of points that need the user. Call `AskUserQuestion` once:

   ```json
   {
     "question": "Review page is ready: <url>. <n> of <m> points need you. Go through it, click Copy decisions, then choose how to continue.",
     "header": "Decisions",
     "options": [
       {"label": "I'll paste the decisions next", "description": "I will paste the copied decisions in the terminal on my next turn"},
       {"label": "Accept all recommendations", "description": "Treat every recommended option as confirmed"},
       {"label": "Stop here", "description": "End without settling the remaining points"}
     ]
   }
   ```

   Pass the user's answer back to `review` as its paste. A decision text pasted through the free-text answer is used directly. For `I'll paste the decisions next`, wait for the next turn and pass that paste. `Accept all recommendations` goes to `review` as "Accept all recommendations". `Stop here` tells `review` to stop.

   If `review` replies that points are still undecided and waits, call `AskUserQuestion` again with the same options and the question naming those ids. After `Accept all recommendations`, preference points stay undecided; name them in the question and say a decision for them must be pasted, because choosing `Accept all recommendations` again changes nothing. If `review` reworks disputed points and republishes the page, announce it the same way.

4. **Apply the returned decisions.** `review` returns `Review settled: <n> decisions`, the decision text, and the path to `review.json`. Treat each decision as an answer from the user. A decision whose note only adds detail is detail for the spec. When a decision exposes a gap in your understanding of the code, explore it first. Turn a vague or only partly answering note into a follow-up point for the next round. If `review` returns `Review not settled`, do not act on the points it lists as undecided or disputed; tell the user which are open, list them under `open items` in the solution summary, skip `wsbaser:architecture-fit` while open items remain, and go on to the wrap-up question. If the decisions expose new open points, invoke `wsbaser:review` again for the same review with the path to `review.json` and only the new points (the next round), and announce it with the same `AskUserQuestion`.

5. **Check the architecture.** When nothing is open, use the `Skill` tool to invoke `wsbaser:architecture-fit` (`Skill({ skill: "wsbaser:architecture-fit", args: "..." })`) on the proposed approach. **Never use the `Agent` tool for this.** If the verdict is **FITS**, print the response to output and go on. If the verdict is **REFACTOR FIRST**, turn the violations into new points and run a further round with `wsbaser:review` until the approach is adjusted or the user accepts it.

6. **Show the solution summary and the wrap-up question.** Synthesize the decisions into a solution summary and display it as a **text block** (before the `AskUserQuestion` call). Use the brutalist text-block format below. Only include sections for categories actually covered.

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

- If the user wants to continue or deep-dive, list the new points and run another round from step 1 of this step; the round passes the existing `review.json` and only the new points.
- Repeat until the user confirms readiness.

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

{Any unresolved items that need external input — omit section if none. Only include questions that CANNOT be answered by the user in this interview (e.g., require stakeholder input, team decisions, external API verification). Also include every point left undecided or disputed after `Review not settled`, marked "unsettled".}

- {Question}
...
```

### 4. Confirm completion or proceed to plan

**If `GENERATE_PLAN=false`:** Spec complete: `specs/{slug}.md` ({count} requirements, {count} decisions, {count or "None"} open questions). **Next:** `/wsbaser:implement-spec specs/{slug}.md`

**If `GENERATE_PLAN=true`:** Spec complete: `specs/{slug}/spec.md` ({count} requirements, {count} decisions). Proceeding to implementation plan…

## Step 5: Generate Implementation Plan (only when `GENERATE_PLAN=true`)

This step runs only when the `--plan` flag was provided. The goal is to produce a comprehensive, self-contained implementation plan that a fresh Claude session can execute with zero additional context.

### 5a. Deep codebase exploration

Launch **up to 3 subagents** (via the `Agent` tool) in parallel to gather codebase context for the plan. Tailor exploration to the feature — common topics: design system (colors, theme maps, SCSS), component patterns (file conventions, base classes, namespaces), icon system, similar existing components, story/test patterns, build commands, API/service patterns, and routing conventions.

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
