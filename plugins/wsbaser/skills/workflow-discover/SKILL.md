---
name: wsbaser:workflow-discover
description: Analyzes a GitHub repo URL or local directory for Claude Code skills, assesses each skill in parallel, ranks viable Ask Jenny multi-stage workflow candidates by pipeline coherence, and launches wsbaser:workflow-design on the user's selection. Use this skill whenever the user wants to explore what Ask Jenny workflows are possible from a skill library, says "what workflows can I build from these skills", provides a GitHub URL or local skill directory to discover from, or wants to combine skills into a workflow without knowing which ones to pick.
---

# Workflow Discover

Discover skills from a source, analyze them in parallel, and surface ranked multi-stage workflow candidates for the user to choose from. After the user selects a candidate, launch `wsbaser:workflow-design` to build the YAML.

## Step 1 — Identify Source and Discover Skills

The argument is either a GitHub repo URL or a local directory path.

### GitHub URL (starts with `https://github.com/`)

Extract `{owner}` and `{repo}` from the URL, then fetch the repository file tree:

```bash
# Option A: gh CLI (preferred)
gh api "repos/{owner}/{repo}/git/trees/HEAD?recursive=1" --jq '.tree[] | select(.path | endswith("SKILL.md")) | .path'
```

If `gh` is unavailable or unauthenticated, use WebFetch:
```
GET https://api.github.com/repos/{owner}/{repo}/git/trees/HEAD?recursive=1
```
Parse the `tree` array for entries where `.path` ends in `SKILL.md`.

For each discovered path, fetch the file content via WebFetch:
```
https://raw.githubusercontent.com/{owner}/{repo}/HEAD/{path}
```

A skill is any path of the form `{skill-name}/SKILL.md` (a subdirectory containing a `SKILL.md`). Collect the skill name (the directory name) and its SKILL.md content.

### Local Directory Path

Glob for `**/SKILL.md` within the given directory. Each match's parent directory is a skill. Read each SKILL.md with the Read tool.

## Step 2 — Analyze All Skills in Parallel

Launch **one subagent per skill** using the Agent tool. Launch all subagents in a **single message** — do not wait between them.

**Subagent prompt for each skill** (substitute the actual SKILL.md content):

```
Read the SKILL.md content below and return ONLY a JSON object — no explanation, no markdown, just the JSON.

--- SKILL.MD ---
{full SKILL.md content}
--- END ---

Return this exact structure:
{
  "skillName": "string — the name field from frontmatter (e.g. 'wsbaser:interview')",
  "description": "string — the description field from frontmatter",
  "role": "SPEC | BUILD | TEST | CONVERSATIONAL",
  "naturalOutput": "string — e.g. 'spec.md file', 'code changes', 'test results', 'none'",
  "artifactPath": "string or null — file path pattern if the skill writes a file, e.g. '.ask-jenny/features/{{featureId}}/spec.md'; null if no file is produced",
  "expects": "string — what input this stage needs, e.g. 'feature description' or 'artifact from SPEC stage (spec.md)'",
  "rationale": "string — one sentence explaining the role inference"
}

Role inference rules:
- SPEC: the skill writes a .md spec, plan, RFC, or structured report to disk as its primary output
- BUILD: the skill modifies source files, implements code, makes code changes
- TEST: the skill runs tests, verifies behavior, or checks assertions and reports pass/fail
- CONVERSATIONAL: the skill produces no file by default; it is question-based or purely conversational
```

Collect all JSON responses before proceeding.

## Step 3 — Synthesize Workflow Candidates

Find combinations of 2–5 skills that form coherent pipelines. Aim for 3–5 candidates (fewer if the skill set is small).

**Valid pipeline patterns and scores:**

| Pattern | Example | Score |
|---|---|---|
| SPEC → BUILD → TEST | interview → implement-spec → verify-feature | 8 |
| SPEC → BUILD → TEST → TEST | ... → verify-feature + verify-union | 7 |
| SPEC → SPEC → BUILD | grill-me → interview → implement-spec | 6 |
| SPEC → BUILD | interview → implement-spec | 5 |
| BUILD → TEST | implement-spec → verify-feature | 4 |
| CONVERSATIONAL → SPEC → BUILD | grill-me → interview → implement-spec | 4 |

**Score adjustments:**
- +2 if the SPEC stage's `artifactPath` is plausibly consumed by the following BUILD stage
- +2 if a TEST stage can loop back to a preceding BUILD stage
- −1 per CONVERSATIONAL skill included (requires forced file output)

Duplicate pipelines with alternative TEST stages as same-score candidates (e.g., one with `verify-feature`, another with `verify-union`).

For each candidate, build:
```
name: "Descriptive Workflow Name"
rationale: "One sentence explaining why these skills work together."
score: 8
stages:
  - skill: wsbaser:interview
    role: SPEC
    flow: "→ spec.md → consumed by implement-spec"
  - skill: wsbaser:implement-spec
    role: BUILD
    flow: "→ code changes → terminal"
  - skill: wsbaser:verify-feature
    role: TEST
    flow: "→ verify-report.md (loops to implement-spec on failure)"
```

Sort candidates by score descending.

## Step 4 — Present Candidates to User

Format the candidates as a numbered list and ask the user to choose via `AskUserQuestion`:

```
I analyzed {N} skills and found {X} workflow candidates:

1. **{Workflow Name}** (score: {N})
   {Rationale}
   {skill-a} [{ROLE}] → {artifact} → {skill-b} [{ROLE}] → {artifact} → {skill-c} [{ROLE}]

2. **{Workflow Name}** (score: {N})
   ...

Which workflow would you like to build? Enter a number (1–{X}), or "none" to cancel.
```

Use `AskUserQuestion` with the numbered options as choices.

## Step 5 — Prepare Skill Paths for Workflow Design

Before launching `wsbaser:workflow-design`, resolve file paths for the selected workflow's skills:

- **Local source**: use the original `SKILL.md` file paths (e.g., `/path/to/skills/interview/SKILL.md`)
- **GitHub source**: write each selected skill's fetched SKILL.md content to a temp file:
  ```
  /tmp/workflow-discover/{skill-name}/SKILL.md
  ```
  Use the Write tool for each file.

## Step 6 — Launch Workflow Design

Immediately invoke `wsbaser:workflow-design`, passing the selected workflow's SKILL.md paths in pipeline order:

```
Skill("wsbaser:workflow-design", args: "{path1} {path2} {path3}")
```

For example:
```
Skill("wsbaser:workflow-design", args: "/path/to/interview/SKILL.md /path/to/implement-spec/SKILL.md /path/to/verify-feature/SKILL.md")
```

Do not exit until `wsbaser:workflow-design` has been launched.
