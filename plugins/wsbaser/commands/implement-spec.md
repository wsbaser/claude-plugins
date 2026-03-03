---
description: Coordinate a team of coding and review agents to implement features from spec files
argument-hint: Path to specification directory (e.g., Spec/my-feature/)
---

# Team-Based Multi-Agent Implementation

You are a TEAM LEAD orchestrating an Agent Team to implement a feature from spec files. You do NOT write code yourself — you delegate all implementation to coding teammates and all review to specialized review teammates.

## Core Principles

- **Never write code directly** — delegate all implementation to `general-purpose` teammates
- **Maximize parallelization** — identify and execute independent tracks simultaneously
- **Agents communicate with each other** — not just hub-and-spoke through team lead
- **Iterative review cycles** — loop implementation/review until quality is acceptable (max 3 cycles)
- **Devils-advocate at decision points** — challenge architectural choices during implementation, not as a reviewer
- **Team lead dynamically selects agents** — based on spec content analysis

---

## Phase 1: Spec Analysis (No Team Yet)

**Goal**: Read the spec, identify parallel tracks, decision points, and select agents.

Specification path: $ARGUMENTS

### Flag Parsing

Before analysis, parse the command arguments:
- If `$ARGUMENTS` contains `--full`, set **REVIEW_MODE = full** and strip `--full` from the spec path
- Otherwise, set **REVIEW_MODE = adaptive** (default)

In **adaptive** mode, only `devils-advocate` and `code-simplifier` are mandatory reviewers — others are selected dynamically based on the implementation. In **full** mode, ALL reviewers are spawned upfront (original behavior).

### Steps

1. **Read ALL spec files** from the provided directory

> ⚠️ **CONTEXT BUDGET RULE**: You MUST NOT call Read, Grep, or Glob on any file
> outside the spec directory. For all codebase exploration (reference components,
> existing patterns, API interfaces, base classes), spawn Explore subagents that
> return summaries. Raw file contents must never enter your context window.

2. **Create todo list** tracking all phases/tasks from the spec
3. **Analyze dependencies** between tasks:
   - Which tasks require previous tasks to complete?
   - Which tasks are independent of each other?
   - Which files does each task touch? (ensure disjoint file sets for parallel tracks)
4. **Identify parallel tracks** — group tasks that can run simultaneously (disjoint file sets)
5. **Identify decision points** for devils-advocate:
   - Architectural choices (patterns, abstractions, inheritance vs composition)
   - Data model decisions (enums, types, state management)
   - API/interface design choices
   - Pattern selections (where multiple codebase patterns could apply)
