---
description: Review changed files for Clean Architecture, SOLID, and DRY violations using two parallel agents
---

# Architecture & Clean Code Review

You are orchestrating a comprehensive architecture and clean code review of the current branch's changes. You use two specialized agents running in parallel, then consolidate their findings into a single deduplicated report.

## Step 1: Gather Context

Determine the changed files and branch context:

1. Get the current branch name: `!git rev-parse --abbrev-ref HEAD`
2. Get the target branch (default: `develop`)
3. Get the list of changed files: `!git diff --name-only develop...HEAD`
4. Get diff stats: `!git diff --stat develop...HEAD`
5. Get the full diff for context: `!git diff develop...HEAD`

If there are no changed files, inform the user and stop.

Store the changed files list and diff content for the agent prompts.

## Step 2: Launch Two Agents in Parallel

Launch BOTH agents in a **single message** using the Task tool so they run concurrently.

### Agent 1: Architecture Reviewer

```
Task(subagent_type="wsbaser:architecture-reviewer")
```

Prompt must include:
- The list of changed files
- Instruction to read each changed file AND its surrounding context (imports, related files)
- Instruction to check for: Clean Architecture layer violations, SOLID at module/service level, DDD boundary violations, dependency direction issues, separation of concerns violations
- The diff content so the agent knows what changed
- Instruction to save findings to `.code-reviews/architecture-review-{YYYY-MM-DD}-arch.md`

### Agent 2: Clean Code Reviewer

```
Task(subagent_type="wsbaser:clean-code-reviewer")
```

Prompt must include:
- The list of changed files
- Instruction to read each changed file
- Instruction to check for: DRY violations, code duplication, SOLID at method/class level, code smells (Feature Envy, Inappropriate Intimacy, Long Parameter Lists, Primitive Obsession, Data Clumps), clean code practices (naming, complexity, method length)
- The diff content so the agent knows what changed
- Instruction to save findings to `.code-reviews/architecture-review-{YYYY-MM-DD}-code.md`

## Step 3: Consolidate & Deduplicate

After both agents complete:

1. Read both report files
2. Parse all issues from both reports
3. **Deduplicate**: Two issues are duplicates if they refer to the **same file** AND the **same fundamental problem** (even if described differently). For duplicates:
   - Keep the higher severity rating
   - Merge descriptions from both perspectives
   - Mark as "Identified by: Architecture Reviewer, Clean Code Reviewer"
4. For non-duplicate issues, mark which agent identified them
5. Group all issues by severity: Critical > High > Medium > Low

## Step 4: Write Final Report

Create the `.code-reviews/` directory if it doesn't exist, then save the consolidated report to `.code-reviews/architecture-review-{YYYY-MM-DD}.md`:

```markdown
# Architecture & Clean Code Review

**Branch:** {branch} -> develop
**Date:** {YYYY-MM-DD}
**Files Reviewed:** {count}

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | ...   |
| High     | ...   |
| Medium   | ...   |
| Low      | ...   |

**Verdict:** {one of: "Ready for PR" (no Critical/High) | "Needs Attention" (High issues but no Critical) | "Significant Issues" (Critical issues found)}

---

## Issues

### 1. {Title}
**Severity:** {level} | **Category:** {principle} | **Identified by:** {agent(s)}
**File:** {path}#L{start}-L{end}

{Description — merge both system-level and code-level insights if from both agents}

**Recommendation:** {fix suggestion}

---
{repeat for each issue}

## Principles Summary

| Principle | Violations | Most Affected Files |
|-----------|-----------|---------------------|
| ...       | ...       | ...                 |
```

## Step 5: Present Results

After writing the report:
1. Display the Summary table and Verdict to the user
2. List Critical and High issues inline with brief descriptions
3. Note how many Medium/Low issues are in the full report
4. Provide the path to the full report file

## Important Notes

- Always use today's date in YYYY-MM-DD format for file names
- If the `.code-reviews/` directory doesn't exist, create it
- Both agents must run in the SAME message (parallel, not sequential)
- The model for each agent is defined in their agent definitions (opus) — do NOT override it
- When deduplicating, use semantic understanding — the same issue may be described differently by each agent
