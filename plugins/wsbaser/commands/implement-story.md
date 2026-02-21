---
description: Full development workflow from Jira story to implementation with multi-agent review
---

# /wsbaser:implement-story

Automates the full development workflow from Jira story to implementation.

## Usage

```
/wsbaser:implement-story <jira-url> [--interactive] [--pause=critical] [--continue]
```

## Arguments

- `jira-url` (required): Full Jira story URL (e.g., `https://7c-is.atlassian.net/browse/S7C1-1937`)
- `--interactive`: Enable deep requirements interview before planning (recommended for complex stories)
- `--pause=critical`: Pause before coding phase to review implementation plan
- `--continue`: Resume from existing spec folder if detected

## What This Command Does

This command executes a complete development workflow:

1. **Story Analysis** - Fetch and analyze the Jira story
2. **Interactive Interview** *(if `--interactive`)* - Deep requirements clarification
3. **Branch Creation** - Create appropriate git branch
4. **Implementation Planning** - Deep exploration and create IMPLEMENTATION-PLAN.md
5. **Implementation** - Code the solution using /wsbaser:implement-spec
6. **Reviews** - Run architect, security, and code quality reviews
7. **Test Plan** - Generate TEST-PLAN.md with Gherkin scenarios
8. **Summary** - Create IMPLEMENTATION-NOTES.md and display summary

## Interactive Mode

When `--interactive` flag is used:
- Performs deep codebase exploration before asking questions
- Conducts Socratic interview to clarify technical approach, UI/UX, edge cases
- Uses AskUserQuestion tool with 3 options per question
- Tracks coverage across relevant topic categories
- Validates and refines acceptance criteria
- Saves decisions to INTERVIEW-NOTES.md
- Integrates decisions directly into IMPLEMENTATION-PLAN.md

The interview continues until coverage is complete and you confirm readiness to proceed.

## Output

All documentation is saved to: `Spec/{JIRA-KEY}-{slug}/`

- `IMPLEMENTATION-PLAN.md` - Detailed implementation specification
- `TEST-PLAN.md` - Test scenarios in Gherkin format
- `IMPLEMENTATION-NOTES.md` - Summary with motivation and decisions
- `INTERVIEW-NOTES.md` *(if `--interactive`)* - Interview transcript and decisions

Code changes remain **uncommitted** for your review.

---

## Critical Rules

1. **JIRA IS READ-ONLY** - Never modify Jira (no status changes, no comments, no updates)
2. **DO NOT COMMIT** - Leave all changes uncommitted
3. **DO NOT CREATE PR** - User will do this manually
4. **Full workflow always** - No fast-tracking, even for trivial changes

---

## Workflow Instructions

Execute the following phases in order. Print phase headers as you progress.

---

# PHASE 1: Story Analysis

## Objective

Fetch and analyze the Jira story to extract all relevant information for implementation.

## Prerequisites Check

Before proceeding, verify:
1. Current directory is a git repository
2. Jira URL is accessible (use Atlassian MCP tools)

If either check fails, stop and report the error.

## Steps

### 1. Fetch Jira Story

Use the Atlassian MCP tools to fetch the story. Extract the Jira key from the URL.

**CRITICAL: READ ONLY ACCESS** - Never modify Jira in any way.

Extract the following fields:
- **Key** (e.g., S7C1-1937)
- **Title/Summary**
- **Description**
- **Issue Type** (Bug, Story, Task, Sub-task, etc.)
- **Acceptance Criteria** (from description or dedicated field)
- **Priority**
- **Sprint** (if assigned)
- **Labels**

### 2. Check for Sub-tasks

If the story has sub-tasks, ask the user:

```
This story has {N} sub-tasks. How would you like to proceed?

1. Process parent story only (ignore sub-tasks)
2. Process each sub-task individually (separate branches/plans)
3. Aggregate all sub-tasks into one comprehensive plan
```

Wait for user response before continuing.

### 3. Extract or Generate Acceptance Criteria

**If AC exists in Jira:** Extract and use directly.

**If NO AC exists:** Generate acceptance criteria from the description:
- Analyze the description to understand what the feature/fix should accomplish
- Create clear, testable acceptance criteria
- Use these directly without asking for confirmation
- Mark them as "AI-Generated" in the implementation plan

### 4. Determine Branch Type

Map Jira issue type to branch prefix:

| Issue Type | Branch Prefix |
|------------|---------------|
| Bug | `bug/` |
| Story | `feature/` |
| Task | `feature/` |
| Sub-task | `feature/` |
| Epic | `feature/` |
| Any other | `feature/` |

### 5. Generate Branch Name

Create a branch name following these rules:

