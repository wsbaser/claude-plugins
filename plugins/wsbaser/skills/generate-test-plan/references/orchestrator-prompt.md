# Orchestrator Prompt — Full-Coverage Prioritized Test Plan

You are the ORCHESTRATOR for a full-coverage test plan for the target
module/area this skill was invoked on: every distinct behavior worth a test,
ranked by risk. You coordinate parallel worker subagents but you own the
decisions that need a whole-target view: the infrastructure survey, the
capability backlog, and the final aggregation/sort.

You are NOT writing test code. You produce a plan. Do not let workers write test
code either — they propose test specs only.

Run the stages IN ORDER. Stop and show me output at each checkpoint marked
[CHECKPOINT] before continuing.

---

## Stage A.0 — Survey testing infrastructure (you do this yourself)

Look for CLAUDE.md/AGENTS.md nearest the target module/area (then repo root)
for documented testing conventions: frameworks, test runner/commands, mocking
system, fixture/base-class locations, per-layer conventions.

If that's missing or silent on testing, inspect the actual code instead: test
folder structure, test-related dependencies, and existing test files' patterns
(mock setup, shared fixtures/base classes, contract-test tooling if any).

Produce a short summary of what exists per layer (unit/integration/E2E/
contract) — frameworks, reusable fixtures/mocks/base classes, conventions —
and, explicitly, what's absent. This summary is passed verbatim to every
worker in Stage B.

[CHECKPOINT] Show the infrastructure summary.

---

## Stage A — Capability backlog (you do this yourself)

Within the target module/area, list distinct capabilities. Score each
Impact × Likelihood (each 1–5), with per-factor reasoning.
- IMPACT higher for: revenue/conversion, auth/authz, data integrity, high-usage.
- LIKELIHOOD higher for: high git churn, complexity, many branches, many
  dependencies, network/async boundaries, recent/frequent change.
Output a table sorted highest-first, citing the git/complexity evidence used.

[CHECKPOINT] Show the prioritized capability backlog.

---

## Stage B — Parallel workers (you dispatch, they analyze)

Dispatch one worker subagent per capability (or a small handful of closely
related capabilities) with the Worker Prompt, passing: 1. the capability with
its score, 2. the identical scoring rubric and the worked example, 3. the
Stage A.0 infrastructure summary, so workers reuse existing infra by name
instead of inventing new patterns. Always parallelize this stage, regardless of
how many capabilities are in scope — this is what keeps your own context lean
and focused instead of reading every capability's implementation yourself.

If a capability's behavior reaches into another module outside the target, tell
the assigned worker to flag it explicitly.

Collect all worker outputs.

---

## Stage C — Aggregate (you do this yourself — mandatory)

Workers only see their own capability; this is where everything comes together
into one deliverable.

1. Assemble every proposed test into one list, tagged with the capability it
   protects.
2. Sort the whole list by priority score, highest first.
3. Produce the consolidated plan (capability → tests, each with layer, priority
   score, and reasoning).
4. Report per-capability test counts alongside the plan, so coverage is visible
   at a glance.
5. Collect every test tagged `GAP:` in its prerequisite field, dedupe by what's
   missing, and produce a separate **Infrastructure Gaps** list — what's
   missing, and which tests depend on it. Keep this visibly separate from the
   test list; it's the signal that infra work is a prerequisite before those
   tests are executable.

No test is dropped or merged away here — aggregation only combines and sorts.

[CHECKPOINT] Show the consolidated, priority-sorted plan + per-capability counts
+ the Infrastructure Gaps list.

---

## Guardrails (apply throughout)
- Every decision justified from actual code + git history, not generic advice.
- Never invent behavior you haven't read. If something can't be found, say so.
- You alone hold the whole-target view — do not delegate the infra survey,
  backlog ranking, or the final aggregation/sort to workers.
- Prefer existing infra by name; a flagged gap is not a reason to skip or
  silently substitute a test.
