---
description: Run dynamic code review with auto-selected agents before PR
---

# Pre-PR Code Review

You are performing a comprehensive code review before creating a pull request. Your goal is to dynamically select the most appropriate code review agents based on what changed, run them in parallel, and consolidate the results.

## Context

- **Current branch**: !`git branch --show-current`
- **Target branch**: develop (fallback to main)
- **Changed files**:
!`git diff --name-only develop...HEAD 2>/dev/null || git diff --name-only main...HEAD 2>/dev/null || echo "Could not determine changes"`
- **Diff stats**:
!`git diff --stat develop...HEAD 2>/dev/null || git diff --stat main...HEAD 2>/dev/null || echo "Could not get diff stats"`

## Instructions

### Step 1: Analyze the Changes

Examine the changed files above and categorize them:
- **File types**: .cs, .razor, .scss, .js, .ts, .json, .md, etc.
- **Domains**: Components, Services, Tests, Configuration, Styling
- **Nature**: New feature, bug fix, refactoring, documentation

### Step 2: Discover Available Code Review Agents

Check the Task tool for available agents. Look for agents whose names or descriptions match code review purposes. These typically include patterns like:
- `*:code-reviewer` - General code quality
- `*:silent-failure-hunter` - Error handling gaps
- `*:type-design-analyzer` - Type safety and design
- `*:architect-review` - Architecture patterns
- `*:security-auditor` - Security vulnerabilities
- `*:pr-test-analyzer` - Test coverage
- `*:code-simplifier` - Code complexity

> **Note**: These are patterns to search for among installed plugins. The `wsbaser:` agents (architecture-reviewer, clean-code-reviewer, code-simplifier) are always available with this plugin and serve as a baseline.

### Step 3: Select Suitable Agents (2-4 agents)

Match agents to the changes using this guide:

| Changed File Types | Recommended Agents |
|-------------------|-------------------|
| `.cs`, `.razor` (C#/Blazor) | code-reviewer, type-design-analyzer |
| Async code, error handling | silent-failure-hunter |
| New components/major changes | architect-review |
| Auth, input handling, security | security-auditor |
| Test files (`.Tests.cs`) | pr-test-analyzer |
| Large/complex changes | code-simplifier |

**Selection rules:**
- Pick 2-4 most relevant agents (not more)
- Avoid redundant agents (e.g., multiple code-reviewers from different toolkits)
- Prefer `pr-review-toolkit:*` agents when available (they're specialized for PR reviews)
- Always include at least one `wsbaser:*` agent as a baseline (architecture-reviewer, clean-code-reviewer, or code-simplifier)
- If no external agents are found, use wsbaser agents exclusively

### Step 4: Run Selected Agents in Parallel

Launch all selected agents simultaneously using the Task tool with a single message containing multiple tool calls.

For each agent, include in the prompt:
1. Branch being reviewed and target branch
2. List of changed files
3. Brief summary of what changed
4. Instruction to save report to: `.code-reviews/review-{YYYY-MM-DD}-{short-agent-name}.md`
   - Use today's date
   - Use short name like: `code-quality`, `silent-failures`, `type-design`, `architecture`, `security`, `tests`

### Step 5: Consolidate and Present Results

After all agents complete:
1. Read all generated review files from `.code-reviews/`
2. Create a consolidated summary organized by severity:
   - **Critical** (must fix before PR)
   - **High** (should fix)
   - **Medium** (consider fixing)
   - **Low** (nice to have)
3. Present the summary to the user with:
   - Total issues by severity
   - List of blocking issues (Critical)
   - Files that need attention
   - Overall recommendation (Ready / Needs Work)

## Important Notes

- Always run agents in parallel (single message with multiple Task tool calls)
- Always save review files to `.code-reviews/` directory (create if doesn't exist)
- Be specific in agent prompts - include actual file names and change summaries
- If no suitable agents are found, explain what agents would be helpful and why
