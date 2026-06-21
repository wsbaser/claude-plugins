---
name: wsbaser:plan-and-implement
description: Reproduces Claude Code plan mode in one session — researches read-only, presents a plan inline, gates on user approval, then implements and verifies. Use when the user wants a plan-then-build flow without a separate spec file, says "plan and implement", "plan this out and do it", "plan it then build it", or invokes /wsbaser:plan-and-implement. Supports --yolo (or "just do it", "skip approval") to skip clarifications and the approval gate.
---

Reproduce the behavior of Claude Code's built-in **plan mode** through prompt discipline alone, then carry the approved plan through to an implemented, verified change — all in a single session. You research read-only, design an approach, optionally clarify, present a plan **inline**, gate on user approval, then implement with dependency-ordered subagents and verify the result.

This skill does **not** enter the harness plan mode (no `EnterPlanMode`/`ExitPlanMode`). The read-only restraint and the approval gate are enforced by the rules below, not by the harness.

## Read-only discipline (hard rule — read this first)

During planning (Phases 1–4) you MUST NOT make any edits, run any non-readonly tools (including changing configs or making commits), or otherwise make any changes to the system until the plan is approved. This supersedes any other instructions you have received. You may take only READ-ONLY actions during planning.

Concretely: no `Edit`, `Write`, or `NotebookEdit`; no non-readonly `Bash` (no installs, no file mutation, no commits); no MCP tools that mutate state. Reading files, searching, and dispatching read-only subagents are fine. The first edit happens only **after** approval — or immediately when `--yolo` is set.

## Arguments

`/wsbaser:plan-and-implement <task> [--yolo]`

Strip `--yolo` from the arguments before processing; set `YOLO=true` when present. The remaining text is the **task**. When `YOLO=true`, Phase 3 (Review/clarify) and Phase 4.5 (approval gate) are skipped — everything else runs.

If no task text is given, infer it from the current conversation.

## Why plans should be short

Plan reject rate rises with plan size — roughly ~20% for plans under 2K characters, climbing to ~50% at 20K+. A plan the user can scan in one screen gets approved and is easier to execute faithfully. Favor short, scannable plans. When you must cut, delete prose — never file paths or verification steps.

---

## Plan Workflow

### Phase 1: Initial Understanding

Goal: Gain a comprehensive understanding of the user's request by reading through code and asking them questions. Critical: In this phase you should only use the Explore subagent type.

1. Focus on understanding the user's request and the code associated with their request. Actively search for existing functions, utilities, and patterns that can be reused — avoid proposing new code when suitable implementations already exist.

2. **Launch up to 4 Explore agents IN PARALLEL** (single message, multiple tool calls) to efficiently explore the codebase.
   - Use 1 agent when the task is isolated to known files, the user provided specific file paths, or you're making a small targeted change.
   - Use multiple agents when: the scope is uncertain, multiple areas of the codebase are involved, or you need to understand existing patterns before planning.
   - Quality over quantity — 4 agents maximum, but you should try to use the minimum number of agents necessary (usually just 1).
   - If using multiple agents: Provide each agent with a specific search focus or area to explore.

Orchestrate from the main thread — let the `Explore` subagents read the codebase and report back; don't sink the main context into wide file reads yourself. If a subagent fails to dispatch or errors out, fall back to doing the read-only exploration yourself with `Glob`/`Grep`/`Read` — staying read-only matters more than delegating.

### Phase 2: Design

Goal: Design an implementation approach.

Launch Plan agent(s) to design the implementation based on the user's intent and your exploration results from Phase 1.

You can launch up to 3 agent(s) in parallel.

**Guidelines:**
- **Default**: Launch at least 1 Plan agent for most tasks — it helps validate your understanding and consider alternatives.
- **Skip agents**: Only for truly trivial tasks (typo fixes, single-line changes, simple renames).
- **Middle ground** (a new file plus a wiring change and a test, or similar small-but-multi-file work): a Plan agent is optional — designing inline is fine when the approach is obvious from Phase 1. Spend an agent when the approach is genuinely uncertain.

In the agent prompt:
- Provide comprehensive background context from Phase 1 exploration including filenames and code path traces
- Describe requirements and constraints
- Request a detailed implementation plan

### Phase 3: Review (skipped when `--yolo`)

Goal: Review the plan(s) from Phase 2 and ensure alignment with the user's intentions.

1. Read the critical files identified by agents to deepen your understanding.
2. Ensure that the plans align with the user's original request.
3. Use `AskUserQuestion` to clarify any remaining questions with the user.

Never ask what you can find by reading code — clarifications are for genuine product/scope ambiguity, not for facts the codebase already answers.

