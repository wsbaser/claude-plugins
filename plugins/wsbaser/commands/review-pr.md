---
allowed-tools: Bash(az account show:*), Bash(az repos pr show:*), Bash(az repos pr list:*), Bash(az repos pr diff:*), Bash(az rest:*), Bash(git show:*), Bash(git diff:*), Bash(git log:*), Bash(git fetch:*), Bash(mkdir:*), Write, mcp__atlassian__*
description: Code review a pull request and save results to local file
disable-model-invocation: false
---

Provide a code review for the given pull request and save the results to a local markdown file (not to the PR).

To do this, follow these steps precisely:

## Part 0: Azure CLI Authentication Check (MUST DO FIRST)

**CRITICAL: This step MUST be executed before ANY other steps. Do not proceed if authentication fails.**

0. Verify Azure CLI authentication status:
   a. Run `az account show` to check if the user is logged in to Azure
   b. If the command fails with an error indicating login is required (e.g., "Please run 'az login'", "AADSTS", or similar authentication errors):
      - Display this error message to the user IMMEDIATELY and STOP:
        ```
        ERROR: Azure CLI Authentication Required

        You are not logged in to Azure CLI. Please run the following command and try again:

            az login

        After logging in, run this code review command again.
        ```
      - Do NOT proceed with any other steps
      - Do NOT attempt to continue the review
   c. If `az account show` succeeds, display a brief confirmation (e.g., "Azure CLI authenticated as: {user}") and proceed to PR Metadata Extraction

## Part 0.5: PR Metadata Extraction (MANDATORY)

**CRITICAL: You MUST extract the PR's actual source and target branches from Azure DevOps. NEVER assume the locally checked-out branch is the PR's source branch.**

0.5. Extract PR metadata using `az repos pr show --id {PR_ID}`:
   a. From the JSON output, extract:
      - `sourceRefName` (e.g., `refs/heads/S7C1-2105-FE-Add-InvoiceId-to-JournalTransactions-page`)
      - `targetRefName` (e.g., `refs/heads/develop`)
      - PR title, description, URL
   b. Strip the `refs/heads/` prefix to get clean branch names. Store these as **canonical variables** for ALL subsequent steps:
      - `{SOURCE_BRANCH}` - the PR's actual source branch (from `sourceRefName`)
      - `{TARGET_BRANCH}` - the PR's actual target branch (from `targetRefName`)
   c. Fetch the source branch if not locally available:
      - Run `git fetch origin {SOURCE_BRANCH}` to ensure the branch is available for diffs
   d. Display the extracted info for user verification:
      ```
      PR #{PR_ID}: {PR_TITLE}
      Source: {SOURCE_BRANCH}
      Target: {TARGET_BRANCH}
      ```

## Part 0.6: PR Diff Scope Resolution (MANDATORY)

**CRITICAL: On long-lived branches, `git diff {TARGET_BRANCH}...origin/{SOURCE_BRANCH}` returns ALL commits on the source branch, not just the ones in this PR. The Azure DevOps iterations API provides the actual PR-scoped merge base.**

0.6. Resolve the correct diff base and head commits for this PR:
   a. Extract ORG, PROJECT, and REPO from the PR metadata URL (from Part 0.5). Call the Azure DevOps PR iterations API:
      ```bash
      az rest --method get \
        --uri "https://dev.azure.com/{ORG}/{PROJECT}/_apis/git/repositories/{REPO}/pullRequests/{PR_ID}/iterations?api-version=7.1" \
        --resource "499b84ac-1321-427f-aa17-267ca6975798" \
        --output-file {temp_file}
      ```
   b. Parse the JSON response to extract from the **last iteration** (last element in `value` array):
      - `commonRefCommit.commitId` -> store as `{DIFF_BASE}`
      - `sourceRefCommit.commitId` -> store as `{DIFF_HEAD}`
   c. Fetch the commits if not locally available:
      ```bash
      git fetch origin {DIFF_BASE} {DIFF_HEAD}
      ```
   d. Store `{DIFF_BASE}` and `{DIFF_HEAD}` as the **canonical diff variables** for ALL subsequent steps. These replace `{TARGET_BRANCH}...origin/{SOURCE_BRANCH}` in every diff command.
   e. Validate with a sanity check on file count:
      - Run `git diff {DIFF_BASE}...{DIFF_HEAD} --stat` to get the list of changed files
      - Display the number of files changed to the user
      - If > 50 files, warn: "WARNING: This PR has {N} files changed. Please verify this matches the PR in Azure DevOps."

