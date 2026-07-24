---
name: wsbaser:generate-test-plan
description: Point this at a single module/area of a codebase and produce a full-coverage, risk-prioritized test plan for it — every distinct behavior worth a test, each scored for priority and given its reasoning. Always fans the per-capability analysis out to parallel worker subagents, keeping the orchestrating session's own context lean and focused. Uses references/orchestrator-prompt.md and references/worker-prompt.md.
disable-model-invocation: true
---

# Generate Test Plan

Produce a full-coverage test plan for one module/area of a codebase: every
distinct behavior worth a test, each one scored by risk and given its layer and
reasoning. The caller (person or downstream process) walks the resulting list
top-down and decides how far to implement.

This skill produces a PLAN, not test code. Do not write test code until the plan
is approved.

## Core principles

1. **Rank by risk = Impact × Likelihood.** Impact is what breaks for the
   user/business (weight revenue/conversion, auth, data integrity, high-usage
   paths higher). Likelihood is how prone the code is to breaking (weight high
   git churn, complexity, many branches/dependencies, network/async boundaries,
   recent change higher). This score is the test's priority — highest first.

2. **Test each behavior at its narrowest owning layer.**
   - Pure logic → unit test.
   - Component + state + network handling → integration test (mocked backend).
   - Cross-system wiring / critical user journey → E2E test (real backend).
   - Request/response shape vs. the real backend → contract test (e.g. Pact),
     not an E2E test per endpoint.
   This is a placement decision (where a behavior is best verified), not a
   filtering decision — it never removes a behavior from the plan.

3. **Enumerate everything, omit nothing.** Every distinct behavior — a
   rule/branch/outcome that could independently be wrong — gets one test entry:
   layer, priority score, and one-line reasoning (why it matters / what it
   protects). Low-value or low-risk behaviors still get an entry; they simply
   sort to the bottom by their score. The skill never drops a candidate itself.

4. **Reuse existing infrastructure; flag gaps explicitly.** Tests should reuse
   the project's existing test frameworks, mocks, fixtures, and base classes
   wherever the needed layer already has them. When a capability needs a layer
   or capability the infra doesn't support, that's a gap: name it — don't route
   around it silently, and don't skip the test because of it.

## Layer strategy (integration vs. E2E vs. contract)

Most coverage belongs in integration tests with a mocked backend — they are
fast, deterministic, and can exhaustively cover branches and error paths. Reserve
E2E (real backend) for a thin cap of business-critical journeys (login, checkout,
signup→activation) that act as a release gate.

Verify request/response shape with contract tests, not one E2E test per API
endpoint — contract tests cover every endpoint cheaply without a browser and
catch mock drift (where handwritten mocks diverge from the real backend). Keep
integration mocks consistent with the contract by deriving both from a single
shared fixture, so a backend change breaks the contract in CI rather than in
production. See `references/layer-strategy.md` for the full rationale,
contract-testing mechanics, and how mocks relate to contracts.

## Workflow

Always scoped to the module/area supplied at invocation — analyze that target,
not the wider codebase. This keeps each run focused and its context lean.

**Phase 0 — Survey testing infrastructure.** Look for CLAUDE.md/AGENTS.md
nearest the target (then repo root) for documented testing conventions:
frameworks, test runner/commands, mocking system, fixture/base-class locations,
per-layer conventions. If that's missing or silent on testing, inspect the
actual code instead: test folder structure, test-related dependencies, and
existing test files' patterns (mock setup, shared fixtures/base classes,
contract-test tooling if any). Produce a short summary of what exists per
layer (unit/integration/E2E/contract) — frameworks, reusable fixtures/mocks/
base classes, conventions — and, explicitly, what's absent. Pass this summary
to every Phase 2 worker.

**Phase 1 — Capability backlog.** Within the target module/area, list distinct
capabilities and score each Impact × Likelihood (1–5 each), with per-factor
reasoning and git/complexity evidence. Sort most→least critical.

**Phase 2 — Full test list per capability (parallel).** Dispatch one worker
subagent per capability (see `references/worker-prompt.md`) to do the
deep-dive: read the implementation, list every distinct behavior worth
protecting, and for each assign its layer (see Layer strategy), a priority
score, and a one-line reasoning. Each test's prerequisite must say either
"reuses existing: `<named fixture/util/framework>`" (from the Phase 0 summary)
or "GAP: `<what's missing>`" if the layer/capability isn't supported yet — a
gap still gets a full test entry, per Core Principle 3. Always run this phase
in parallel — it's what keeps the orchestrating session from having to read
every capability's implementation itself.

**Phase 3 — Aggregate.** Collect every worker's test entries into one flat
list. Sort by priority score, highest first. Also collect and dedupe every
flagged gap into one "Infrastructure Gaps" list. The caller decides sequencing
and cutoff themselves once they have the ranked list.

See `references/orchestrator-prompt.md` for the full coordination instructions
(dispatching workers, collecting results, aggregating).

## Output format

Deliver, in order: the testing infrastructure summary (Phase 0), the capability
backlog (Phase 1), the full test list (Phase 2/3) — one flat, priority-sorted
list where each entry has: capability, behavior protected, layer, priority
score, and one-line reasoning — and a distinct **Infrastructure Gaps** section
listing every "GAP:"-tagged prerequisite, deduplicated, with which tests depend
on it. Keep this section structurally separate from the test list so it can't
be missed: it's the explicit signal that infra work is a prerequisite before
those tests are executable. Justify every decision from the actual code and git
history — never generic testing advice, and never invent behavior that wasn't
read.