1. Start with the prefix from step 4
2. Add a slug derived from the story title
3. **Maximum 6 content words** (nouns, verbs, adjectives)
4. **Skip stopwords:** the, a, an, to, for, of, in, on, at, by, with, from, as, is, are, was, were, be, been, being, have, has, had, do, does, did, will, would, could, should, may, might, must, shall, can, need, etc.
5. Use lowercase with hyphens

**Examples:**
- "Add alignment feature to spreadsheet column" -> `feature/add-alignment-spreadsheet-column`
- "Fix bug in user authentication flow" -> `bug/fix-user-authentication-flow`
- "Update the styling for the login page buttons" -> `feature/update-styling-login-page-buttons`

### 6. Print Phase Summary

Display:

```
==============================================================
 PHASE 1: Story Analysis Complete
==============================================================
 Jira Key:     {JIRA-KEY}
 Title:        {Title}
 Type:         {Issue Type}
 Branch Type:  {bug/feature}
 Branch Name:  {type}/{slug}
 Has AC:       {Yes/No (AI-Generated)}
==============================================================
```

## Output Variables

Store these for subsequent phases:
- `JIRA_KEY`: The Jira issue key
- `JIRA_TITLE`: The story title
- `JIRA_TYPE`: The issue type
- `JIRA_DESCRIPTION`: Full description
- `ACCEPTANCE_CRITERIA`: List of AC (original or generated)
- `BRANCH_TYPE`: bug or feature
- `BRANCH_SLUG`: The slug portion of the branch name
- `BRANCH_NAME`: Full branch name (type/slug)
- `SPEC_FOLDER`: `Spec/{JIRA_KEY}-{BRANCH_SLUG}`

---

# PHASE 2: Interactive Interview (Conditional)

**Only if `--interactive` flag is present.** Skip this entire phase if `--interactive` flag is NOT set.

## Objective

Deep Socratic interview to clarify implementation details, UI/UX decisions, concerns, tradeoffs, and validate acceptance criteria before planning.

## Skip Conditions

**If `--interactive` flag is NOT present:** Skip this entire phase and proceed to Phase 3.

**If `{SPEC_FOLDER}/INTERVIEW-NOTES.md` exists** (from `--continue`):
- Display: "Found existing interview notes. Using previous decisions."
- Set `INTERVIEW_COMPLETE=true` and `EXPLORATION_COMPLETE=true`
- Skip to Phase 3

## Steps

### 1. Print Phase Header

```
==============================================================
 PHASE 2: Interactive Interview
==============================================================
 Conducting deep requirements interview before planning...
==============================================================
```

### 2. Deep Codebase Exploration

**CRITICAL: Always perform this exploration before starting the interview.**

Launch Explore agents (up to 3 in parallel) to:
1. Find existing patterns and infrastructure related to the feature
2. Identify files that will likely need modification
3. Understand architectural constraints and conventions
4. Find similar implementations to reference

Focus areas based on story content:
- Search for keywords from the story title and description
- Find related components, services, models
- Look for existing enum values, CSS classes, utilities that can be reused
- Identify the architectural layer (UI, service, data access)

Store exploration results for interview context. Set `EXPLORATION_COMPLETE=true`.

### 3. Fetch Linked Documentation

Check if Jira story contains Confluence links or remote issue links:
- Use `getJiraIssueRemoteIssueLinks` to find linked Confluence pages
- If found, fetch linked Confluence pages using `getConfluencePage`
- Extract relevant content for interview context
- Note any design documents, specifications, or related requirements

### 4. Determine Interview Categories

Analyze the story to determine which topic categories are relevant.

**Possible Categories:**

| Category | When Relevant | Example Questions |
|----------|---------------|-------------------|
| Technical Approach | Always | Architecture, patterns, data flow |
| UI/UX | Frontend changes, user-facing features | Layout, interactions, accessibility |
| Performance | Data-heavy features, lists, search | Load times, pagination, caching |
| Security | Auth, data handling, APIs | Access control, validation, encryption |
| Testing Strategy | Complex logic, integrations | Test types, coverage, mocking |
| Edge Cases | Any feature | Error states, empty states, boundaries |
| Integration | API changes, external systems | Contracts, dependencies, versioning |
| Maintenance | New patterns, technical debt | Extensibility, documentation |

**Category Selection Logic:**

Based on story analysis, select relevant categories:

1. **Bug stories**: Technical Approach, Edge Cases, Testing Strategy
2. **UI Feature stories**: Technical Approach, UI/UX, Edge Cases, Performance (if lists/data)
3. **Backend Feature stories**: Technical Approach, Security, Integration, Testing Strategy
4. **Full-stack stories**: All applicable categories combined

Display selected categories:
```
Interview will cover: Technical Approach, UI/UX, Edge Cases
(Based on story type: Frontend Feature)
```

### 5. Conduct Interview

**Style:** Probing/Socratic - challenge assumptions, dig deeper

