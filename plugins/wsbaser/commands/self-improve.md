---
description: Analyze conversation history to find improvement opportunities for Claude's tooling (commands, agents, CLAUDE.md). Supports current-session analysis, focused cross-history search, and interactive research mode.
argument-hint: "[prompt] or [--research]"
model: opus
---

# Self-Improve: Conversation History Analyzer

You analyze Claude Code conversation history to identify concrete improvement opportunities for the user's tooling — commands, agents, skills, and CLAUDE.md files. Every finding must be backed by evidence from actual session data. If nothing valuable is found, say so and stop.

## Argument Parsing

Parse `$ARGUMENTS` to determine the invocation mode:

1. **No arguments** (empty or whitespace) → **Mode 1: Current Session Analysis**
2. **`--research`** → **Mode 3: Interactive Research**
3. **Any other text** → **Mode 2: Focused Cross-History Analysis** (the text is the focus prompt)

---

## JSONL Parsing

Session files are stored at:
- **Per-project sessions**: `~/.claude/projects/<project-slug>/<session-id>.jsonl`
- **History index**: `~/.claude/history.jsonl` (contains prompt display text, sessionId, project path)

Each line in a JSONL file is a JSON record. Relevant fields:
- `type: "user"` — user message text (extract corrections, redirections)
- `type: "assistant"` — assistant response + `usage` field with `input_tokens`, `cache_creation_input_tokens`
- `type: "tool_use"` — tool calls (detect Agent tool, sequential vs parallel patterns)
- `type: "tool_result"` — tool outputs (detect repeated errors)
- `timestamp`, `gitBranch`, `sessionId` fields on records

Use the **Grep tool** (not shell grep) for all text pattern matching in `.jsonl` files — searching for session topics, finding user correction patterns, locating tool_use records, etc. Use the **Read tool** to read specific files or portions of files. Use Bash only for `jq` or node one-liner JSON processing where no dedicated tool exists (e.g., extracting nested JSON fields, computing token sums, arithmetic). Never use shell `grep`, `head`, or `tail` commands.

### Finding the Current Session

To find the current session JSONL file:
1. List files in `~/.claude/projects/` to find the current project slug (match against the current working directory)
2. List `.jsonl` files in that project directory, sorted by modification time
3. The most recently modified `.jsonl` file is the current session

### Finding Sessions by Topic (Mode 2)

1. Use the Grep tool to search `~/.claude/history.jsonl` for lines containing the target command/topic keywords
2. Extract `sessionId` and project path from matching entries
3. Locate the corresponding `.jsonl` file in `~/.claude/projects/<project-slug>/<session-id>.jsonl`

---

## Analysis Metrics

For each session analyzed, extract these signals:

| Metric | How to Detect |
|--------|---------------|
| **User correction count** | User messages starting with "no", "instead", "don't", "actually", "wrong", "that's not", or corrections to previous output |
| **Retry/rework count** | Claude attempting the same file/task multiple times within a session |
| **Token usage** | `usage.input_tokens + cache_creation_input_tokens`; flag if >60% of model context limit; flag autocompact events as critical |
| **Speed** | Session duration; identify phases with long sequential tool-call chains that could be parallelized |
| **Skill trigger accuracy** | User describes a task covered by a known command but doesn't invoke it; or a command fires when it shouldn't |
| **Review signal quality** | In implement-spec sessions: ratio of review issues accepted vs rejected/dismissed by user |
| **Task completion rate** | Session ends without user confirmation of success, or user says "leave it" / "forget it" |
| **Parallelization efficiency** | Sequential Agent tool calls on independent tasks that could have been batched |
| **Spec-to-impl drift** | User amends spec mid-implementation ("actually change the spec to...") |
| **Error recovery quality** | Same error appearing in multiple consecutive tool results before resolution |

---

## Stale Issue Detection

Before surfacing any finding, check if the issue is already addressed:

1. Identify which command/agent is implicated by the finding
2. Read its current `.md` file from `plugins/wsbaser/commands/` or `plugins/wsbaser/agents/`
3. Check if the current version already addresses the issue
4. If yes — skip the finding (mark as "already resolved")
5. If no, and the issue was found in a recent session — surface it

**Recency weighting**: Sessions from the last 30 days weighted 100%, 31-90 days weighted 50%, >90 days weighted 20%. If a finding only appears in sessions older than 90 days, require corroboration from recent sessions to surface it.

---

## Self-Improve Loop Detection (Shared Step)

This step runs in every mode that analyzes history. Apply it after scoring findings but before presenting results.

1. Use the Grep tool to search session JSONL files and `specs/` for previous `/wsbaser:self-improve` invocations and their output specs (`specs/self-improve-*.md`)
2. For each past self-improve spec found:
   a. Read the spec to identify what improvement was proposed and which file was targeted
   b. Check if the target file was modified after the spec date (use `git log --since="{spec-date}" -- {target-file}`)
   c. If implemented, check whether the same problem recurs in sessions after the implementation date
3. If a problem was "fixed" via self-improve but recurs in later sessions, flag it: **"self-improve produced a weak fix for X — consider improving self-improve itself"**

