---
name: wsbaser:implement-union-scenarios
description: Implements Union.Playwright.NUnit E2E tests from EXISTING Gherkin .feature scenarios given as a file or folder path. Two stages: a team first builds and reviews the shared test surface (page objects, fixtures, API mocks) from a deduplicated manifest and confirms it compiles, then a second team writes the test classes against that frozen scaffold, reviews, runs the suite, fixes failures, and emits an HTML report. ONLY invoke explicitly as /wsbaser:implement-union-scenarios — it spawns an agent team and runs dotnet test, so never start it on its own; do NOT trigger on phrases like "implement these scenarios" or "automate this .feature". Counterpart to wsbaser:verify-union (which RESEARCHES the app and GENERATES scenarios); this one consumes scenarios already on disk and skips research/generation. Not for writing Gherkin (that is wsbaser:bdd-scenarios) and not for non-Union frameworks.
---

# Implement Union E2E Tests From Existing Scenarios

Existing `.feature` Gherkin → runnable Union.Playwright.NUnit tests. No research, no generation — implement what is written, faithfully. Spot a coverage gap? Suggest it; never add silently.

**Two stages, two parallelization axes:**
- **Scaffold — by artifact.** Build/repair every shared page object, component, fixture, mock the scenarios need, before any test uses them. Disjoint files → no collisions. Ends when the scaffold compiles and passes review.
- **Implement — by scenario/role.** Write test classes against the frozen scaffold. Genuinely independent: no agent creates page objects.

**Test Surface Manifest** is the contract — every needed artifact, deduped on paper, before code. Stops N agents each forking their own copy of the same shared page object.