**Questioning Techniques (MUST use):**

1. **Devil's Advocate**: Challenge assumptions
   - "What if we took the opposite approach - [alternative]?"
   - "What would break if we did X instead of Y?"
   - "Why not just [simpler solution]?"

2. **Scenario-Based**: Explore real usage
   - "Imagine a user doing X, what happens when Y?"
   - "Walk me through what happens when [edge case]?"
   - "If someone [unexpected action], how should it behave?"

3. **Tradeoff Forcing**: Clarify priorities
   - "If you had to choose between A and B, which matters more?"
   - "Would you sacrifice X for better Y?"
   - "What's the acceptable degradation if [constraint]?"

**Question Format:**

Use the `AskUserQuestion` tool with:
- 3 options per question (+ implicit 'Other' for custom input)
- Questions strongly connected to previous answers
- ASCII/text diagrams when clarifying UI/UX concepts

Example question structure:
```
{
  "question": "For the alignment feature, how should it handle existing columns that already have custom alignment set?",
  "header": "Override",
  "options": [
    {"label": "Preserve existing", "description": "Keep any manually set alignments, only auto-align unset columns"},
    {"label": "Override all", "description": "New alignment setting always takes precedence"},
    {"label": "Prompt user", "description": "Show confirmation before overriding existing alignments"}
  ]
}
```

**Interview Behavior:**

1. **Push Until Clear**: If answer is vague, keep probing:
   - "Can you be more specific about [aspect]?"
   - "What exactly do you mean by [term]?"
   - "Give me a concrete example of that scenario"

2. **Track Coverage**: Mentally track which categories have been adequately covered

3. **Mid-Interview Exploration**: If interview reveals gaps:
   - "Let me check how [related feature] is implemented..."
   - Launch targeted exploration for specific questions
   - Return with informed follow-up questions

4. **Visual Aids for UI/UX**: Use ASCII diagrams:
   ```
   Current layout:
   +------------------+
   | Column Header    |
   | [left-aligned]   |
   +------------------+

   Proposed change:
   +------------------+
   |    Column Header |
   |    [right-aligned]|
   +------------------+

   Is this the expected behavior?
   ```

**Turn Management:**

- Track question count internally
- At approximately 10 turns, assess coverage
- If coverage is near complete, gently suggest:
  ```
  We've covered the major technical aspects. Want to:
  1. Continue exploring other areas
  2. Wrap up and proceed to planning
  3. Deep-dive on a specific topic
  ```
- Continue if user wants to discuss more

### 6. Validate Acceptance Criteria

Near the end of the interview, transition to AC validation:

```
Before we wrap up, let's validate the acceptance criteria:
```

For each acceptance criterion (original or AI-generated):
- Present the criterion
- Ask user to confirm, modify, or reject
- For AI-generated AC, explicitly note: "This was AI-generated based on the story description"

Use AskUserQuestion:
```
{
  "question": "AC: 'Column headers should align with cell content based on data type'. Is this accurate?",
  "header": "Validate AC",
  "options": [
    {"label": "Confirm as-is", "description": "This criterion is correct and complete"},
    {"label": "Needs refinement", "description": "The general idea is right but wording needs adjustment"},
    {"label": "Remove/Replace", "description": "This criterion is wrong or unnecessary"}
  ]
}
```

Update `ACCEPTANCE_CRITERIA` with validated/refined criteria.

### 7. Generate Decision Matrix

After interview completion, compile all decisions into a matrix:

```
==============================================================
 INTERVIEW COMPLETE - Coverage Summary
==============================================================

| Category           | Status   | Key Decision                    | Confidence |
|--------------------|----------|---------------------------------|------------|
| Technical Approach | Covered  | Use existing enum pattern       | High       |
| UI/UX              | Covered  | Right-align numbers, left text  | High       |
| Edge Cases         | Covered  | Fallback to left for mixed      | Medium     |
| Performance        | N/A      | Not applicable to this story    | -          |

All relevant topics have been covered.
==============================================================
```

### 8. Completion Confirmation

Use AskUserQuestion for explicit confirmation:

```
{
  "question": "Ready to proceed to branch creation and implementation planning?",
  "header": "Proceed",
  "options": [
    {"label": "Proceed to planning", "description": "Interview complete, start branch creation and planning phase"},
    {"label": "Continue interview", "description": "There are more topics I want to discuss"},
    {"label": "Revisit specific topic", "description": "I want to reconsider a decision we made"}
  ]
}
```

If user selects "Continue interview" or "Revisit", resume the interview.

### 9. Save Interview Notes

Create the spec folder if it doesn't exist:
```bash
mkdir -p {SPEC_FOLDER}
```

Write `{SPEC_FOLDER}/INTERVIEW-NOTES.md` using the Interview Notes Template (see Templates section at end of document).