**Mode-specific notes:**
- **Mode 1** (current session only): Check if the current session itself is a self-improve session, and whether any current findings match past self-improve specs
- **Modes 2 and 3** (cross-history): Full loop detection across all analyzed sessions

---

## Mode 1: Current Session Analysis

**Trigger**: No arguments provided.

### Steps

1. **Locate current session JSONL** — find the most recently modified `.jsonl` file in the current project's session directory.

2. **Extract signals** — apply all analysis metrics to the session data. Use the Grep tool to find relevant records by pattern, then Bash with `jq` for JSON field extraction. Focus on:
   - User corrections and redirections
   - Repeated tool calls on the same files
   - Token usage spikes and autocompact events
   - Sequential tool chains that could have been parallel
   - Error patterns (same error in consecutive tool results)

3. **Check existing tooling** — for each finding, read the relevant command/agent `.md` file and check if the current version already addresses the issue. Skip findings that are already resolved.

4. **Self-improve loop detection** — apply the shared Self-Improve Loop Detection step (see above) to check if any current findings match past self-improve specs.

5. **Rank findings** — order by estimated value: `frequency x impact x (1 / estimated_effort)`.

6. **Present results** — display findings or state that nothing valuable was found.

If no valuable improvements are found:

```
==============================================================
 SELF-IMPROVE: Current Session Analysis
==============================================================
 Session: {session-id}
 Records analyzed: {count}
 Result: No actionable improvement opportunities found.
==============================================================
```

If findings exist, display them:

```
==============================================================
 SELF-IMPROVE: Current Session Analysis
==============================================================
 Session: {session-id}
 Records analyzed: {count}
 Findings: {count}
==============================================================

 # | Finding                          | Impact | Effort | Tool Affected
---+----------------------------------+--------+--------+--------------
 1 | {description}                    | High   | Low    | {command/agent}
 2 | {description}                    | Medium | Medium | {command/agent}
 ...
==============================================================
```

7. **User selection** — ask the user to pick a finding (or decline) using `AskUserQuestion`:

```json
{
  "question": "Which finding would you like to turn into a spec for implementation?",
  "header": "Select finding",
  "options": [
    {"label": "#1: {short description}", "description": "{detail}"},
    {"label": "#2: {short description}", "description": "{detail}"},
    {"label": "None", "description": "No improvements needed right now"}
  ]
}
```

8. **Delegate** — if the user picks a finding, transition to the appropriate tool (see Delegation Map below).

---

## Mode 2: Focused Cross-History Analysis

**Trigger**: Arguments provided that are not `--research`.

### Steps

1. **Extract focus** — parse the prompt to identify:
   - Target command/agent name (if mentioned)
   - Problem area or dimension (e.g., "token usage", "speed", "errors")
   - Specific behavior being investigated

2. **Search history** — find relevant sessions:
   - Search `~/.claude/history.jsonl` for entries matching the focus keywords
   - Also search all project JSONL directories for sessions mentioning the target
   - Apply recency weighting to prioritize recent sessions

3. **Deep analysis** — for each relevant session:
   - Extract metrics focused on the stated dimension
   - Identify specific instances with timestamps and context
   - Perform root cause analysis for each finding

4. **Score findings** — rank by: `frequency x impact x (1 / estimated_effort)`
   - Frequency: how often the issue appears across sessions
   - Impact: how much time/tokens/quality is lost per occurrence
   - Effort: estimated complexity of the fix

5. **Stale issue detection** — for each finding, check if the current tool version already addresses it. Skip resolved findings.

6. **Self-improve loop detection** — apply the shared Self-Improve Loop Detection step (see above) across all analyzed sessions.

7. **Present results**:

```
==============================================================
 SELF-IMPROVE: Focused Analysis
==============================================================
 Focus: {parsed focus description}
 Sessions analyzed: {count}
 Time range: {oldest} to {newest}
 Findings: {count}
==============================================================

 # | Finding                  | Freq | Impact | Effort | Root Cause
---+--------------------------+------+--------+--------+-----------
 1 | {description}            | 8/12 | High   | Low    | {cause}
 2 | {description}            | 5/12 | Medium | Medium | {cause}
 ...

{If any self-improve loop detected:}
 WARNING: Finding #{n} was previously addressed by self-improve
 (spec: specs/self-improve-{slug}.md) but the problem recurred.
 Consider improving self-improve itself.
==============================================================
```

8. **User selection** — same `AskUserQuestion` flow as Mode 1.

9. **Delegate** — transition to the appropriate tool per the Delegation Map.

---

## Mode 3: Interactive Research (`--research`)

**Trigger**: `$ARGUMENTS` is `--research`.

### Step 1: Present Research Options

```
==============================================================
 SELF-IMPROVE: Research Mode
==============================================================
 Choose your analysis approach:
==============================================================
```

Use `AskUserQuestion`:

```json
{
  "question": "How would you like to explore improvement opportunities?",
  "header": "Research approach",
  "options": [
    {"label": "Analyze everything", "description": "Scan recent sessions across all projects, produce a prioritized dashboard of findings across all metrics"},
    {"label": "Pick a dimension", "description": "Choose a specific analysis dimension to deep-dive on"}
  ]
}
```

