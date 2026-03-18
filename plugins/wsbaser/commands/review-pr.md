---
allowed-tools: Bash(az account show:*), Bash(az repos pr show:*), Bash(az repos pr list:*), Bash(az repos pr diff:*), Bash(az rest:*), Bash(git show:*), Bash(git diff:*), Bash(git log:*), Bash(git fetch:*), Bash(mkdir:*), Bash(git worktree:*), Bash(git branch:*), Bash(curl:*), Bash(kill:*), Bash(rm:*), Write, Read, Edit, Glob, Grep, Skill, mcp__atlassian__*
description: Code review a pull request and save results to local file
disable-model-invocation: false
---

Provide a code review for the given pull request and save the results to a local markdown file (not to the PR).

**Usage:**
- `review-pr {PR_ID}` — review a specific PR
- `review-pr --next` — find the oldest active PR assigned to you as reviewer and review it
- `review-pr {PR_ID} --verify` — review a PR and then browser-verify any high-confidence runtime bugs
- `review-pr --next --verify` — same as `--next`, with browser verification after review

To do this, follow these steps precisely:

## Argument Parsing (Step 0 — do this before everything else, including auth)

Parse all flags and arguments from the command invocation:
- `{PR_ID}` — the numeric PR identifier (if provided)
- `--next` — discover the next PR to review (mutually exclusive with `{PR_ID}`)
- `--verify` — after the review completes (Parts 0–2), run browser verification on qualifying bugs

Store the `--verify` flag as `{VERIFY}` (true/false) for use in Part 3.

## Part 0: Azure CLI Authentication Check (MUST DO FIRST)

**CRITICAL: This step MUST be executed first after argument parsing. Do not proceed if authentication fails.**

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

## Part 0.1: `--next` PR Discovery (only if `--next` was passed)

a. Validate usage: if both `--next` AND an explicit PR ID were provided, display an error and stop:
   ```
   ERROR: --next cannot be combined with an explicit PR ID.
   Usage: review-pr --next   OR   review-pr {PR_ID}
   ```

b. Extract the current user's UPN (email) from the `az account show` output already retrieved in Part 0.

c. Fetch active, non-draft PRs where the current user is a reviewer:
   ```bash
   az repos pr list \
     --status active \
     --reviewer "{CURRENT_USER_UPN}" \
     --output json
   ```

d. Filter the results:
   - Exclude PRs where `isDraft == true`
   - Exclude PRs that already have a local review file at `./code-reviews/PR-{pullRequestId}-review.md`

e. From the remaining PRs, select the one with the **oldest `creationDate`**.

f. If no PRs remain after filtering, display this message and stop:
   ```
   No PRs to review. All active PRs assigned to you have already been reviewed locally,
   or there are no active PRs assigned to you as a reviewer.
   ```

g. Display the selected PR and proceed immediately (no confirmation needed):
   ```
   Selected PR for review:
   PR #{pullRequestId}: {title}
   Created: {creationDate}
   ```

h. Set `{PR_ID}` = the selected PR's `pullRequestId`. All subsequent parts (0.5, 0.6, 1, 2) use this value unchanged.

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
   e. **If an explicit PR ID was provided** (i.e., `--next` was NOT used) and `./code-reviews/PR-{PR_ID}-review.md` already exists locally:
      - Delete `./code-reviews/PR-{PR_ID}-review.md`
      - Delete `./code-reviews/PR-{PR_ID}-changes-analysis.md` (if it exists)
      - Display: `Removed existing review files for PR #{PR_ID}. Starting fresh review.`

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

**After the gatekeeper check passes, launch Part 1 (steps 2-7) and Part 2 (steps 8-12) in parallel as independent tracks.** They share no data dependencies — both use only the PR metadata from Part 0 (`{DIFF_BASE}`, `{DIFF_HEAD}`, PR description). Do not wait for Part 1 to complete before starting Part 2.

2. Use another Haiku agent to give you a list of file paths to (but not the contents of) any relevant CLAUDE.md files from the codebase: the root CLAUDE.md file (if one exists), as well as any CLAUDE.md files in the directories whose files the pull request modified. **Use `git diff {DIFF_BASE}...{DIFF_HEAD} --name-only` to determine which files the PR modified.**
3. Use a Haiku agent to view the pull request, and ask the agent to return a summary of the change. **Pass the PR metadata from Part 0.5 (source branch, target branch, PR title) to the agent.**
4. Then, launch 5 parallel Sonnet agents to independently code review the change. **Each agent MUST receive the PR diff commits ({DIFF_BASE}, {DIFF_HEAD}) and use `git diff {DIFF_BASE}...{DIFF_HEAD}` for all diffs.** The agents should do the following, then return a list of issues and the reason each issue was flagged (eg. CLAUDE.md adherence, bug, historical git context, etc.):
   a. Agent #1: Audit the changes to make sure they compily with the CLAUDE.md. Note that CLAUDE.md is guidance for Claude as it writes code, so not all instructions will be applicable during code review.
   b. Agent #2: Read the file changes in the pull request, then do a shallow scan for obvious bugs. Avoid reading extra context beyond the changes, focusing just on the changes themselves. Focus on large bugs, and avoid small issues and nitpicks. Ignore likely false positives.
   c. Agent #3: Read the git blame and history of the code modified, to identify any bugs in light of that historical context
   d. Agent #4: Read previous pull requests that touched these files, and check for any comments on those pull requests that may also apply to the current pull request.
   e. Agent #5: Read code comments in the modified files, and make sure the changes in the pull request comply with any guidance in the comments.