**Document Structure:**

1. **Decision Summary** (top) - Quick reference table of all key decisions
2. **Validated Acceptance Criteria** - Final confirmed AC list
3. **Interview Statistics** - Categories covered, questions asked, turns
4. **Full Transcript** - Complete Q&A in chronological order

Format transcript entries as:
```markdown
### Q1: [Question text]
**Answer**: [Selected option or custom response]
**Rationale**: [Any additional context provided]

---
```

### 10. Print Phase Summary

```
==============================================================
 PHASE 2: Interactive Interview Complete
==============================================================
 Categories covered: {count}
 Questions asked:    {count}
 Decisions made:     {count}
 Notes saved to:     {SPEC_FOLDER}/INTERVIEW-NOTES.md
==============================================================
```

## Output Variables

Update/add for subsequent phases:

- `INTERVIEW_COMPLETE`: true
- `EXPLORATION_COMPLETE`: true (signals Phase 4 to skip re-exploration)
- `ACCEPTANCE_CRITERIA`: Updated with validated/refined criteria
- `INTERVIEW_DECISIONS`: Key decisions map for plan integration

## Integration with Later Phases

The interview results will be used in Phase 4 (Implementation Planning):

1. **Skip exploration** if `EXPLORATION_COMPLETE=true`
2. **Merge interview decisions** into relevant sections of IMPLEMENTATION-PLAN.md
3. **Add callouts** for interview-driven decisions:
   ```markdown
   **Interview Decision:** Use right-alignment for numeric columns based on user preference for consistency with Excel behavior.
   ```

---

# PHASE 3: Branch Creation

## Objective

Create the git branch and spec folder for the implementation.

## Steps

### 1. Check if Branch Exists

Check if a branch with the name `{BRANCH_NAME}` already exists:

```bash
git branch --list {BRANCH_NAME}
git branch -r --list origin/{BRANCH_NAME}
```

### 2. Handle Existing Branch

**If branch exists**, ask the user:

```
Branch '{BRANCH_NAME}' already exists. How would you like to proceed?

1. Switch to existing branch (checkout)
2. Create new branch with suffix (e.g., {BRANCH_NAME}-v2)
```

Wait for user response:
- If option 1: `git checkout {BRANCH_NAME}`
- If option 2: Append `-v2` (or `-v3`, etc.) and create new branch

### 3. Create New Branch

If branch doesn't exist (or user chose to create new):

```bash
git checkout -b {BRANCH_NAME}
```

### 4. Check for Existing Spec Folder

Check if `Spec/{JIRA_KEY}-{BRANCH_SLUG}/` or similar already exists:

```bash
ls -d Spec/{JIRA_KEY}-*/ 2>/dev/null
```

**If `--continue` flag was passed or spec folder exists:**
- Inform user that existing spec folder was found
- Offer to continue from where left off
- Skip phases that have completed documents

### 5. Create Spec Folder

```bash
mkdir -p Spec/{JIRA_KEY}-{BRANCH_SLUG}
```

### 6. Print Phase Summary

```
==============================================================
 PHASE 3: Branch Creation Complete
==============================================================
 Branch:       {BRANCH_NAME}
 Spec Folder:  Spec/{JIRA_KEY}-{BRANCH_SLUG}/
 Status:       {Created new / Switched to existing}
==============================================================
```

## Output Variables

Update/confirm:
- `SPEC_FOLDER`: Full path to spec folder
- `BRANCH_NAME`: Actual branch name used (may have suffix)

---

# PHASE 4: Implementation Planning

## Objective

Deep exploration of the codebase and creation of a comprehensive IMPLEMENTATION-PLAN.md.

## Steps

### 1. Deep Codebase Exploration

**Skip if `EXPLORATION_COMPLETE=true`** (already done in Phase 2 Interactive Interview)

If exploration was already done in Phase 2:
- Display: "Using exploration results from interactive interview phase"
- Skip directly to step 2 (Identify Affected Files)

**Otherwise, perform deep exploration:**

Launch Explore agents (up to 3 in parallel) to:
1. Find existing patterns and infrastructure related to the feature
2. Identify all files that will need modification
3. Understand how similar features were implemented

Focus areas:
- Search for keywords from the story title and description
- Find related components, services, models
- Look for existing enum values, CSS classes, utilities that can be reused
- Identify the architectural layer (UI, service, data access)

### 2. Identify Affected Files

Create a comprehensive list of files that will be:
- **Modified**: Existing files that need changes
- **Created**: New files (if any)
- **Referenced**: Files that provide patterns to follow

For each file, note:
- File path
- Type of change (modify/create)
- Estimated lines of code affected
- Brief description of change

### 3. Document Existing Infrastructure

**Always show all related existing code**, including:
- Enums that will be used
- Base classes or interfaces
- Similar implementations to follow as patterns
- CSS class naming conventions
- Configuration structures

