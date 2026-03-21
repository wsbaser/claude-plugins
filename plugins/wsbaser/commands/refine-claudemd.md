---
description: Audit and improve CLAUDE.md files — score quality, propose fixes, apply with approval
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
model: sonnet
---

# Improve CLAUDE.md

You are auditing and improving CLAUDE.md files for the current project. Your goal is to ensure every CLAUDE.md file is concise, actionable, and current — following best practices for Claude Code configuration.

## Phase 1: Discovery

Find all CLAUDE.md files in scope:

1. Use the `Glob` tool with pattern `**/CLAUDE.md` to find all CLAUDE.md files in the project, and `**/.claude.local.md` to find local override files
2. Check for `~/.claude/CLAUDE.md` (global user file)
3. Check for `.claude/CLAUDE.md` (personal project-specific file)

List every file found with its path and size. If no files are found, inform the user and offer to create a starter CLAUDE.md using `/init`-style analysis.

## Phase 2: Quality Assessment

Score each file against the six criteria below. Read each file fully before scoring.

### Scoring Rubric (100 points total)

| Criterion | Points | What to evaluate |
|-----------|--------|-----------------|
| **Commands & Workflows** | 25 | Are build, test, lint, typecheck, and deploy commands documented with exact, copy-pasteable syntax? Is single-test-file syntax included? |
| **Architecture Clarity** | 20 | Is the tech stack listed? Is the project structure explained? Are key architectural decisions documented (patterns, layers, data flow)? |
| **Non-obvious Patterns & Gotchas** | 20 | Are fragile areas flagged? Are negative instructions present ("do NOT edit X")? Are domain terms defined? Are deviations from defaults called out? |
| **Conciseness** | 15 | Is the file between 300-800 words? Under ~500 lines? Is every line earning its place? Is there duplicated config that Claude can read directly from source files? |
| **Currency** | 10 | Does the information match the actual codebase? Are commands still valid? Are referenced files/paths still present? Are there references to removed or renamed things? |
| **Actionability** | 10 | Are instructions specific and behavioral ("use early returns, max 50-line functions") rather than vague ("write clean code", "follow best practices")? |

### How to score

For each criterion:
- Read the file content and cross-reference against the actual project (check that commands work, paths exist, etc.)
- Assign a score from 0 to the max points for that criterion
- Write a one-line justification for the score

Sum all six scores for the total.

## Phase 3: Quality Report

Output a report for each file before proposing any changes:

```
## CLAUDE.md Quality Report

### {file_path}
**Total Score: {score}/100 — Grade: {grade}**
**Word count:** {words} | **Line count:** {lines}

| Criterion              | Score | Notes |
|------------------------|-------|-------|
| Commands & Workflows   | X/25  | ...   |
| Architecture Clarity   | X/20  | ...   |
| Non-obvious Patterns   | X/20  | ...   |
| Conciseness            | X/15  | ...   |
| Currency               | X/10  | ...   |
| Actionability          | X/10  | ...   |

**Top strengths:**
- ...

**Key gaps:**
- ...
```

### Grade Scale

| Grade | Score Range | Meaning |
|-------|------------|---------|
| A | 90-100 | Comprehensive, current, actionable |
| B | 70-89 | Good overall, minor gaps |
| C | 50-69 | Basic coverage, missing key sections |
| D | 30-49 | Sparse or outdated |
| F | 0-29 | Missing or severely inadequate |

## Phase 4: Improvement Proposals

For each file scoring below A, propose specific improvements. Structure each proposal as:

```
### Proposal {n}: {short title}
**Criterion:** {which scoring criterion this addresses}
**Impact:** +{estimated points} points
**Reasoning:** {why this change improves the file — reference best practices}

**Current:**
{existing text or "[missing]"}

**Proposed:**
{replacement text}
```

Follow these principles when writing proposals:
- **Commands are king.** Prioritize adding exact, copy-pasteable build/test/lint commands above all else. Include single-test-file syntax.
- **Brevity is a feature.** Every token in CLAUDE.md is read on every session. Remove content that duplicates what Claude can infer from config files (tsconfig.json, .eslintrc, package.json, etc.).
- **Negative instructions prevent disasters.** Add "do NOT" rules for fragile areas, auto-generated files, or common mistakes specific to this project.
- **Specific beats vague.** Replace any generic advice ("follow best practices") with concrete, behavioral instructions.
- **No secrets.** Flag and remove any API keys, passwords, or internal URLs found in CLAUDE.md files.
- **No prompt engineering.** Remove "think step by step", "be thorough", or similar prompt-engineering language that belongs in chat prompts, not in a persistent memory file.
- **No stale content.** Verify commands and paths against the actual project. Remove references to things that no longer exist.

Order proposals by estimated point impact (highest first).

## Phase 5: Apply with Approval

Present all proposals to the user and use `AskUserQuestion` to ask which ones to apply. Accept any of these response styles:
- "all" — apply everything
- Specific proposal numbers — e.g., "1, 3, 5"
- "none" — skip all changes

Only edit files the user explicitly approves. After applying changes, re-score the affected files and show the updated grades.

## Important Notes

- Never add secrets, credentials, or internal URLs to CLAUDE.md files
- When checking currency, actually verify commands exist in package.json/Makefile/etc. and paths exist on disk
- For monorepos, evaluate subdirectory CLAUDE.md files in context of the root file — they should supplement, not duplicate
- If a file is over 800 words, always include a conciseness proposal to trim it
- If commands are missing entirely, always include a commands proposal — this is the single highest-impact improvement