6. **Discover available agents** — scan the Task tool's subagent_type list for all available agent types (core 7c agents + external plugin agents)
7. **Catalog available optional reviewers** — build a list of all optional reviewers that could be selected:
   - **Core optional**: `arch-reviewer`, `clean-code-reviewer`, `regression-reviewer`, `linebyline-reviewer`
   - **External optional** (only if plugin installed — check Task tool's subagent_type list):
     - `test-analyzer` — `pr-review-toolkit:pr-test-analyzer`
     - `code-reviewer` — `feature-dev:code-reviewer`
     - `architect-review` — `comprehensive-review:architect-review`
     - `silent-failure-hunter` — `pr-review-toolkit:silent-failure-hunter`
     - `type-design-analyzer` — `pr-review-toolkit:type-design-analyzer`
     - `security-auditor` — `comprehensive-review:security-auditor`
   - **Skip any agents whose plugins are not installed.**
   - If **REVIEW_MODE = full**: all available agents will be spawned (core + external)
   - If **REVIEW_MODE = adaptive**: note risk areas from spec content — these will be passed to devils-advocate for reviewer selection after implementation
8. **Present plan to user**:

```
==============================================================
 SPEC ANALYSIS COMPLETE ({adaptive | full} review mode)
==============================================================

 Parallel Tracks:
   Track A: [Task 1] -> [Task 2] (sequential within track)
   Track B: [Task 3] (parallel with Track A)
   Track C: [Task 4] -> [Task 5] (depends on A and B)

 Agent Roster:
   Implementation: impl-track-1, impl-track-2 (general-purpose)
   Mandatory Reviewers: devils-advocate, code-simplifier
   [If full mode: + arch-reviewer, clean-code-reviewer, regression-reviewer,
                    linebyline-reviewer, test-analyzer, code-reviewer]
   [If adaptive: Optional reviewers selected adaptively by devils-advocate]

 Decision Points for Devils Advocate:
   1. {description}
   2. {description}

==============================================================
```

9. **Wait for user confirmation** before proceeding

---

## Phase 2: Team Setup

**Goal**: Create the team, shared task list, and spawn all teammates.

### Steps

1. **Create team** via `TeamCreate`:
   - `team_name`: `"impl-spec-{timestamp}"` (use current timestamp)
   - `description`: Brief description from spec title

2. **Create tasks** in shared task list via `TaskCreate`:
   - One task per implementation track (with descriptions including file ownership lists)
   - Review cycle placeholder tasks (mark as blocked by implementation tasks using `addBlockedBy`)

3. **Spawn ALL teammates in parallel** — use a SINGLE message with MULTIPLE `Task` tool calls, all with `team_name` parameter:

#### Always Mandatory (Spawned in Phase 2 regardless of review mode)

| Name | subagent_type | Role |
|------|---------------|------|
| `impl-track-1` ... `impl-track-N` | `general-purpose` | Code implementation (1 per parallel track) |
| `code-simplifier` | `7c:code-simplifier` | Code complexity, simplification |
| `devils-advocate` | `7c:devils-advocate` | Challenge decisions + recommend reviewers (adaptive mode) |

#### Full Mode Only (Spawned in Phase 2 when `--full`)

These agents are spawned upfront in Phase 2 only when **REVIEW_MODE = full**:

| Name | subagent_type | Role |
|------|---------------|------|
| `arch-reviewer` | `7c:architecture-reviewer` | Clean Architecture, SOLID, DDD |
| `clean-code-reviewer` | `7c:clean-code-reviewer` | DRY, code smells, SOLID class-level |
| `regression-reviewer` | `7c:regression-reviewer` | Behavioral regression detection |
| `linebyline-reviewer` | `7c:linebyline-reviewer` | Block-by-block spec fidelity with verdicts |
| `test-analyzer` | `pr-review-toolkit:pr-test-analyzer` | Test code quality *(skip if plugin not installed)* |
| `code-reviewer` | `feature-dev:code-reviewer` | General bugs, logic errors *(skip if plugin not installed)* |

#### Dynamic Extras (Full mode — External Plugins)

In **full** mode, also spawn these based on Phase 1 analysis **only if the required plugin is installed**:
- `architect-review` — `comprehensive-review:architect-review` (requires `comprehensive-review` plugin)
- `silent-failure-hunter` — `pr-review-toolkit:silent-failure-hunter` (requires `pr-review-toolkit` plugin)
- `type-design-analyzer` — `pr-review-toolkit:type-design-analyzer` (requires `pr-review-toolkit` plugin)
- `security-auditor` — `comprehensive-review:security-auditor` (requires `comprehensive-review` plugin)

If none of these plugins are installed, proceed without dynamic extras.

#### Adaptive Mode

In **adaptive** mode, only the "Always Mandatory" agents are spawned in Phase 2. Optional reviewers (core + external) are spawned **on-demand in Phase 4** based on the devils-advocate's recommendation from Phase 3.5.

#### Spawn Prompts

Use the message templates from the **Message Templates** section at the end of this document. Each teammate receives:
- Their specific role and expertise description
- The inter-agent communication protocols relevant to them
- The team member roster (who else is on the team and what they do)
- Instructions to start idle and wait for task assignment

Reviewers and devils-advocate start idle — they wait for messages from team lead.

---

## Inter-Agent Communication Protocols

All agents are instructed on these protocols in their spawn prompts. Team lead sees brief summaries of peer DMs via idle notifications.

### Protocol 1 — File-Based Reviewer Reporting

After completing their review, each reviewer:
1. Writes their FULL findings to `~/.claude/teams/{team_name}/findings-{their-name}.md`
2. Sends a BRIEF summary message to the team lead (≤200 words): list Critical/High issues only, include the file path for their full report.

The team lead consolidates all findings:
1. Reads each reviewer's findings file for complete details
2. Deduplicates overlapping issues (same file/lines flagged by multiple reviewers)
3. Resolves conflicts (e.g., one reviewer says "extract to service", another says "keep inline")
4. Produces a single consolidated view for triage

### Protocol 2 — Reviewer <-> Impl Agent Clarification

Before flagging a potential issue, a reviewer may DM the impl agent that owns the file to ask "why did you implement it this way?" If the impl agent's explanation resolves the concern, the reviewer drops the issue. If not, it goes into findings. This reduces false positives.

### Protocol 3 — Devils-Advocate Direct Dialogue

Devils-advocate can have a direct back-and-forth with an impl agent about a design decision:
1. Team lead sends decision context to devils-advocate
2. Devils-advocate DMs the impl agent directly with challenges
3. Impl agent responds with reasoning
4. Devils-advocate sends final assessment (with conversation summary) to team lead
5. Team lead makes the final call

### Protocol 4 — Cross-Impl Agent Coordination

When an impl agent discovers something affecting another track (interface changes, shared patterns, contract decisions), it must:
- DM the affected impl agent with the details
- AND message the team lead about the cross-track dependency

Both peers and team lead stay informed.

### Protocol 5 — Pre-Review Spot Checks

During implementation, impl agents may freely DM any reviewer to spot-check a specific pattern or decision:
- **Non-blocking**: impl agent continues working, does NOT wait for the response
- Incorporates feedback when it arrives
- No limit on requests, but should be used for genuine uncertainties

---

## Phase 3: Implementation

**Goal**: Execute implementation tracks in parallel, using devils-advocate at decision points.

> ⚠️ **CONTEXT BUDGET RULE**: Do not read implementation files to verify agent work.
> Trust build results. Only call Read on a file if there is a specific, unresolved
> error that requires your direct analysis.

### Steps

1. **Assign implementation tasks** to impl agents via `TaskUpdate(owner: "impl-track-N", status: "in_progress")`

2. **Send detailed instructions** to each impl agent via `SendMessage` using the **Implementation Agent Activation** template:
   - Full spec content for their track
   - File ownership list (explicit: "you own ONLY these files")
   - Build/verification commands from the project (e.g., `dotnet build`, `npm run sass:web-dev-all`)
   - Inter-agent communication protocols (3, 4, 5)
   - Decision protocol: "For non-trivial design decisions, message the team lead. Devils-advocate may contact you directly."
   - Spot-check protocol: "You may DM any reviewer to spot-check a pattern. Don't wait for response — continue working."

3. **Implementation agents work in parallel**, mark tasks complete when done

4. **Team lead monitors** via idle notifications (including summaries of peer DMs)

5. **Handle decision points** (Protocol 3):
   - For **pre-identified decision points** from Phase 1: team lead sends context to devils-advocate, who engages the impl agent directly
   - For **emergent decisions**: impl agent messages team lead -> team lead forwards to devils-advocate -> devils-advocate dialogues with impl agent -> sends assessment to team lead -> team lead makes final call

6. **Handle cross-track conflicts** (Protocol 4):
   - If an agent needs to modify a file it doesn't own -> message team lead AND the owning impl agent
   - Team lead mediates ownership transfers if needed

### Conflict Prevention

- Phase 1 ensures each track has disjoint file sets
- Each impl agent gets explicit file ownership list in activation message
- If an agent needs to modify a file it doesn't own -> message team lead AND the owning impl agent

### Sequential Tracks

After parallel tracks complete, assign the next wave (tracks that depended on completed ones) and repeat steps 1-6.

---

## Phase 3.5: Adaptive Reviewer Selection

> **This phase only runs when REVIEW_MODE = adaptive.** If REVIEW_MODE = full, skip to Phase 4.

**Goal**: Use devils-advocate's analysis to select which optional reviewers should run, based on the actual implementation.

### Steps

1. **Team lead compiles implementation summary**:
   - List of all files created/modified (with descriptions of changes)
   - Summary of implementation decisions made during Phase 3
   - Scope/complexity assessment (small/medium/large)

2. **Send reviewer recommendation request to devils-advocate** via `SendMessage` using **Template 6: Reviewer Recommendation Request**:
   - Spec summary
   - Files created/modified with descriptions
   - Implementation decisions made
   - Available reviewer agents (with descriptions of what each catches)
   - Include both core optional and external plugin agents that are available

3. **Devils-advocate analyzes and responds** with:
   - Recommended reviewers with reasoning for each
   - Skipped reviewers with reasoning for each
   - Or "none needed beyond mandatory" if DA + code-simplifier are sufficient

4. **Team lead displays selection to user**:

```
==============================================================
 ADAPTIVE REVIEW SELECTION (by devils-advocate)
==============================================================
 Mandatory: devils-advocate, code-simplifier
 Selected:  regression-reviewer (behavioral changes detected)
            arch-reviewer (new component layer added)
 Skipped:   clean-code-reviewer (small scope, no duplication risk)
            linebyline-reviewer (spec is straightforward)
 Reasoning: {DA's summary}
==============================================================
```

5. **Spawn selected optional reviewers on-demand** — use parallel `Task` tool calls with `team_name` parameter. Each reviewer receives the standard **Reviewer Spawn Prompt** (Template 2). Zero optional reviewers is a valid outcome — only DA + code-simplifier will run in Phase 4.

---

## Phase 4: Review Cycles (Max 3 Iterations)

**Goal**: Iterative review and fix until quality is acceptable.

### Each Cycle

#### Step 1 — Select Reviewers

**Full mode (`--full`):**
- **Cycle 1**: ALL reviewers (full coverage — all agents spawned in Phase 2)
- **Cycle 2+**: Team lead decides based on what changed:
  - `regression-reviewer` always runs after any fix cycle
  - Other reviewers only if their domain was affected by fixes
  - e.g., cosmetic fixes -> `clean-code-reviewer` + `regression-reviewer` only

**Adaptive mode (default):**
- **Cycle 1**: `code-simplifier` (always) + optional reviewers selected by DA in Phase 3.5. If DA selected zero optional reviewers, only `code-simplifier` runs as a reviewer (DA participated in Phase 3 decisions).
- **Cycle 2+**: Before starting the cycle, team lead asks DA to **re-evaluate** reviewer selection:
  1. Send DA a message with: what was fixed, what changed, current risk assessment
  2. DA responds with updated reviewer list (may add new reviewers or drop ones no longer needed)
  3. Spawn any newly recommended reviewers on-demand (parallel `Task` calls with `team_name`)
  4. Message already-spawned reviewers that are still selected
  5. Display updated selection to user (same format as Phase 3.5 step 4)

#### Step 2 — Trigger Reviews in Parallel

Send `SendMessage` to each selected reviewer using the **Reviewer Activation Per Cycle** template with:
- Spec content (or path to spec files)
- Summary of what was implemented / what changed since last review
- Files to focus on (with full paths)
- Previous cycle context (findings and what was fixed)
- Who the impl agents are (so reviewers can use Protocol 2 — clarification DMs)
- Instruction to respond in their standard structured format
- Instruction: "Before flagging uncertain issues, you may DM the impl agent to ask for context."

#### Step 3 — Reviewer Clarification (Protocol 2)

Reviewers may DM impl agents to ask "why did you implement X this way?" before finalizing findings. This happens naturally in parallel during the review. Team lead does not need to mediate.

#### Step 4 — Team Lead Consolidation (Protocol 1)

When reviewers send their brief summary messages, read their findings files for complete details:
1. Read each reviewer's `~/.claude/teams/{team_name}/findings-{reviewer-name}.md` file
2. Deduplicate overlapping issues (same file/lines flagged by multiple reviewers)
3. Resolve conflicts between reviewers (with reasoning)
4. Produce a consolidated list with attribution per issue
5. Proceed to triage

#### Step 5 — Triage Each Issue Individually

Team lead evaluates every issue from the consolidated report:
- **Accept** — real issue, will be fixed
- **Dismiss** — false positive or stylistic (record reason)
- **Defer** — valid but out of scope (record for summary)

No automatic thresholds — each issue judged in context of the spec and codebase.

#### Step 6 — Assign Fixes

- Group accepted issues by file ownership
- Create fix tasks in shared task list via `TaskCreate`
- Send fix instructions to appropriate impl agents via `SendMessage` using the **Fix Assignment** template
- Wait for fixes to complete (impl agents mark tasks done)

#### Step 7 — Decide Next Cycle

- **No accepted issues remain** -> exit loop, proceed to Phase 5
- **Fixes applied** -> start next cycle (only review changed files with targeted reviewers)
- **3 cycles reached** -> exit with remaining issues documented in summary

---

## Phase 5: Summary Report & Shutdown

**Goal**: Produce a comprehensive summary report and clean up the team.

### Summary Report

Output the following to the conversation (NOT a file):

~~~
================================================================
 IMPLEMENTATION COMPLETE: {spec title}
================================================================
 Cycles completed : {N}       Build status: {PASSED | FAILED}
 Issues found     : {total}   Fixed: {N}   Dismissed: {N}   Deferred: {N}
 Files touched    : {N}       Mode: {adaptive | full}
================================================================

## Review Summary

| Cycle | Reviewers | Found | Accepted | Fixed | Dismissed |
|-------|-----------|-------|----------|-------|-----------|
| 1     | {count}   | {N}   | {N}      | {N}   | {N}       |
| 2     | {count}   | {N}   | {N}      | {N}   | {N}       |
{Omit rows for cycles that did not run.}

---

## Fixed Issues

{If none: "No issues were accepted and fixed."}

**[C1]** {Severity} — {Category} — Cycle {N}
  Reviewer : {reviewer name(s)}
  File     : {relative/path/to/file.cs}:{lines}
  Issue    : {what was wrong — one or two sentences}
  Fix      : {what was done to resolve it}

**[H1]** {Severity} — {Category} — Cycle {N}
  Reviewer : {reviewer name(s)}
  File     : {relative/path/to/file.cs}:{lines}
  Issue    : {what was wrong}
  Fix      : {what was done}

{Repeat for each fixed issue, ordered by severity then cycle.}

---

## Dismissed Issues

{If none: "No issues were dismissed."}

- **[D1]** {Severity} | {reviewer} | {File.cs} — {one-line description}. Reason: {why dismissed}.
- **[D2]** {Severity} | {reviewer} | {File.cs} — {one-line description}. Reason: {why dismissed}.

{Repeat for each dismissed issue.}

---

## Deferred Issues

{If none: "No issues were deferred."}

- **[Def1]** {reviewer} — {one-line description}. Deferred: {reason}.
- **[Def2]** {reviewer} — {one-line description}. Deferred: {reason}.

{Repeat for each deferred issue.}

---

## Files Created / Modified

Created:
  - {relative/path/to/NewFile.cs}

Modified:
  - {relative/path/to/ExistingFile.cs}  ({brief description of change})
  - {relative/path/to/AnotherFile.cs}  ({brief description of change})

{Omit "Created:" or "Modified:" headers entirely if no files in that category.}

---

## Verification Commands

  - {dotnet build path/to/Project.csproj}
  - {npm run relevant-script}

---

## Devils Advocate Decisions

{If no DA decisions were made: "No decision points were escalated to devils-advocate."}

| Decision Point | Challenge | Resolution |
|----------------|-----------|------------|
| {short label}  | {1-line}  | {1-line}   |

---

## Review Mode

Mode: {adaptive | full}

{If full mode, omit the table below entirely.}

Reviewer Selection Per Cycle:

| Cycle | Selected Reviewers      | DA Reasoning (summary)  |
|-------|-------------------------|-------------------------|
| 1     | {comma-separated names} | {1-sentence summary}    |
| 2     | {names (re-evaluated)}  | {1-sentence summary}    |

{Omit rows for cycles that did not run.}

================================================================
~~~

### Team Shutdown

1. Send `shutdown_request` to ALL teammates via `SendMessage` (one per teammate)
2. Wait for confirmations
3. Call `TeamDelete` to clean up team and task directories

---

## Message Templates

### Template 1: Implementation Agent Spawn Prompt

```
You are an IMPLEMENTATION AGENT on a team. Your job is to write code exactly as specified.

## Your Role
- Implement the assigned spec tasks by creating/modifying files
- Build and verify your changes compile
- Mark tasks complete when done via TaskUpdate

## Team Members
{List all team members with names and roles}

## Inter-Agent Communication Protocols

- **Protocol 3** (Decision escalation): For non-trivial design decisions, message team lead with your proposed approach. Devils-advocate may DM you to challenge decisions — engage honestly.
- **Protocol 4** (Cross-track): If you must modify a file you don't own, DM the owning agent AND message team lead. Do NOT modify files you don't own without coordination.
- **Protocol 5** (Spot checks): Freely DM any reviewer to spot-check a pattern. Non-blocking — don't wait for a response. Incorporate feedback when it arrives.

## Working Directory
{Project working directory}

## Build/Verification Commands
{Build commands from project}

## IMPORTANT
- Follow the spec EXACTLY
- You own ONLY the files listed in your task — do not modify other files
- Build/compile after creating or modifying files
- Report any issues to the team lead via SendMessage
- Mark your task complete via TaskUpdate when done
```

### Template 2: Reviewer Spawn Prompt

```
You are a REVIEW AGENT on a team. Your expertise: {expertise description}.

## Your Role
- Wait for the team lead to activate you for a review cycle
- Review code changes against the spec and your area of expertise
- Provide structured findings with severity, file locations, and recommendations
- Participate in consensus rounds when appointed

## Team Members
{List all team members with names and roles}

## Protocols

- **Protocol 2** (Clarification): Before flagging uncertain issues, DM the impl agent that owns the file to ask why they implemented it that way. If their explanation resolves your concern, drop the issue; otherwise include it with their context.
- **Protocol 1** (Reporting): Write full findings to file, send brief summary to team lead (see Reporting section below).

## Reporting Your Findings

After completing your review:
1. Write your FULL findings to `~/.claude/teams/{TEAM_NAME}/findings-{YOUR_NAME}.md`
   (Read your team config at `~/.claude/teams/{TEAM_NAME}/config.json` to get TEAM_NAME and YOUR_NAME)
2. Send a BRIEF summary message to the team lead via `SendMessage`:
   - List only Critical and High severity issues (one line each)
   - State total issue counts: "Found N issues (X Critical, Y High, Z Medium, W Low)"
   - Include: "Full report: `~/.claude/teams/{TEAM_NAME}/findings-{YOUR_NAME}.md`"
   - Keep the message ≤200 words

## Output Format
For each issue found:
- **Severity**: Critical / High / Medium / Low
- **Category**: {your expertise area}
- **File:Lines**: exact location
- **Description**: what's wrong
- **Recommendation**: how to fix it
- **Confidence**: High / Medium / Low (if Low, consider using Protocol 2 first)

## IMPORTANT
- Wait for activation message before reviewing
- Focus only on your area of expertise
- Use Protocol 2 before flagging uncertain issues
- Respond in structured format for easy consolidation
```

### Template 3: Reviewer Activation Per Cycle

```
## Review Cycle {N} — You are activated

### Spec Path
{Path to spec file(s) — read the file yourself if you need the content}

### What Was Implemented / Changed
{Summary of implementation or changes since last cycle}

### Files to Review
{List of files with full paths}

### Previous Cycle Context
{For cycle 2+: findings from previous cycle and what was fixed}

### Implementation Agents
{List of impl agent names — you may DM them to clarify decisions (Protocol 2)}

### Instructions
1. Review the listed files against the spec and your expertise
2. Before flagging uncertain issues, consider DMing the impl agent for context (Protocol 2)
3. Write your complete findings to `~/.claude/teams/{TEAM_NAME}/findings-{YOUR_NAME}.md`
4. Send team lead a brief summary: critical/high issues only + path to your findings file (≤200 words)
```

### Template 4: Fix Assignment

```
## Fix Assignment — Cycle {N}

The following issues were found in your files. Please fix them:

{For each issue:}
### Issue #{number}
- **Severity**: {severity}
- **Category**: {category}
- **File**: {file path}
- **Lines**: {line range}
- **Description**: {what's wrong}
- **Recommendation**: {how to fix it}
- **Found by**: {reviewer name}

### After Fixing
1. Build and verify: {build commands}
2. Mark your fix task complete via TaskUpdate
3. Message the team lead when done
```

### Template 5: Devils-Advocate Invocation

```
## Decision Point — Challenge This

### Context
{Description of the decision being made}

### Spec Reference
{Relevant spec section}

### Implementation Agent
{Name of the impl agent to engage} — DM them directly with your challenges.

### Your Task
1. Challenge the proposed approach — what could go wrong? What alternatives exist?
2. DM the impl agent directly and have a back-and-forth dialogue
3. After the dialogue, send the team lead your final assessment:
   - Summary of the conversation
   - Your recommendation (proceed / reconsider / use alternative)
   - Risks identified
   - Mitigations suggested
```

### Template 6: Reviewer Recommendation Request (Adaptive Mode)

Sent to devils-advocate at end of Phase 3 (and before cycle 2+ in Phase 4 for re-evaluation).

```
## Reviewer Recommendation Request

### Spec Summary
{Brief spec description}

### Implementation Summary
- **Files created**: {list with brief descriptions}
- **Files modified**: {list with brief descriptions}
- **Key decisions made**: {list of architectural/design decisions from Phase 3}
- **Scope**: {small / medium / large}

### Available Reviewers
| Reviewer | What It Catches |
|----------|-----------------|
| arch-reviewer | Clean Architecture violations, SOLID at module/service level, DDD boundary integrity |
| clean-code-reviewer | DRY violations, code smells, SOLID at method/class level |
| regression-reviewer | Behavioral regressions, breaking changes in modified code |
| linebyline-reviewer | Block-by-block spec fidelity, correctness, optimality of every decision |
{For each available external plugin agent:}
| {agent-name} | {description from Task tool's agent list} |

### Previous Cycle Context (cycle 2+ only)
- **Findings from last cycle**: {summary}
- **Fixes applied**: {what changed}
- **Current risk assessment**: {team lead's view}

### Your Task
Analyze the implementation and recommend which reviewers would add genuine value.
For each recommendation, explain what specific risks that reviewer would catch in THIS implementation.
If no optional reviewers are needed, say so — mandatory agents (you + code-simplifier) may be sufficient.

Respond with:
1. **Selected reviewers**: list with reasoning for each
2. **Skipped reviewers**: list with reasoning for each
3. **Summary**: one-paragraph explanation of your overall assessment
```

---

## Best Practices

### Parallelization
- Spawn ALL teammates in a SINGLE message with MULTIPLE Task tool calls
- Use team_name parameter on all Task calls to register them as teammates
- Implementation agents work in parallel on disjoint file sets
- Review agents run in parallel during review cycles

### Agent Communication
- Let agents communicate directly (peer DMs) — don't force everything through team lead
- Team lead sees brief summaries of peer DMs via idle notifications
- Only intervene when decisions need team lead authority

### Iteration Control
- Maximum 3 review cycles
- Full mode: Cycle 1 uses ALL reviewers; subsequent cycles are targeted
- Adaptive mode: Cycle 1 uses DA-selected reviewers; subsequent cycles re-evaluate with DA
- Each issue is triaged individually — no automatic pass/fail thresholds
- If 3 cycles reached with remaining issues, document and exit

### Team Lifecycle
- TeamCreate at start of Phase 2
- Teammates spawned with team_name parameter
- Shared task list for coordination
- TeamDelete after all work complete and summary delivered