Include actual code snippets with file paths and line numbers.

### 4. Integration with Interview Decisions

**If `INTERVIEW-NOTES.md` exists** (from `--interactive` mode):

1. Read the interview notes file
2. Extract key decisions from the Decision Summary table
3. Incorporate decisions into relevant plan sections
4. Add **Interview Decision** callouts where applicable:

```markdown
**Interview Decision:** User specified right-alignment for numeric columns to match Excel behavior.
```

Ensure the plan reflects all choices made during the interview.

### 5. Create IMPLEMENTATION-PLAN.md

Use the Implementation Plan Template (see Templates section at end of document).

**Required sections:**
1. **Overview** - Table with metadata
2. **Problem Statement** - Current vs desired behavior
3. **Technical Analysis** - All existing infrastructure with code
4. **Implementation Plan** - Phases with before/after code blocks
5. **Design Decisions** - Inline callouts explaining choices (include Interview Decisions)
6. **Files Modified Summary** - Table with LOC estimates
7. **Risk Assessment** - Likelihood/Impact/Mitigation table
8. **Future Considerations** - Extension points
9. **Acceptance Criteria** - From Jira, AI-generated, or validated during interview
10. **Appendix** - Related files and usage examples

### 6. Design Decision Callouts

Throughout the implementation plan, add inline callouts:

```markdown
**Design Decision:** Use `flex-start` instead of `left` for better flexbox compatibility.
```

```markdown
**Interview Decision:** User confirmed preference for [specific choice] because [rationale from interview].
```

Document the reasoning for non-obvious choices.

### 7. Save the Plan

Write to: `{SPEC_FOLDER}/IMPLEMENTATION-PLAN.md`

### 8. Print Phase Summary

```
==============================================================
 PHASE 4: Implementation Planning Complete
==============================================================
 Plan saved to: {SPEC_FOLDER}/IMPLEMENTATION-PLAN.md
 Files to modify: {count}
 Estimated LOC: +{added} / -{removed}
 Interview decisions integrated: {Yes/No}
==============================================================
```

## Checkpoint

**If `--pause=critical` flag is set:**

```
==============================================================
 CHECKPOINT: Implementation plan ready for review
==============================================================
 Please review: {SPEC_FOLDER}/IMPLEMENTATION-PLAN.md

 Type 'continue' to proceed with implementation
 Or provide feedback to revise the plan
==============================================================
```

Wait for user confirmation before proceeding to Phase 5.

---

# PHASE 5: Implementation

## Objective

Execute the implementation plan using the /wsbaser:implement-spec skill.

## Steps

### 1. Invoke Coordinated Implementation

Use the Skill tool to invoke `/wsbaser:implement-spec` with the spec path:

```
/wsbaser:implement-spec {SPEC_FOLDER}
```

The implementation plan provides full context for the coding agents.

### 2. Handle Build Errors

If the build fails after implementation:

**Attempt auto-fix up to 3 times:**
1. Analyze the error message
2. Identify the root cause
3. Apply fix
4. Rebuild and test

If still failing after 3 attempts:
- Report the error to the user
- Ask for guidance
- Do NOT proceed to reviews with broken build

### 3. Verify Build Success

Run the build to confirm:

```bash
dotnet build 7c.FrontEnd.sln
```

For SCSS changes, also run:

```bash
npm run sass:web-dev-all
```

### 4. DO NOT Commit

**CRITICAL:** Leave all changes uncommitted.

Do NOT run:
- `git add`
- `git commit`
- `git push`

The user will review and commit manually.

### 5. Print Phase Summary

```
==============================================================
 PHASE 5: Implementation Complete
==============================================================
 Build Status: SUCCESS
 Files Modified:
   - {file1}
   - {file2}
   - ...

 Changes are UNCOMMITTED (ready for review)
==============================================================
```

## Output

- Modified source files (uncommitted)
- Successful build verification

---

# PHASE 6: Reviews

## Objective

Run comprehensive code reviews and auto-fix issues.

## Steps

### 1. Run All Review Agents

Launch available review agents **in parallel**. Always spawn wsbaser agents; spawn external agents only if their plugins are installed.

**Always available (wsbaser):**

1. **Architecture Review** (`wsbaser:architecture-reviewer`)
   - Reviews architectural patterns, Clean Architecture compliance, SOLID, DDD
   - Evaluates maintainability and separation of concerns

2. **Clean Code Review** (`wsbaser:clean-code-reviewer`)
   - Checks code style, DRY violations, code smells
   - Reviews SOLID compliance at method/class level

**Optional (external plugins — skip if not installed):**