## Part 1: Bug Detection Review (Steps 1-7)

1. Use a Haiku agent to check if the pull request (a) is closed, (b) is a draft, or (c) does not need a code review (eg. because it is an automated pull request, or is very simple and obviously ok). If so, do not proceed. **Pass the PR metadata from Part 0.5 (source branch, target branch, PR title) to the agent.**
2. Use another Haiku agent to give you a list of file paths to (but not the contents of) any relevant CLAUDE.md files from the codebase: the root CLAUDE.md file (if one exists), as well as any CLAUDE.md files in the directories whose files the pull request modified. **Use `git diff {DIFF_BASE}...{DIFF_HEAD} --name-only` to determine which files the PR modified.**
3. Use a Haiku agent to view the pull request, and ask the agent to return a summary of the change. **Pass the PR metadata from Part 0.5 (source branch, target branch, PR title) to the agent.**
4. Then, launch 5 parallel Sonnet agents to independently code review the change. **Each agent MUST receive the PR diff commits ({DIFF_BASE}, {DIFF_HEAD}) and use `git diff {DIFF_BASE}...{DIFF_HEAD}` for all diffs.** The agents should do the following, then return a list of issues and the reason each issue was flagged (eg. CLAUDE.md adherence, bug, historical git context, etc.):
   a. Agent #1: Audit the changes to make sure they compily with the CLAUDE.md. Note that CLAUDE.md is guidance for Claude as it writes code, so not all instructions will be applicable during code review.
   b. Agent #2: Read the file changes in the pull request, then do a shallow scan for obvious bugs. Avoid reading extra context beyond the changes, focusing just on the changes themselves. Focus on large bugs, and avoid small issues and nitpicks. Ignore likely false positives.
   c. Agent #3: Read the git blame and history of the code modified, to identify any bugs in light of that historical context
   d. Agent #4: Read previous pull requests that touched these files, and check for any comments on those pull requests that may also apply to the current pull request.
   e. Agent #5: Read code comments in the modified files, and make sure the changes in the pull request comply with any guidance in the comments.
5. For each issue found in #4, launch a parallel Haiku agent that takes the PR, issue description, and list of CLAUDE.md files (from step 2), and returns a score to indicate the agent's level of confidence for whether the issue is real or false positive. To do that, the agent should score each issue on a scale from 0-100, indicating its level of confidence. For issues that were flagged due to CLAUDE.md instructions, the agent should double check that the CLAUDE.md actually calls out that issue specifically. The scale is (give this rubric to the agent verbatim):
   a. 0: Not confident at all. This is a false positive that doesn't stand up to light scrutiny, or is a pre-existing issue.
   b. 25: Somewhat confident. This might be a real issue, but may also be a false positive. The agent wasn't able to verify that it's a real issue. If the issue is stylistic, it is one that was not explicitly called out in the relevant CLAUDE.md.
   c. 50: Moderately confident. The agent was able to verify this is a real issue, but it might be a nitpick or not happen very often in practice. Relative to the rest of the PR, it's not very important.
   d. 75: Highly confident. The agent double checked the issue, and verified that it is very likely it is a real issue that will be hit in practice. The existing approach in the PR is insufficient. The issue is very important and will directly impact the code's functionality, or it is an issue that is directly mentioned in the relevant CLAUDE.md.
   e. 100: Absolutely certain. The agent double checked the issue, and confirmed that it is definitely a real issue, that will happen frequently in practice. The evidence directly confirms this.
6. Filter out any issues with a score less than 80.
7. Write the review results to a local markdown file using the Write tool:
   - First, create the `./code-reviews/` directory if it doesn't exist using `mkdir -p ./code-reviews`
   - File path: `./code-reviews/PR-{PR_NUMBER}-review.md`
   - Include PR metadata at the top (number, title, URL, branch info)
   - List all issues found (or state "No issues found" if none)
   - Keep the output brief and avoid emojis
   - Link and cite relevant code, files, and URLs

