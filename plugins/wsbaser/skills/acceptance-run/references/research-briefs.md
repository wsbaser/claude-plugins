# Research briefs

Briefs for the parallel read-only agents in step 3. Fill in the angle brackets. Each agent reports facts with `file:line`, quotes UI and error strings exactly, and edits nothing.

## Contents
- Locating the implementation (all slices)
- Frontend brief
- Backend brief
- Reading a branch or PR without checking it out

## Locating the implementation

Before the deep briefs, find where the work is. In each repo from the project config (frontend, backend, others):

```bash
git -C <repo> fetch --quiet
git -C <repo> log --all --oneline -i --grep="<KEY>" --grep="<SUB-KEY-1>" --grep="<SUB-KEY-2>"
git -C <repo> branch -a --list "*<number>*"
```

Commit messages are not enough: work often reaches the default branch through a different PR (cherry-pick, merge of a sibling branch). For every feature branch found, also compare content:

```bash
git -C <repo> diff --stat origin/<default>...<branch>   # what the branch adds
git -C <repo> diff --stat <branch> origin/<default> -- <files the branch touched>   # empty = already on default
```

For each repo record: merged to the default branch (merge commit + PR number) or only on a branch, and the files the commits touched (`git show --stat <sha>`). A repo with no commits is not part of the slice. If the user named a branch or PR, use that as the source of truth for its repo.

## Frontend brief

> Repo: `<FE repo path>`. Feature: `<KEY> <title>` — `<one-paragraph summary of the ACs>`. Code is on `<default branch | branch name>`; read a branch with `git show <branch>:<path>` and `git grep <pattern> <branch>`, never check it out.
>
> I am writing a manual acceptance test. Report, with `file:line`:
> 1. Route and navigation path (exact menu labels as the user sees them, from the translation files) to every screen involved, and to the screens that create the data the test needs.
> 2. Every user-visible string on those screens that a tester checks: field labels, buttons, empty states, hints, tooltips, confirmation dialogs, validation and error messages (exact English text).
> 3. Behaviour that is not obvious from the screen: what is disabled when, defaults, what happens on save, undo, cancel, unsaved-change prompts.
> 4. Which API endpoints each action calls (method, path, request shape).
> 5. Anything the ticket asks for that the screens do not do, or do differently.
> Keep it concise; quote strings exactly.

## Backend brief

> Repo: `<BE repo path>`. Feature: `<KEY> <title>` — `<summary>`. Code is on `<default branch | branch name>`; read a branch with `git show`/`git grep`, never check it out.
>
> I am explaining to a tester what happens server-side at each step. Report, with `file:line`:
> 1. Endpoints: method, route, required roles, request and response fields.
> 2. Validation rules with their exact error codes and messages.
> 3. Business logic: the algorithm, its inputs, fallbacks, and what it writes (tables, ledger or journal entries, events, emails).
> 4. Persistence: tables and columns, migrations, and what a migration does to existing data.
> 5. Timing: anything asynchronous (events, queues, background jobs) and when the result becomes visible.
> 6. Anything the ticket asks for that the code does differently (state the ticket rule and the code rule side by side).
> Keep it concise.

## Reading a branch or PR without checking it out

```bash
git show <branch>:<path>              # one file as it is on the branch
git grep -n "<pattern>" <branch>      # search the branch
git diff <default>...<branch> --stat  # what the branch changes
```

For an Azure DevOps or GitHub PR, resolve it to its source branch first (`az repos pr show --id <n>` / `gh pr view <n> --json headRefName`).