3. **Architect Review** (`code-review-ai:architect-review`) — requires `code-review-ai` plugin
4. **Security Review** (`comprehensive-review:security-auditor`) — requires `comprehensive-review` plugin
5. **Code Quality Review** (`codebase-cleanup:code-reviewer`) — requires `codebase-cleanup` plugin

### 2. Collect Review Findings

Gather all findings from the review agents:
- Critical issues
- Warnings
- Suggestions

### 3. Handle Conflicting Recommendations

If reviewers provide conflicting recommendations:
- Apply all **non-conflicting** fixes automatically
- **Report conflicts** to the user in the summary

Example conflict:
- Architect says: "Extract to separate service"
- Code reviewer says: "Keep inline for simplicity"

Report these and let user decide.

### 4. Auto-Fix Non-Conflicting Issues

For each non-conflicting issue:
1. Apply the recommended fix
2. Verify build still passes
3. Log the fix applied

### 5. Rebuild After Fixes

```bash
dotnet build 7c.FrontEnd.sln
```

If build fails after fixes, revert the problematic fix and report it.

### 6. Print Phase Summary

```
==============================================================
 PHASE 6: Reviews Complete
==============================================================
 Reviews Run: Architect, Security, Code Quality

 Issues Found:     {total}
 Auto-Fixed:       {fixed}
 Conflicts:        {conflicts}

 {If conflicts > 0:}
 Conflicting Recommendations (need your decision):
   1. {description of conflict}
   2. ...
==============================================================
```

## Output

- Fixed source files (still uncommitted)
- List of any unresolved conflicts

---

# PHASE 7: Test Plan Generation

## Objective

Create a comprehensive TEST-PLAN.md with properly formatted Gherkin scenarios.

## Steps

### 1. Map Tests to Acceptance Criteria

For each acceptance criterion from Phase 1:
- Create a **mandatory test** that verifies the criterion
- These are feature verification tests that MUST pass

### 2. Analyze Blast Radius

Create a **full breakdown matrix** showing impact:

| Dimension | Analysis |
|-----------|----------|
| **Modules** | Which modules contain affected code |
| **Pages** | Which pages use the affected components |
| **Components** | Which components are directly/indirectly affected |
| **File Count** | Number of files in each category |

Use grep/glob to count actual usages in the codebase.

### 3. Identify Optional Tests

For each potential regression or edge case:
1. Estimate failure probability (0-100%)
2. **Only include if probability >= 2%**
3. Order by probability (highest first)

Include reasoning for each probability estimate.

### 4. Format Test Scenarios

**ENFORCED Gherkin Format:**

```gherkin
Scenario: <Descriptive Name>

  Given <precondition>
  And <additional precondition>

  When <action>

  Then <expected result>
  And <additional expectation>
```

**Rules (non-negotiable):**
- `Scenario:` header at top of each test (no indent)
- **All keywords at same 2-space indent**: Given, When, Then, And
- Blank line after Scenario header
- Blank lines between Given/When/Then blocks
- No additional indentation for And

### 5. Include Test Setup Code

For tests requiring code modifications:
- Provide **exact copy-pasteable code snippets**
- Show the file path to modify
- Use real localhost URLs (e.g., `http://localhost:7000/sales/sales_personnel`)

### 6. Create Interactive Checklist

Include a table with checkboxes:

```markdown
| ID | Test | Status | Notes |
|----|------|--------|-------|
| TEST-01 | Center Alignment | [ ] Pass / [ ] Fail | |
| TEST-02 | Right Alignment | [ ] Pass / [ ] Fail | |
```

### 7. Do NOT Include

- Revert/cleanup reminders (skip entirely)
- Tests with probability < 2%
- Filtered out section

### 8. Save the Test Plan

Use the Test Plan Template (see Templates section at end of document).

Write to: `{SPEC_FOLDER}/TEST-PLAN.md`

### 9. Print Phase Summary

```
==============================================================
 PHASE 7: Test Plan Complete
==============================================================
 Test plan saved to: {SPEC_FOLDER}/TEST-PLAN.md

 Mandatory Tests: {count}
 Optional Tests:  {count} (probability >= 2%)

 Blast Radius:
   Modules:    {count}
   Pages:      {count}
   Components: {count}
==============================================================
```

---

# PHASE 8: Summary

## Objective

Generate IMPLEMENTATION-NOTES.md and display the final summary card.

## Steps

### 1. Create IMPLEMENTATION-NOTES.md

Use the Implementation Notes Template (see Templates section at end of document).

This document captures the implementation journey:

**Required content:**
- **Implementation Summary** - What was built and why
- **Motivation** - The problem being solved
- **Before -> After** - Visual/code comparison of the change
- **Key Decisions** - Architectural choices made
- **Decisions to Reconsider** - Things that might need revisiting
- **Trade-offs** - What was prioritized and what was sacrificed

Write to: `{SPEC_FOLDER}/IMPLEMENTATION-NOTES.md`