**Selectors: ground in real markup.** Read the actual component source / rendered DOM; never guess. Stale selectors in existing page objects (e.g. a grid selector targeting a control that the page doesn't actually use) are a known defect — scaffold repairs them, never trusts them.

## Pre-flight

1. **Source.** Arg = path to a `.feature` file or folder (`SCENARIO_SOURCE`). Folder → collect every `*.feature` recursively. No path → ask (`AskUserQuestion`), don't guess. Read each in full; parse `Feature`/`Scenario`/`Scenario Outline`/`Background`/`Examples` → `SCENARIO_LIST`. User named scenarios/tags → filter, note exclusions.
2. **Print:** source · feature-file count · scenario count (and filtered count).
3. **Project.** Resolve test `.csproj` → `TEST_PROJECT_PATH`: CLAUDE.md first; else glob `*.E2E*.csproj` / `*.AutoTests.csproj` / `*.Tests.csproj`; multiple or none → ask.

## Phase 1 — Plan tracks

Group `SCENARIO_LIST` into implementation tracks by coherent test class (feature/role/page). Page objects come from Phase 4, so tracks no longer collide over them. Max 7, prefer small. List each track's consumed scaffold artifacts (cross-checks Phase 4 must produce them). Confirm grouping with the user (`AskUserQuestion`); don't proceed until confirmed.

## Phase 2 — Team

- `TeamCreate` (`implement-scenarios-{timestamp}` → `TEAM_NAME`) if the harness has it; else single implicit team, agents addressed by `name` via `SendMessage`.
- `TaskCreate` per track: scenarios verbatim + `TEST_PROJECT_PATH`.
- Spawn one **persistent `wsbaser:devils-advocate`** (`name: devils-advocate`) — lives across every gate.
- Do NOT spawn union-dev or the reviewer yet.

## Phase 3 — Gate A: Automability

DA judges automability, not coverage. Send the full Gherkin; require **file-cited** flags: vague steps, missing preconditions/test data, missing or ambiguous selectors, scenarios mixing success+failure. Verdict: APPROVED / CHANGES REQUESTED, returned via `SendMessage` to main.

Gate A output **seeds the manifest** (Phase 4). Blockers are the build list, not a stop sign:
- APPROVED → manifest mostly reuses existing primitives.
- CHANGES → almost always missing infra (role fixture, list mock, page object, stale selector) → becomes scaffold artifacts. Only if the Gherkin contradicts real app behavior, confirm a scenario change with the user before editing the `.feature`.

Ask the DA to phrase blockers as concrete artifacts ("needs a mock for endpoint X", "needs a page object for component Y with a verified selector") so they map onto manifest rows.

## Phase 4 — Scaffold (by artifact)

**Step 1 — Manifest.** Walk each scenario step → interaction/assertion → backing artifact. Ground every selector in real source (read the component markup/source; verify against the rendered DOM via the running app or a component explorer if available). Fold in Gate A. Use sub-agents for large surfaces. Cover:
- **Page objects/components** — status (`new`/`extend-existing`/`reuse-as-is`/`repair-stale`), file path, members (locators+actions), verified selector per member.
- **Fixtures** — the personas/auth/data states the scenarios assume, and exactly how each is seeded.
- **Mocks** — endpoint, controllable response shape, dependent scenarios.
- **Reuse list** — existing primitives kept unchanged.

Dedup here — each artifact appears once. Print a concise manifest.

**Step 2 — Skip if complete.** Everything exists, valid, no repair → record "full reuse, no build" → Phase 5.

**Step 3 — Partition.** Split to-build/repair into **disjoint-file** groups (one per page object/mock; one for fixtures). `TaskCreate` each.

**Step 4 — Spawn builders.** One `wsbaser:union-dev` per group (`name: scaffold-<artifact>`), template `references/scaffold-engineer-activation.md`. Surface only — no test classes.

**Step 5 — Spawn reviewer** (persists into Phase 5). `Agent subagent_type:"default"`, `name: union-testing-reviewer`. Init:

```
UNION-TESTING FRAMEWORK COMPLIANCE REVIEWER
Persistent reviewer — scaffold first, test code later.
SETUP: load the wsbaser:union-testing skill (Skill tool) — your single source of truth.
Per request: read every file; check ALL union-testing rules; for scaffold also verify
selectors are real (match cited source), no existing primitive duplicated, [UnionInit]
correct. Per violation: file:line, rule (cite section), snippet, fix, owning agent.
Violations → SendMessage fixes to owners; re-review on report-back; max 2 cycles, then
report remainder to lead. Done → "REVIEW COMPLETE — [summary]" to lead. Stand by.
```

**Step 6 — Review + build gate.**
- Incremental review per builder as it reports.
- `dotnet build [TEST_PROJECT_PATH]` — scaffold must compile (no tests reference it yet). Errors → owning agent. Max 2 build-fix cycles.
- DA completeness gate: manifest + built file list → confirm every scenario's artifacts exist and selectors are real (APPROVED/CHANGES). Fix gaps.
- **Freeze** → `SCAFFOLD_FILES`. Read-mostly after: implementers consume it; touch only to fix a real scaffold bug (reported, not forked).

## Phase 5 — Implement (by scenario)

One `wsbaser:union-dev` per track (`name: track-N`), template `references/union-dev-activation.md` with the track scenarios + `SCAFFOLD_FILES`. They **consume** the scaffold, never recreate it — missing → report a scaffold gap, not a duplicate. Reviewer is already alive.

- **Incremental:** as each track reports, send the reviewer its file list to review; don't block other tracks.
- **Final cross-track:** after all tracks + reviews, review the full test-class set for scaffold-bypass (a track that built its own page object → refactor onto `SCAFFOLD_FILES`), inconsistent patterns, conflicting fixture/state sharing. Skip scaffold files unless a test changed one. Wait "REVIEW COMPLETE" → Gate B.

## Phase 6 — Gate B: Code quality

DA reviews test code: faithfulness to Given/When/Then, meaningful assertions, pattern adherence, cross-track consistency. Framework compliance already covered by the reviewer. Critical → fix via owning agent; warnings → note and proceed.

## Phase 7 — Full run

`dotnet test [TEST_PROJECT_PATH]`. Collect: exit code, console, TRX (`TestResults/`), and any failure screenshots (wherever this project's diagnostics config writes them — discover the path, don't assume). Print totals (total/passed/failed/skipped). All pass → Phase 9; failures → Phase 8.

## Phase 8 — Gate C: Failures

DA analyzes the run: per failure → root cause (selector/timing/assertion/env/cross-track/framework/scenario-vs-app), owning agent, fix instructions. Dispatch fixes; re-run full suite; repeat from here. **Max 3 cycles**, then proceed with remaining failures noted. A failure tracing to scenario-vs-app mismatch → surface to user, don't force green.

## Phase 9 — Report + cleanup

1. `wsbaser:generate-test-report` (scenario → report scenario, step → step, pass/fail + screenshots).
2. Print summary: scenarios · passed · failed · fix cycles · report path.
3. Shutdown every spawned agent (`devils-advocate`, `union-testing-reviewer`, `scaffold-*`, `track-N`) via `shutdown_request`; `TeamDelete` if the harness has it.

**Checklist:** summary printed · report generated · shutdowns sent · team cleaned · scaffold + test files left uncommitted for review.