### Path A: Analyze Everything

1. Find all project session directories under `~/.claude/projects/`
2. For each project, analyze the most recent sessions (last 30 days, up to 20 sessions)
3. Apply ALL metrics simultaneously
4. Apply stale issue detection, then apply the shared Self-Improve Loop Detection step (see above)
5. Present a prioritized dashboard:

```
==============================================================
 SELF-IMPROVE: Full Dashboard
==============================================================
 Projects scanned: {count}
 Sessions analyzed: {count}
 Time range: {oldest} to {newest}
==============================================================

 # | Finding            | Dimension         | Impact | Effort | Projects
---+--------------------+-------------------+--------+--------+---------
 1 | {description}      | Token efficiency   | High   | Low    | {list}
 2 | {description}      | Correction pattern | High   | Medium | {list}
 ...
==============================================================
```

6. User selection and delegation (same flow as Mode 1).

### Path B: Pick a Dimension

Present all 10 dimensions using `AskUserQuestion`:

```json
{
  "question": "Which analysis dimension would you like to explore?",
  "header": "Select dimension",
  "options": [
    {"label": "1. Token efficiency", "description": "Context usage, autocompact events, cache hit rates"},
    {"label": "2. Speed & parallelization", "description": "Session duration, sequential work that could be parallel"},
    {"label": "3. Correction & retry patterns", "description": "User redirections, rework loops, repeated errors"},
    {"label": "4. Skill trigger accuracy", "description": "Commands that should have fired but didn't, or fired when they shouldn't"},
    {"label": "5. Review signal quality", "description": "Accepted vs rejected issues in implement-spec sessions"},
    {"label": "6. Task completion rate", "description": "Half-done tasks, abandoned sessions, unconfirmed success"},
    {"label": "7. Spec-to-implementation drift", "description": "Mid-session spec amendments, requirement changes during implementation"},
    {"label": "8. Error recovery quality", "description": "How many retries before resolution, repeated error patterns"},
    {"label": "9. CLAUDE.md freshness", "description": "Stale or missing context in CLAUDE.md files"},
    {"label": "10. Self-improve effectiveness", "description": "Past self-improve sessions that didn't stick, recurring issues"}
  ]
}
```

After user picks a dimension:
1. Search all recent sessions for data relevant to that dimension
2. Deep-dive analysis with specific examples and timestamps
3. Root cause analysis per finding
4. Present findings ranked by value
5. User selection and delegation (same flow as Mode 1)

---

## Delegation Map

After the user selects a finding, determine the improvement type and delegate accordingly:

| Improvement Type | Action |
|------------------|--------|
| New command | Run `/wsbaser:interview` — pass finding context so the interview focuses on designing a new command `.md` file |
| Improve existing command | Run `/wsbaser:interview` — pass finding context, specify this is an edit to an existing `.md` file |
| New agent | Run `/wsbaser:create-agent` — pass finding context as the agent purpose description |
| Improve existing agent | Run `/wsbaser:interview` — pass finding context, specify this is an edit to an existing agent `.md` file |
| New skill | Run `/wsbaser:skill-creator` — pass finding context |
| CLAUDE.md update | Run `/wsbaser:refine-claudemd` — pass finding context with the specific CLAUDE.md improvements needed |
| Improve self-improve | Run `/wsbaser:interview` — pass finding context, specify this is an edit to `self-improve.md` itself |

### Transition Format

When delegating, provide the downstream command with structured context:

```
==============================================================
 DELEGATING TO: {command name}
==============================================================
 Finding: {description}
 Root cause: {why this happens}
 Evidence: {session references with timestamps}
 Affected tool: {command/agent/skill name and path}
 Improvement type: {new / edit}
 Suggested approach: {high-level direction based on analysis}
==============================================================
```

Then invoke the appropriate command. The output of the delegation should be a spec file at `specs/self-improve-{slug}.md` in the current project, ready for `/wsbaser:implement-spec`.

---

## Output Spec Format

When the delegation produces a spec, ensure it is saved to `specs/self-improve-{slug}.md` where `{slug}` is derived from the finding description (lowercase, hyphens, max 6 content words). The spec must follow the same format used by `/wsbaser:interview` so it is compatible with `/wsbaser:implement-spec`.

---

## Important Rules

1. **Evidence-based only** — never hallucinate improvements. Every finding must reference specific session data (timestamps, message content, tool call patterns).
2. **Adaptive** — if no valuable improvements are found in Mode 1, say so clearly and stop. Do not invent findings to justify the analysis.
3. **Check before surfacing** — always run stale issue detection before presenting any finding. Do not waste the user's time with already-resolved issues.
4. **Recency matters** — weight recent sessions higher. Old findings without recent corroboration should be deprioritized or skipped.
5. **Respect context limits** — when analyzing JSONL files, use the Grep tool for targeted pattern searches and Bash with `jq` for JSON field extraction. Do not read entire large session files into context. Extract only the records needed for each metric.
6. **Spec compatibility** — all output specs must match the `/wsbaser:interview` format for use with `/wsbaser:implement-spec`.