## Part 2: Code Changes Analysis (Steps 8-12)

After completing the bug detection review, perform a detailed code changes analysis:

8. Validate prerequisites for changes analysis:
   a. Check if Atlassian MCP is available by attempting to list available MCP tools or making a test call
   b. If Atlassian MCP is NOT available:
      - Display this warning to the user:
        ```
        WARNING: Code Changes Analysis Skipped

        Atlassian MCP is required for code changes analysis but is not available.
        Please install/enable Atlassian MCP and run the command again.

        The standard code review (bug detection) has been completed and saved to:
        ./code-reviews/PR-{PR_NUMBER}-review.md
        ```
      - Stop here (do not proceed to steps 9-12)
   c. Parse PR description/body for a Jira link (pattern: `https://*.atlassian.net/browse/*` or similar Jira URL patterns)
   d. If NO Jira link found in PR description:
      - Display this warning to the user:
        ```
        WARNING: Code Changes Analysis Skipped

        No Jira ticket link found in PR description.
        Code changes analysis requires a linked Jira story to map changes to requirements.

        Please ensure the PR description contains a Jira link like:
        https://7c-is.atlassian.net/browse/S7C1-XXXX

        The standard code review (bug detection) has been completed and saved to:
        ./code-reviews/PR-{PR_NUMBER}-review.md
        ```
      - Stop here (do not proceed to steps 9-12)

9. Use Atlassian MCP to retrieve story details:
   a. Extract the story/issue ID from the Jira URL found in step 8 (e.g., S7C1-2229)
   b. Use Atlassian MCP to fetch the Jira issue details (title, description, acceptance criteria, story points if available)
   c. If the fetch fails:
      - Display this warning to the user:
        ```
        WARNING: Code Changes Analysis Skipped

        Failed to retrieve Jira story {STORY_ID} via Atlassian MCP.
        Please check your MCP connection and permissions.

        The standard code review (bug detection) has been completed and saved to:
        ./code-reviews/PR-{PR_NUMBER}-review.md
        ```
      - Stop here (do not proceed to steps 10-12)
   d. Parse the Jira response to extract:
      - Story ID and title
      - Story description
      - Acceptance criteria / requirements (as numbered list)
      - Any linked parent epic or related stories

10. Use a Sonnet agent to group changes into logical blocks. **Pass the PR diff commits ({DIFF_BASE}, {DIFF_HEAD}) to the agent.**
    a. Get the full PR diff using `git diff {DIFF_BASE}...{DIFF_HEAD}`. NEVER diff against the local/checked-out branch.
    b. Filter out trivial changes (do NOT include these in analysis):
       - Whitespace-only changes (indentation, trailing spaces)
       - Import/using statement reordering
       - Auto-generated files (*.Designer.cs, *.g.cs, *.generated.*)
       - Resource files (*.resx) unless actual text content changed
       - Empty line additions/removals only
    c. Analyze the remaining substantive changes across all files
    d. Group related changes by FUNCTIONALITY, not just by file:
       - Changes that implement a single feature/fix together
       - Model changes + their usages = one block
       - Service changes + API changes = one block
       - Component + related styles/tests = one block
    e. For each logical block, determine:
       - A descriptive name (e.g., "Added invitation language support", "Fixed HTTP error handling")
       - Category: Feature | Bug Fix | Refactor | Chore
       - List of files involved
       - Brief summary of what the block accomplishes
    f. Return a list of 3-10 logical blocks (combine very small changes, split if too complex)

11. For each logical block from step 10, launch a parallel Sonnet agent to analyze. **Pass the PR diff commits ({DIFF_BASE}, {DIFF_HEAD}) to each agent.**
    a. Extract code BEFORE the change:
       - Use `git show {DIFF_BASE}:{file_path}` to get original file content
       - Show 5-10 lines of relevant context around the changed area
    b. Extract code AFTER the change:
       - Use `git show {DIFF_HEAD}:{file_path}` to get new file content
       - Show the same section with changes applied
    c. Match to story requirements:
       - Which specific requirement from step 9 does this change address?
       - Is this a "Supporting change" not directly in requirements?
       - Is this potentially "Unrelated" (scope creep)?
    d. Provide concise analysis:
       - **Why**: 1-2 sentences explaining the technical/business reason for this change
       - **Story Alignment**: Which requirement # it addresses, or "Supporting change"
       - **Correctness**: One of: "Correct" | "Review needed" | "Issue found"
       - **Suggestions**: Only include if there are meaningful improvements (omit if none)
    e. Keep analysis brief - aim for ~15-20 lines per block total

