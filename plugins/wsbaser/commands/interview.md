---
description: Interview me in detail about a feature requirement, then write the spec to specs/
allowed-tools: Read, Write, Glob, Grep
model: opus
---

Interview the user in depth about a feature or requirement from the current conversation, then produce a structured specification document.

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

### 2. Create the specs directory if needed

Check if `specs/` exists in the current working directory. Create it if it doesn't.

### 3. Write the spec file

Write `specs/{slug}.md` with the following structure:

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

### 4. Confirm completion

Display:

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