### 2. Gather Statistics

Collect:
- List of all modified files
- Lines added/removed per file (from git diff --stat)
- Total documents created

### 3. Display Summary Card

```
+================================================================+
|  IMPLEMENTATION COMPLETE                                        |
+================================================================+
|  Story: {JIRA_KEY} - {JIRA_TITLE}                              |
|  Branch: {BRANCH_NAME}                                          |
+================================================================+
|  Documents Created:                                             |
|    - {SPEC_FOLDER}/IMPLEMENTATION-PLAN.md                       |
|    - {SPEC_FOLDER}/TEST-PLAN.md                                 |
|    - {SPEC_FOLDER}/IMPLEMENTATION-NOTES.md                      |
|    - {SPEC_FOLDER}/INTERVIEW-NOTES.md (if --interactive)        |
+================================================================+
|  Files Modified: {count}                                        |
|    - {file1} (+{added}/-{removed})                              |
|    - {file2} (+{added}/-{removed})                              |
|    - ...                                                        |
+================================================================+
|  Recommended Next Steps:                                        |
|    1. Review uncommitted changes: git diff                      |
|    2. Run manual tests per TEST-PLAN.md                         |
|    3. Commit changes: git add . && git commit                   |
|    4. Create PR when ready                                      |
+================================================================+
```

### 4. Report Any Outstanding Issues

If there are unresolved conflicts from reviews or other issues:

```
Outstanding Items:
  - {description of unresolved item}
  - ...
```

## Completion

The workflow is complete. All changes remain uncommitted for user review.

---

# TEMPLATES

## Interview Notes Template

```markdown
# Interview Notes: {JIRA_KEY} - {JIRA_TITLE}

**Date**: {DATE}
**Story**: [{JIRA_KEY}]({JIRA_URL})
**Type**: {JIRA_TYPE}
**Branch**: `{BRANCH_NAME}`

---

## Decision Summary

| Category | Decision | Rationale |
|----------|----------|-----------|
{DECISIONS_TABLE}

---

## Validated Acceptance Criteria

{ACCEPTANCE_CRITERIA_LIST}

---

## Interview Statistics

- **Categories Covered**: {CATEGORIES_COUNT}
- **Questions Asked**: {QUESTIONS_COUNT}
- **Duration**: {INTERVIEW_TURNS} turns

---

## Full Interview Transcript

{TRANSCRIPT}

---

*Generated by /wsbaser:implement-story --interactive*
```

## Implementation Plan Template

```markdown
# Implementation Plan: {JIRA_KEY} - {JIRA_TITLE}

## Overview

| Field | Value |
|-------|-------|
| **Jira Ticket** | [{JIRA_KEY}](https://7c-is.atlassian.net/browse/{JIRA_KEY}) |
| **Title** | {JIRA_TITLE} |
| **Type** | {JIRA_TYPE} |
| **Branch** | `{BRANCH_NAME}` |
| **Priority** | {Priority} |
| **Sprint** | {Sprint} |

## Problem Statement

### Current Behavior
{Describe what currently happens}

### Desired Behavior
{Describe what should happen after implementation}

---

## Technical Analysis

### Existing Infrastructure

{Show all related existing code that will be used or referenced}

#### {Component/Pattern Name}
**File:** `{file_path}`

```{language}
{code snippet}
```

{Repeat for each relevant piece of existing infrastructure}

### Current Implementation (To Be Modified)

**File:** `{file_path}`

```{language}
{current code}
```

---

## Implementation Plan

### Phase 1: {Phase Name}

**File to modify:** `{file_path}`

**Changes:**
1. {Change description}
2. {Change description}

**Before:**
```{language}
{current code}
```

**After:**
```{language}
{new code}
```

**Design Decision:** {Explanation of why this approach was chosen}

---

### Phase 2: {Phase Name}

{Repeat structure for each phase}

---

## Files Modified Summary

| File | Change Type | Description | Est. LOC |
|------|-------------|-------------|----------|
| `{file_path}` | Modify | {Brief description} | +{added}/-{removed} |
| `{file_path}` | Modify | {Brief description} | +{added}/-{removed} |

**Total files changed:** {count}

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| {Risk description} | Low/Medium/High | Low/Medium/High | {Mitigation strategy} |
| {Risk description} | Low/Medium/High | Low/Medium/High | {Mitigation strategy} |

---

## Future Considerations

1. **{Consideration title}:** {Description of potential future enhancement or extension point}
2. **{Consideration title}:** {Description}

---

## Acceptance Criteria

{If from Jira:}
- [ ] {Criterion 1}
- [ ] {Criterion 2}
- [ ] {Criterion 3}

{If AI-Generated, add note:}
*Note: Acceptance criteria were AI-generated from the story description as none were provided in Jira.*

---

## Appendix: Code References

### Related Files (Read-Only Reference)

| File | Purpose |
|------|---------|
| `{file_path}` | {Purpose description} |
| `{file_path}` | {Purpose description} |

### Usage Example

To use this feature:

```{language}
{Example code showing how to use the new feature}
```
```