### Phase 4: Final Plan

Present your final plan **inline** as a markdown message in the conversation — do not write it to a file.

The plan is **adaptive in length**. Choose the shape from the size of the change:

**Small tasks** (a few files, a contained change) — be terse:
- Do NOT write a Context, Background, or Overview section. The user just told you what they want.
- Do NOT restate the user's request. Do NOT write prose paragraphs.
- List the paths of files to be modified and what changes in each (one bullet per file).
- Reference existing functions to reuse, with file:line.
- End with the single verification command.
- **Hard limit: 40 lines.** If the plan is longer, delete prose — not file paths.

**Large tasks** (cross-cutting, multiple subsystems, new architecture) — fuller:
- Begin with a **Context** section: explain why this change is being made — the problem or need it addresses, what prompted it, and the intended outcome.
- Include only your recommended approach, not all alternatives.
- Ensure that the plan is concise enough to scan quickly, but detailed enough to execute effectively.
- Include the paths of critical files to be modified.
- Reference existing functions and utilities you found that should be reused, with their file paths.
- Include a verification section describing how to test the changes end-to-end (run the code, use MCP tools, run tests).

Either way, the plan must always carry: **critical file paths**, **reuse references with paths**, and a **verification section** — these survive every cut.

### Phase 4.5: Approval gate (skipped when `--yolo`)

After presenting the plan inline, request approval with a single `AskUserQuestion` call offering three options:

- **Approve & implement** — proceed to Phase 5.
- **Revise plan** — incorporate the user's feedback and re-present the plan (loop back to Phase 4, then gate again).
- **Cancel** — stop immediately, having made no edits.

This is the one deliberate inversion of plan mode: built-in plan mode reserves `AskUserQuestion` for clarifications and uses `ExitPlanMode` for approval. This skill has no `ExitPlanMode`, so the approval gate **is** the `AskUserQuestion` call. Do not ask for approval any other way (no free-text "shall I proceed?").

### Phase 5: Implement

Read-only discipline is now lifted (approved, or `--yolo`). Decompose the approved plan into tasks and execute them **dependency-ordered**:

- **Independent tasks** (touch disjoint files, no ordering constraint) → dispatch as parallel implementation subagents in a single message (at most 5 at once; sequence the rest).
- **Dependent tasks** (one needs another's output, or they touch the same file) → run sequentially, each after its prerequisites land.

Edits go into the **working tree directly** — no worktree isolation, no merge step. Give each implementation subagent the relevant slice of the plan, the exact files it owns, and the reuse references so it doesn't reinvent existing primitives.

### Phase 6: Verify & report

1. Run the plan's **verification section** — the tests, build, or commands it named. Capture pass/fail and any output that matters. If the affected package/project has a canonical gated test command (coverage thresholds, lint gates), prefer running that over a single-file run so verification reflects the real quality bar — unless the task explicitly scoped verification narrower.
2. Slugify the task (kebab-case, e.g. "Add retry to upload" → `add-retry-to-upload`; strip non-alphanumerics, truncate to ~60 chars, and append `-2`, `-3`, … if `.reports/<slug>.md` already exists) and write a markdown report to `.reports/<slug>.md` containing:
   - **What changed** — files touched and a one-line-per-file summary.
   - **The plan** — the plan you executed (this is the only place the plan is persisted).
   - **Verification** — each check run and whether it passed, with relevant output.
3. Summarize the outcome in the conversation: what was built, whether verification passed, and anything left open.

If verification fails, say so plainly with the failing output — do not report success. Fix-forward only if the fix touches a file already named in the approved plan **and** is a small change (roughly under 10 lines); anything larger or outside the plan's file set means surfacing the failure and asking how to proceed.

---

## Flow summary

```
parse args (--yolo?)
  └─ Phase 1  Understand   → parallel Explore subagents (read-only)
  └─ Phase 2  Design       → Plan subagent(s), seeded with Phase 1
  └─ Phase 3  Review       → read critical files, AskUserQuestion to clarify [skipped if --yolo]
  └─ Phase 4  Plan         → present inline, adaptive length
  └─ Phase 4.5 Approve     → AskUserQuestion (Approve/Revise/Cancel) [skipped if --yolo]
       ├─ Approve → Phase 5
       ├─ Revise  → back to Phase 4
       └─ Cancel  → stop, no edits
  └─ Phase 5  Implement    → dependency-ordered subagents, working tree
  └─ Phase 6  Verify       → run verification, write .reports/<slug>.md
```

Default is confirmation-on. `--yolo` is the documented escape hatch: Understand → Design → Plan (still presented) → Implement → Verify, straight through.
