# Predefined Scenarios for verify-feature Commands

**Date**: 2026-03-14
**Status**: Draft

---

## Overview

Add support for predefined scenario lists to both `/wsbaser:verify-feature` and `/wsbaser:verify-feature-playwright`. When scenarios are provided, the skills skip or reduce their research phase and proceed directly to execution, saving time when the user already knows what to test.

---

## Requirements

### Functional Requirements

1. Both skills must accept predefined scenarios from three input sources:
   - **Inline in the prompt** — scenarios described in natural language alongside the command invocation
   - **File path argument** — a path to a file containing scenario definitions
   - **Conversation context** — scenarios defined earlier in the conversation, referenced by the user's prompt

2. Scenarios can be provided at any level of detail, from a one-liner (e.g., "test login flow") to a fully structured definition with steps, expected outcomes, and DB validation queries. The skill accepts all levels.

3. When predefined scenarios are provided, the skill uses LLM judgment to decide which (if any) research sub-agents to run:
   - **Sub-agent 1 (App structure & user journeys):** Skipped — journeys are already defined by the user.
   - **Sub-agent 2 (DB schema & data flows):** Run only if the LLM determines the provided scenarios lack sufficient detail about data validation (e.g., no DB queries, no mention of expected records).
   - **Sub-agent 3 (Bug hunting):** Always skipped when predefined scenarios are provided.

4. When scenarios come from conversation context, the skill only scans prior context if the user's invocation prompt mentions scenarios (e.g., "use the scenarios above", "test the scenarios we discussed", "run the scenarios"). A bare `/verify-feature-playwright` with no mention of scenarios triggers the normal full-research flow.

5. Track assignment (parallelization) is always auto-analyzed by the skill, regardless of whether scenarios are predefined or discovered. The skill analyzes dependencies between provided scenarios and groups them into parallel tracks.

6. For minimal scenarios (e.g., just a name), the execution agents are responsible for figuring out the detailed steps on the fly using codebase context and the app's actual UI.

### Non-Functional Requirements

1. The change must apply identically to both `/wsbaser:verify-feature` (Chrome DevTools MCP) and `/wsbaser:verify-feature-playwright` (Playwright CLI) — same behavior, same input formats.

---

## Design Decisions

### Flexible Scenario Format

**Decision:** Accept any level of detail rather than enforcing a rigid schema.

**Rationale:** The primary use case is speed — the user already knows what to test and doesn't want to spend time formatting scenarios into a strict structure. Forcing a schema would add friction. The LLM can handle ambiguity and fill gaps.

**Alternatives rejected:**
- Strict JSON/YAML schema — too much friction for ad-hoc usage
- Markdown template with required fields — still too rigid for inline prompt usage

### LLM-Judged Conditional Research

**Decision:** Let the LLM judge whether research sub-agents are needed based on the detail level of provided scenarios.

**Rationale:** A heuristic based on field presence (e.g., "has steps AND expected outcomes") would be brittle and miss nuances. The LLM can assess whether scenarios have enough context for DB validation, auth flows, etc. and decide to run Sub-agent 2 only when genuinely needed.

**Alternatives rejected:**
- User flag (`--skip-research`) — adds cognitive overhead; user shouldn't need to think about internals
- Structured field detection — too rigid, would miss cases where natural language descriptions are sufficient

### Always Skip Bug Hunting with Predefined Scenarios

**Decision:** Never run Sub-agent 3 (bug hunting) when predefined scenarios are provided.

**Rationale:** When the user provides explicit scenarios, they've already defined the scope of testing. Bug hunting is exploratory by nature and contradicts the user's intent to run a targeted test pass.

**Alternatives rejected:**
- Always run bug hunting — wastes time when user wants fast targeted testing
- Conditional based on LLM judgment — adds complexity for little benefit; user can always run a separate bug hunt

### Context Detection via Prompt Mention

**Decision:** Only scan conversation context for scenarios when the user's prompt explicitly mentions scenarios.

**Rationale:** Implicit detection (always scanning) risks false positives — any numbered list or discussion in prior context could be misinterpreted as test scenarios. Requiring an explicit mention is low-friction (natural phrasing like "test the scenarios above") while avoiding ambiguity.

**Alternatives rejected:**
- Implicit detection — too many false positives from general conversation
- Explicit keyword/flag — too rigid, natural language reference is sufficient

---

## Acceptance Criteria

- [ ] Both skills accept scenarios inline in the command prompt
- [ ] Both skills accept a file path to a scenarios file
- [ ] Both skills detect scenarios from conversation context when the prompt mentions them
- [ ] Bare invocation (no scenarios mentioned) triggers the full research flow as before
- [ ] Sub-agent 1 (journey discovery) is skipped when predefined scenarios are provided
- [ ] Sub-agent 3 (bug hunting) is skipped when predefined scenarios are provided
- [ ] Sub-agent 2 (DB schema) runs conditionally based on LLM judgment of scenario detail
- [ ] Minimal scenarios (just a name) are expanded by execution agents on the fly
- [ ] Track parallelization is auto-analyzed for predefined scenarios
- [ ] Both skills produce identical behavior for the same inputs

---

## Open Questions

None — all questions resolved during interview.