## Implementation Notes Template

```markdown
# Implementation Notes: {JIRA_KEY} - {JIRA_TITLE}

## Summary

{2-3 sentences describing what was implemented and why}

---

## Motivation

### The Problem

{Describe the problem that was being solved}

### Why This Solution

{Explain why this approach was chosen over alternatives}

---

## Before -> After

### Before

{Description or code showing the previous state}

```{language}
{Before code snippet if applicable}
```

### After

{Description or code showing the new state}

```{language}
{After code snippet if applicable}
```

### Visual Comparison

{If applicable, describe the visual difference}

---

## Key Implementation Decisions

### 1. {Decision Title}

**Choice:** {What was decided}

**Reasoning:** {Why this choice was made}

**Alternatives Considered:**
- {Alternative 1} - {Why rejected}
- {Alternative 2} - {Why rejected}

### 2. {Decision Title}

{Repeat structure}

---

## Decisions Worth Reconsidering

The following decisions were made pragmatically but might benefit from review in the future:

### 1. {Decision Title}

**Current Approach:** {What was done}

**Potential Improvement:** {What could be done differently}

**When to Revisit:** {Circumstances that would warrant revisiting}

---

## Trade-offs

| Prioritized | Sacrificed | Rationale |
|-------------|------------|-----------|
| {What was prioritized} | {What was sacrificed} | {Why this trade-off} |
| {What was prioritized} | {What was sacrificed} | {Why this trade-off} |

---

## Technical Debt Incurred

{List any technical debt introduced, or state "None identified"}

- {Debt item 1}
- {Debt item 2}

---

## Lessons Learned

{Any insights gained during implementation that might be useful for future work}

1. {Lesson 1}
2. {Lesson 2}

---

## Related Documentation

- [Implementation Plan](./IMPLEMENTATION-PLAN.md)
- [Test Plan](./TEST-PLAN.md)
- [Jira Story](https://7c-is.atlassian.net/browse/{JIRA_KEY})
```

## Test Plan Template

```markdown
# Test Plan: {JIRA_KEY} - {JIRA_TITLE}

## Document Info

| Field | Value |
|-------|-------|
| **Feature** | {Brief feature description} |
| **Jira** | [{JIRA_KEY}](https://7c-is.atlassian.net/browse/{JIRA_KEY}) |
| **Base URL** | `http://localhost:7000` |
| **Test Page** | [http://localhost:7000/{path}](http://localhost:7000/{path}) |

---

## Blast Radius Matrix

| Dimension | Affected | Count |
|-----------|----------|:-----:|
| **Modules** | {Module1}, {Module2} | {N} |
| **Pages** | {Page1}, {Page2} | {N} |
| **Components** | {Component1}, {Component2} | {N} |
| **Files** | {List or count} | {N} |

---

## Mandatory Tests (Feature Verification)

These tests verify the new feature is implemented correctly. **All must pass.**

---

### TEST-01: {Test Name} (MANDATORY)

**Objective:** {What this test verifies}

**Setup:** Modify `{file_path}`:

```{language}
{Exact code to paste for test setup}
```

**Steps:**

```gherkin
Scenario: {Descriptive Name}

  Given {precondition}
  And {additional precondition}

  When {action}

  Then {expected result}
  And {additional expectation}
```

---

### TEST-02: {Test Name} (MANDATORY)

{Repeat structure}

---

## Test Execution Checklist

### Mandatory Tests

| ID | Test | Status | Notes |
|----|------|--------|-------|
| TEST-01 | {Test Name} | [ ] Pass / [ ] Fail | |
| TEST-02 | {Test Name} | [ ] Pass / [ ] Fail | |

**Result:** If all pass -> Feature is implemented correctly.

---

## Optional Tests (Risk-Based)

These tests have low but non-negligible failure probability. Execute if time permits, ordered by risk.

---

### OPT-01: {Test Name} ({probability}%)

**Objective:** {What this test verifies}

**Why {probability}%:** {Explanation of the risk and probability estimate}

**Steps:**

```gherkin
Scenario: {Descriptive Name}

  Given {precondition}
  And {additional precondition}

  When {action}

  Then {expected result}
  And {additional expectation}
```

---

{Repeat for each optional test with probability >= 2%}

---

## Quick Reference

| Priority | Tests | Count |
|----------|-------|:-----:|
| **Mandatory** | TEST-01, TEST-02, ... | {N} |
| **Optional** | OPT-01 ({X}%), OPT-02 ({Y}%), ... | {N} |
```