5. For each issue found in #4, launch a parallel Sonnet agent that takes the PR, issue description, and list of CLAUDE.md files (from step 2), and returns a score to indicate the agent's level of confidence for whether the issue is real or false positive. To do that, the agent should score each issue on a scale from 0-100, indicating its level of confidence. For issues that were flagged due to CLAUDE.md instructions, the agent should double check that the CLAUDE.md actually calls out that issue specifically. The scale is (give this rubric to the agent verbatim):
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

Perform a detailed code changes analysis (runs in parallel with Part 1):

8. Attempt to load Jira story context (optional — analysis always proceeds regardless):
   a. Parse PR description/body for a Jira link (pattern: `https://*.atlassian.net/browse/*` or similar Jira URL patterns). Store as `{JIRA_URL}` if found.
   b. If Atlassian MCP appears available AND a Jira link was found, attempt to fetch story details in step 9. Otherwise, set `{STORY_CONTEXT}` = null — then skip to step 10.

9. (Only if Jira link and Atlassian MCP are both available) Use Atlassian MCP to retrieve story details:
   a. Extract the story/issue ID from `{JIRA_URL}` (e.g., S7C1-2229)
   b. Use Atlassian MCP to fetch the Jira issue details (title, description, acceptance criteria, story points if available)
   c. If the fetch succeeds, parse the Jira response to extract and store as `{STORY_CONTEXT}`:
      - Story ID and title
      - Story description
      - Acceptance criteria / requirements (as numbered list)
      - Any linked parent epic or related stories
   d. If the fetch fails for any reason, set `{STORY_CONTEXT}` = null, display a brief note (e.g., "Note: Could not fetch Jira story — story alignment will be skipped"), and continue to step 10.

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

11. For each logical block from step 10, launch a parallel Sonnet agent to analyze. **Pass the PR diff commits ({DIFF_BASE}, {DIFF_HEAD}) and `{STORY_CONTEXT}` (may be null) to each agent.**
    a. Extract code BEFORE the change:
       - Use `git show {DIFF_BASE}:{file_path}` to get original file content
       - Show 5-10 lines of relevant context around the changed area
    b. Extract code AFTER the change:
       - Use `git show {DIFF_HEAD}:{file_path}` to get new file content
       - Show the same section with changes applied
    c. Match to story requirements (only if `{STORY_CONTEXT}` is not null — otherwise skip entirely, do not infer requirements):
       - Which specific requirement from step 9 does this change address?
       - Is this a "Supporting change" not directly in requirements?
       - Is this potentially "Unrelated" (scope creep)?
    d. Provide concise analysis:
       - **Why**: 1-2 sentences explaining the technical/business reason for this change
       - **Story Alignment**: Which requirement # it addresses, or "Supporting change" — omit this row entirely if `{STORY_CONTEXT}` is null
       - **Correctness**: One of: "Correct" | "Review needed" | "Issue found"
       - **Suggestions**: Only include if there are meaningful improvements (omit if none)
    e. Keep analysis brief - aim for ~15-20 lines per block total

12. Write the changes analysis to a separate markdown file:
    a. File path: `./code-reviews/PR-{PR_NUMBER}-changes-analysis.md`
    b. Use the Changes Analysis Report format (see template below)
    c. Include:
       - PR metadata header
       - Story context section with requirements from Jira (omit this section if `{STORY_CONTEXT}` is null; instead note "No Jira story linked")
       - Changes overview table for quick scanning (omit the "Addresses" column if `{STORY_CONTEXT}` is null)
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

---

## Part 3: Browser Verification (only if `--verify` was passed)

**If `{VERIFY}` is false (parsed in the Argument Parsing section above), stop after Parts 1 and 2 have both completed — the review is complete.**

If `{VERIFY}` is true, execute the following steps after both Part 1 and Part 2 have completed successfully.

### Step 3.1 — Classify Bugs for Browser Verification

Review all issues found in Part 1 (step 6, after filtering) and classify each for browser verification eligibility:

- **Qualifies** if: confidence score >= 80 AND the bug is runtime-observable (UI rendering, API behavior, state management, network requests, user interaction behavior). Use LLM judgment to classify.
- **Does NOT qualify** if: the bug is static-only (naming conventions, code style, formatting, CLAUDE.md structural violations, missing documentation, type annotations).

