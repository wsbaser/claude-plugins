---
when: the topic is an Azure DevOps pull request or its review comments
---

# Azure DevOps pull request

Turns the review comment threads of one pull request into issues. Each unresolved thread becomes one issue whose `origin` is the reviewer's claim, so the decision step judges whether the claim holds.

## Fetch

When the project has its own PR skill (look through the installed skill list for one that reads Azure DevOps pull requests), use it to fetch the PR, its diff and its threads. Otherwise use the Azure CLI:

1. Find the organization, project and PR id in the PR URL (`https://dev.azure.com/<org>/<project>/_git/<repo>/pullrequest/<id>`). Pass `--org https://dev.azure.com/<org>` when it is not the CLI's default.
2. The PR: `az repos pr show --id <id> -o json`. Keep `title`, `description`, `sourceRefName`, `targetRefName`, `repository.id` and `repository.project.name`.
3. The diff: in a checkout of the repository, `git fetch origin <source branch> <target branch>`, then `git diff origin/<target branch>...origin/<source branch>`. Read every changed file in full where a thread points, not only the hunk.
4. The threads: `az devops invoke --area git --resource pullRequestThreads --route-parameters project=<project> repositoryId=<repository id> pullRequestId=<id> --api-version 7.1 -o json`.

If the CLI is not logged in or the PR cannot be reached, stop and tell the caller what failed. Do not build issues from memory or from the PR's web page text alone.

## Which threads

- A thread is unresolved when its `status` is `active` or `pending`. Resolved threads (`fixed`, `wontFix`, `closed`, `byDesign`) are skipped unless the caller asks for them.
- Skip deleted threads (`isDeleted`) and system threads, whose comments all have `commentType` `system` (votes, pushes, reviewer changes).
- Read every reply. A reply can narrow, withdraw or extend the claim; the issue states the claim as it stands at the end of the thread.

## One issue per unresolved thread

| Field | Value |
|---|---|
| `id` | The thread id, as a string. It stays stable if the review is run again after new comments. |
| `title` | One line stating what the thread asks for, in your words. Not the quote. |
| `round` | The current `review.round`. |
| `origin.quote` | The first comment's text in full. Append later replies that change the claim, each as `<author>: <text>`. |
| `origin.author` | The first comment's `author.displayName`. |
| `origin.where` | `<threadContext.filePath>:<line>`, the line from `rightFileStart.line`, or from `leftFileStart.line` for a comment on a deleted line. For a thread on the whole PR: `PR <id>`. |

`origin.verdict` and `verdictReason` are left to the decision step.

Do not add issues of your own from the diff. If you find something blocking (the change would break the build or lose data), add it as one issue with `origin: null` and say so to the owner.

## The review

- `review.id`: `pr-<id>-<two or three words from the PR title>`, lower case and kebab-case.
- `review.title`: `PR #<id> "<PR title>"`.
- Pass to the decision step, as pointers: the PR description, the diff command, and the files each thread points at.
