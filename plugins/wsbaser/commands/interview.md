---
description: Interview me in detail about a feature requirement, then write the spec to specs/. Use --plan to also generate a detailed implementation plan.
argument-hint: "[--plan] Feature description or context"
allowed-tools: Read, Write, Glob, Grep
model: opus
---

Interview the user in depth about a feature or requirement from the current conversation, then produce a structured specification document.

## Arguments

- `--plan` (optional): After generating the spec, perform deep codebase exploration and generate a comprehensive implementation plan. When `--plan` is present, output goes to a subfolder: `specs/{slug}/spec.md` and `specs/{slug}/implementation-plan.md`. Without `--plan`, output is the flat file `specs/{slug}.md` as before.

Check if `$ARGUMENTS` contains `--plan`. If present, set `GENERATE_PLAN=true` and strip `--plan` from the arguments before processing.

## Step 1: Context Gathering

Review the conversation to identify the feature or requirement being discussed. Extract:
- **Feature name / working title**
- **Initial description** (what the user has said so far)
- **Known constraints** (technology, timeline, scope limits)
- **Ambiguities** (anything unclear or underspecified)

Then explore the codebase to understand existing patterns relevant to the feature:
- Search for related files, components, services, models
- Identify architectural conventions and patterns in use
- Find similar implementations that could inform design decisions
- Note any infrastructure that can be reused

Summarize what you found before starting the interview:

```
==============================================================
 INTERVIEW: {Feature Name}
==============================================================
 Context from conversation: {1-2 sentence summary}
 Codebase exploration: {key findings}
 Topics to explore: {list of identified ambiguities}
 Mode: {Spec only | Spec + Implementation Plan}
==============================================================
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
- **Use codebase context.** Reference actual code you found during exploration:
  - "I see `{ClassName}` uses pattern X — should we follow the same approach here?"
  - "The existing `{method}` handles this by doing Y — does that apply here too?"
- **Mid-interview exploration.** If an answer reveals a gap in your codebase understanding, pause to explore:
  - "Let me check how [related feature] is implemented..."
  - Then return with an informed follow-up question.
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

- Track question count internally.
- At approximately **10 turns**, assess coverage across selected categories.
- If coverage is near complete, offer to wrap up:

```json
{
  "question": "We've covered the major topics. How would you like to proceed?",
  "header": "Continue?",
  "options": [
    {"label": "Wrap up", "description": "Coverage is sufficient — generate the spec"},
    {"label": "Continue exploring", "description": "There are more areas I want to discuss"},
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

- If `GENERATE_PLAN=true`: Create `specs/{slug}/` directory and write the spec to `specs/{slug}/spec.md`
- Otherwise: Check if `specs/` exists (create if needed) and write to `specs/{slug}.md`

### 3. Write the spec file

Write the spec with the following structure:

```markdown
# {Feature Name}

**Date**: {YYYY-MM-DD}
**Status**: Draft

---

## Overview

{2-3 sentence summary of the feature, its purpose, and the problem it solves}

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

{Any unresolved items that need further investigation or decisions — omit section if none}

- {Question}
...
```

### 4. Confirm completion or proceed to plan

**If `GENERATE_PLAN=false`** — display completion and stop:

```
==============================================================
 SPEC COMPLETE
==============================================================
 File: specs/{slug}.md
 Requirements: {count}
 Decisions: {count}
 Open questions: {count or "None"}
==============================================================
```

**If `GENERATE_PLAN=true`** — display transition message and continue to Step 5:

```
==============================================================
 SPEC COMPLETE — Proceeding to implementation plan...
==============================================================
 File: specs/{slug}/spec.md
 Requirements: {count}
 Decisions: {count}
 Open questions: {count or "None"}
==============================================================
```

## Step 5: Generate Implementation Plan (only when `GENERATE_PLAN=true`)

This step runs only when the `--plan` flag was provided. The goal is to produce a comprehensive, self-contained implementation plan that a fresh Claude session can execute with zero additional context.

### 5a. Deep codebase exploration

Launch **up to 3 background agents** (Explore or general-purpose subagent_type) in parallel to gather all context needed for the plan. Tailor the exploration topics to the feature — common areas include:

- **Design system**: color enums, theme maps, Themeify usage, SCSS variables and mixins
- **Component patterns**: file structure conventions, base classes, code-behind patterns, namespace conventions
- **Icon system**: how Font Awesome icons are referenced, IconComponent API
- **Related components**: existing features similar to what's being built — find them and read their code as reference examples
- **Story/test patterns**: BlazingStory story format, existing story examples for similar components
- **Build & verification**: build commands, SCSS compilation, story compilation steps
- **API integration**: service patterns, HTTP client usage, endpoint conventions (if the feature involves API calls)
- **Routing & navigation**: page structure, route conventions (if the feature involves new pages)

Each agent should return **actual code snippets** from the codebase, not just descriptions. The plan must contain enough real code context that a developer with zero prior knowledge of this codebase can implement correctly.

### 5b. Write `specs/{slug}/implementation-plan.md`

Using the spec from Step 4 and the codebase context from Step 5a, write a comprehensive implementation plan.

**Required structure:**

```markdown
# {Feature Name} Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** {1 sentence — what this plan delivers}

**Architecture:** {2-3 sentences — key architectural decisions and component relationships}

**Tech Stack:** {Frameworks, libraries, and tools used}

---

## Codebase Context (READ THIS FIRST)

{This section gives a developer with ZERO context everything they need to know. Include:}

### Project Paths

| Purpose | Path |
|---------|------|
| {key location} | `{actual path}` |
...

### Build Commands

{Actual build/verify commands from the project}

### Component File Convention

{The exact file structure pattern used in this codebase, with critical rules}

### {Domain-Specific Context Sections}

{Include actual code snippets from the codebase exploration — theme maps, base classes, existing patterns, API conventions, etc. Whatever a developer needs to see to implement correctly.}

---

## Files To Create / Modify

```
{path/to/dir}/
├── FileToCreate.razor          (Create)
├── FileToCreate.razor.cs       (Create)
├── FileToCreate.razor.scss     (Create)
└── ExistingFile.razor.cs       (Modify)
```

---

## Phase 1: {Phase Name}

**Goal:** {What this phase accomplishes}

- [ ] **Task 1.1: {Task Name}** — `{path}` (Create/Modify)

  {Complete implementation code for the file — NOT placeholders, but the actual code to write}

  ```{language}
  {full file content}
  ```

  Verify: `{build/test command}` → {expected output}
  Commit: `git commit -m "{conventional commit message}"`

- [ ] **Task 1.2: {Task Name}** — `{path}` (Create/Modify)
  ...

---

## Phase 2: {Phase Name}
...

---

## Decision Reference

| Decision | Choice | Rationale |
|----------|--------|-----------|
| {from spec} | {what was decided} | {why} |
...

---

## Design Reference

{Only if the feature involves UI work — include Figma measurements, colors mapped to theme keys, typography, spacing, etc.}
```

**Plan quality requirements:**
- Every task must use **`- [ ]` checkbox format** for progress tracking across sessions
- Every task must have **exact file paths** inline with Create/Modify annotation
- Every task must include **complete code** (the actual content to write, not pseudocode or "implement X here")
- Every task must have an inline **verify step** (`Verify: \`command\` → expected`) and **commit step** (`Commit: \`git commit -m "..."\``)
- The Codebase Context section must contain **real code snippets** from exploration, not generic descriptions
- Phases should be ordered so each phase builds on the previous one
- Tasks within a phase should be ordered by dependency (independent tasks can be noted as parallelizable)

### 5c. Offer execution handoff

After writing the plan, present the user with execution options:

```
Plan complete and saved to `specs/{slug}/implementation-plan.md`. Two execution options:

1. Subagent-Driven (this session) — dispatch fresh subagent per task, review between tasks
2. Parallel Session (separate) — open new session with executing-plans skill

Which approach?
```

Use `AskUserQuestion` to let the user choose.

### 5d. Display completion summary

```
==============================================================
 SPEC + PLAN COMPLETE
==============================================================
 Spec: specs/{slug}/spec.md
 Plan: specs/{slug}/implementation-plan.md
 Requirements: {count}
 Decisions: {count}
 Plan phases: {count}
 Plan tasks: {count}
 Open questions: {count or "None"}
==============================================================
```