For each bug that does NOT qualify, print:
```
⊘ Skipping (static-only): {brief bug description}
```

If **no bugs qualify**, print:
```
No runtime bugs to verify.
```
And stop — the review is complete. Do not proceed to Step 3.2.

### Step 3.2 — Worktree Setup

Set up a git worktree to run the PR's source branch code:

1. **Create worktree:**
   ```bash
   git worktree add .worktrees/pr-{PR_NUMBER} origin/{SOURCE_BRANCH}
   ```
   Where `{SOURCE_BRANCH}` is from Part 0.5 and `{PR_NUMBER}` is the PR ID.

2. **Read startup configuration from the project root** (NOT the worktree):
   - Read `CLAUDE.md` from the project root to find the dev server startup command (e.g., `npm run pb web:watch`).
   - Find `Properties/launchSettings.json` in the project root and read the `applicationUrl` for the profile that the startup command uses. This is the `APP_URL`.
   - **Note:** Startup config is intentionally read from the project root, not the worktree (per spec). If the dev server fails to start due to a config mismatch, check whether the PR modifies `launchSettings.json` or `CLAUDE.md` — in that case the worktree copies may differ from root and manual adjustment may be needed.

3. **Install dependencies from the worktree directory:**
   - Read `CLAUDE.md` for the install command, then run it with the worktree as the working directory.

4. **Start the dev server from the worktree directory:**
   - Run the dev server startup command in the background, with the worktree (`.worktrees/pr-{PR_NUMBER}`) as the working directory.
   - Save the process ID: `SERVER_PID=$!`

5. **Wait for the app to be healthy:**
   - Poll `APP_URL` using `curl -s -o /dev/null -w "%{http_code}" {APP_URL}` until it returns `200` (120-second timeout, poll every 3 seconds). Note: .NET/Blazor dev servers commonly take 30–90 seconds to start.
   - If curl fails with a non-zero exit code (network error, bad URL), treat it the same as a non-200 response and continue polling. Do not abort polling on a single curl failure.
   - If the app never responds, print:
     ```
     ERROR: Dev server failed to start from worktree. Skipping browser verification.
     ```
     Then jump directly to Step 3.5 (Cleanup). Do NOT touch the existing review file.

### Step 3.3 — Sequential Bug Verification

For each qualifying bug (from Step 3.1), verify it one at a time:

1. Print:
   ```
   ▶ [N/total] Verifying: {bug description}
   ```

2. Invoke the `wsbaser:verify-bug` skill, passing:
   - The bug description (from the review issue)
   - The file path and line numbers where the bug was found
   - The confidence score
   - `APP_URL` from Step 3.2
   - The `--no-start` flag (the app is already running from Step 3.2)

3. After the skill completes, print:
   ```
   ✓ [N/total] Verdict: {CONFIRMED|MITIGATED|INCONCLUSIVE}
   ```

4. Capture the report path returned by `verify-bug` (e.g., `.reports/{slug}.html`) and store it for this bug. Do NOT re-derive the slug — use the path as returned by the skill.

If `verify-bug` fails for a given bug (crashes, returns no verdict), record it as `INCONCLUSIVE` in the results table and continue to the next bug. Do not abort the verification loop on a single failure.

### Step 3.4 — Update Review File

After all bugs have been verified, use the `Edit` tool to append the following section to `./code-reviews/PR-{PR_NUMBER}-review.md` (do NOT overwrite the file). Use the report paths captured in Step 3.3 item 4:

```markdown

---

## Browser Verification

| # | Bug | Verdict | Report |
|---|-----|---------|--------|
| 1 | {bug description} | CONFIRMED | [Report](.reports/{slug}.html) |
| 2 | {bug description} | MITIGATED | [Report](.reports/{slug}.html) |
| 3 | {bug description} | INCONCLUSIVE | [Report](.reports/{slug}.html) |

**Verified:** {count} bugs | **Confirmed:** {N} | **Mitigated:** {N} | **Inconclusive:** {N}
```

### Step 3.5 — Cleanup (ALWAYS execute, even if verification failed)

This step MUST run regardless of whether Step 3.3 completed successfully, partially, or not at all.

1. **Stop the dev server** — `kill $SERVER_PID 2>/dev/null`. Kill ONLY `$SERVER_PID` captured in Step 3.2 — do not kill other processes.

2. **Remove the worktree** — remove ONLY `.worktrees/pr-{PR_NUMBER}`:
   ```bash
   git worktree remove .worktrees/pr-{PR_NUMBER} --force
   ```

3. Print:
   ```
   ════════════════════════════════════════════════════════
    Browser Verification Complete
   ════════════════════════════════════════════════════════
    Bugs verified:  {total}
    Confirmed:      {N}
    Mitigated:      {N}
    Inconclusive:   {N}
    Review updated: ./code-reviews/PR-{PR_NUMBER}-review.md
   ════════════════════════════════════════════════════════
   ```