12. Write the changes analysis to a separate markdown file:
    a. File path: `./code-reviews/PR-{PR_NUMBER}-changes-analysis.md`
    b. Use the Changes Analysis Report format (see template below)
    c. Include:
       - PR metadata header
       - Story context section with requirements from Jira
       - Changes overview table for quick scanning
       - Detailed analysis for each logical block
       - Summary statistics

---

## Examples of false positives, for steps 4 and 5:

- Pre-existing issues
- Something that looks like a bug but is not actually a bug
- Pedantic nitpicks that a senior engineer wouldn't call out
- Issues that a linter, typechecker, or compiler would catch (eg. missing or incorrect imports, type errors, broken tests, formatting issues, pedantic style issues like newlines). No need to run these build steps yourself -- it is safe to assume that they will be run separately as part of CI.
- General code quality issues (eg. lack of test coverage, general security issues, poor documentation), unless explicitly required in CLAUDE.md
- Issues that are called out in CLAUDE.md, but explicitly silenced in the code (eg. due to a lint ignore comment)
- Changes in functionality that are likely intentional or are directly related to the broader change
- Real issues, but on lines that the user did not modify in their pull request

---

## Notes:

- **CRITICAL: NEVER use the currently checked-out local branch for diffs. ALWAYS use `{DIFF_BASE}` and `{DIFF_HEAD}` resolved from the Azure DevOps PR iterations API in Part 0.6. The local branch may be completely different from the PR's source branch.**
- All `git diff` commands MUST use: `git diff {DIFF_BASE}...{DIFF_HEAD}` (where these are the commit SHAs from the PR iterations API, resolved in Part 0.6)
- `{DIFF_BASE}` = `commonRefCommit.commitId` from the last PR iteration (the actual merge base for this PR)
- `{DIFF_HEAD}` = `sourceRefCommit.commitId` from the last PR iteration (the tip of the PR's source)
- `{SOURCE_BRANCH}` and `{TARGET_BRANCH}` (from Part 0.5) are for display/metadata only, NOT for diffs
- NEVER: `git diff` against HEAD, the local branch, `{TARGET_BRANCH}...origin/{SOURCE_BRANCH}`, or any ref not from the iterations API
- Do not check build signal or attempt to build or typecheck the app. These will run separately, and are not relevant to your code review.
- Use `az repos pr` commands to interact with Azure DevOps PRs (eg. `az repos pr show --id {PR_ID}` to fetch a pull request), rather than web fetch. For Azure DevOps, use commands like:
  - `az repos pr show --id {PR_ID}` - Get PR details (MUST be run in Part 0.5 to extract source/target branches)
  - `az repos pr list` - List PRs
  - `az rest` - Call Azure DevOps REST API (used in Part 0.6 to get PR iterations for diff scope)
- Make a todo list first
- You must cite and link each bug (eg. if referring to a CLAUDE.md, you must link it)
- IMPORTANT: Do NOT post any comments to the PR. Only write to the local files.

---

## Bug Review Report Format (for step 7):

```markdown
---

# Code Review Report

**PR:** #123 - Example PR title
**URL:** https://github.com/owner/repo/pull/123
**Branch:** feature-branch -> main
**Date:** 2026-01-09

---

## Summary

Brief description of what this PR does.

---

## Issues Found

### 1. Brief description of bug

**Source:** CLAUDE.md says "..."
**Confidence:** 85
**Location:** [path/to/file.cs#L10-L15](https://github.com/owner/repo/blob/full-sha/path/to/file.cs#L10-L15)

Explanation of the issue.

### 2. Brief description of bug

**Source:** some/other/CLAUDE.md says "..."
**Confidence:** 90
**Location:** [path/to/file.cs#L20-L25](https://github.com/owner/repo/blob/full-sha/path/to/file.cs#L20-L25)

Explanation of the issue.

---

## Summary Statistics

- Total issues found: 2
- Confidence threshold: 80+

Generated with Claude Code

---
```

Or, if you found no issues:

```markdown
---

# Code Review Report

**PR:** #123 - Example PR title
**URL:** https://github.com/owner/repo/pull/123
**Branch:** feature-branch -> main
**Date:** 2026-01-09

---

## Issues Found

No issues found. Checked for bugs and CLAUDE.md compliance.

---

Generated with Claude Code

---
```

---

## Changes Analysis Report Format (for step 12):

```markdown
# Code Changes Analysis

**PR:** #1629 - S7C1-XXXX Description
**Branch:** feature-branch -> develop | **Date:** 2026-01-15

---

## Story Context

**Story:** [S7C1-2229](https://7c-is.atlassian.net/browse/S7C1-2229)
**Title:** Re-send already expired invitation failed

### Requirements (from Jira)
1. Fix languageId missing when resending expired invitations
2. Handle edge cases for expired invitations
3. Ensure proper error messaging

---

## Changes Overview

| # | Block | Category | Addresses | Status |
|---|-------|----------|-----------|--------|
| 1 | Added invitation language support | Feature | Req #1 | Correct |
| 2 | HTTP error handling | Refactor | Supporting | Review |

---

## Detailed Analysis

### 1. Added invitation language support

**Category:** Feature | **Addresses:** Requirement #1

**Before** (`InvitationMapResponse.cs:10-14`)
```csharp
public class InvitationMapResponse
{
    public string Email { get; set; }
    public string Status { get; set; }
}
```

**After** (`InvitationMapResponse.cs:10-15`)
```csharp
public class InvitationMapResponse
{
    public string Email { get; set; }
    public string Status { get; set; }
    public string LanguageId { get; set; }  // Added
}
```

| Aspect | Analysis |
|--------|----------|
| **Why** | Missing field caused invitation resend to fail - languageId was not captured from backend response |
| **Alignment** | Directly addresses Requirement #1 from story |
| **Assessment** | Correct - follows existing patterns, no issues found |

---

### 2. HTTP error handling improvements

**Category:** Refactor | **Addresses:** Supporting change

**Before** (`HttpService.cs:45-48`)
```csharp
if (!response.IsSuccessStatusCode)
{
    throw new HttpRequestException($"Request failed");
}
```

**After** (`HttpService.cs:45-54`)
```csharp
if (!response.IsSuccessStatusCode)
{
    if (response.StatusCode == HttpStatusCode.Forbidden)
    {
        NavigationManager.NavigateTo("/login", forceLoad: true);
        return default;
    }
    throw new HttpRequestException($"Request failed");
}
```

| Aspect | Analysis |
|--------|----------|
| **Why** | Redirect to login on session expiration instead of showing error |
| **Alignment** | Supporting change - improves UX but not directly in story requirements |
| **Assessment** | Review needed - `return default` may cause null reference issues |
| **Suggestion** | Consider throwing specific exception instead of returning default |

---

## Summary

| Metric | Value |
|--------|-------|
| Total blocks analyzed | 2 |
| Direct requirement changes | 1 |
| Supporting changes | 1 |
| Items needing review | 1 |
| Trivial changes excluded | 3 |

Generated with Claude Code
```

---

## Code Linking Format:

When linking to code, follow the following format precisely, otherwise the Markdown preview won't render correctly: https://github.com/anthropics/claude-cli-internal/blob/c21d3c10bc8e898b7ac1a2d745bdc9bc4e423afe/package.json#L10-L15
  - Requires full git sha
  - You must provide the full sha. Commands like `https://github.com/owner/repo/blob/$(git rev-parse HEAD)/foo/bar` will not work, since your comment will be directly rendered in Markdown.
  - Repo name must match the repo you're code reviewing
  - # sign after the file name
  - Line range format is L[start]-L[end]
  - Provide at least 1 line of context before and after, centered on the line you are commenting about (eg. if you are commenting about lines 5-6, you should link to `L4-7`)
