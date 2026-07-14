---
name: wsbaser:implement-union-scenarios
description: Implements Union.Playwright.NUnit E2E tests from EXISTING Gherkin .feature scenarios given as a file or folder path. Two stages: a team first builds and reviews the shared test surface from a deduplicated manifest — API mocks first, then page objects and fixtures grounded against the now-rendering app — and confirms it compiles, then a second team writes the test classes against that frozen scaffold, reviews, runs the suite, fixes failures, and emits an HTML report. Defaults to MOCKED endpoints — discovering and following the project's own mocking system for offline, deterministic, parallel-safe runs — using a real backend only when the user asks. ONLY invoke explicitly as /wsbaser:implement-union-scenarios — it spawns an agent team and runs dotnet test, so never start it on its own; do NOT trigger on phrases like "implement these scenarios" or "automate this .feature". Counterpart to wsbaser:verify-union (which RESEARCHES the app and GENERATES scenarios); this one consumes scenarios already on disk and skips research/generation. Not for writing Gherkin (that is wsbaser:bdd-scenarios) and not for non-Union frameworks.
---

# Implement Union E2E Tests From Existing Scenarios

Existing `.feature` Gherkin → runnable Union.Playwright.NUnit tests. No research, no generation — implement what is written, faithfully. Spot a coverage gap? Suggest it; never add silently.

**Two stages, two parallelization axes:**
- **Scaffold — by artifact.** Build/repair every shared mock, page object, component, fixture the scenarios need, before any test uses them. Disjoint files → no collisions. Internally ordered: **mocks first (4a), then page objects + fixtures (4b)** — a page object's selectors are verified against rendered DOM, which needs its mocks already live. Ends when the scaffold compiles and passes review.
- **Implement — by scenario/role.** Write test classes against the frozen scaffold. Genuinely independent: no agent creates page objects.

**Test Surface Manifest** is the contract — every needed artifact, deduped on paper, before code. Stops N agents each forking their own copy of the same shared page object.

**Selectors: ground in real markup.** Read the actual component source / rendered DOM; never guess. Stale selectors in existing page objects (e.g. a grid selector targeting a control that the page doesn't actually use) are a known defect — scaffold repairs them, never trusts them.

**Mocking is the default — and follows the project's own system.** Implement against *mocked* endpoints unless the user opts into a real backend (or a scenario is tagged for it): mocked tests are deterministic, offline, parallel-safe; a live-backend test needs credentials, flakes, and dies when the backend is down or drifts — green against a real backend is a liability, not a win. **Every** call the scenario provokes gets a mock — step-driven, the lookups a landed page fires on load, the auth path. Watch the trap: reusing a page object, scenario, or login helper that itself hits a real backend makes your test real-backed too — verify what you reuse runs mocked, never inherit it. Don't invent a parallel style; discover the project's (Pre-flight) and follow it.

## Pre-flight

1. **Source.** Arg = path to a `.feature` file or folder (`SCENARIO_SOURCE`). Folder → collect every `*.feature` recursively. No path → ask (`AskUserQuestion`), don't guess. Read each in full; parse `Feature`/`Scenario`/`Scenario Outline`/`Background`/`Examples` → `SCENARIO_LIST`. User named scenarios/tags → filter, note exclusions.
2. **Print:** source · feature-file count · scenario count (and filtered count).
3. **Project.** Resolve test `.csproj` → `TEST_PROJECT_PATH`: CLAUDE.md first; else glob `*.E2E*.csproj` / `*.AutoTests.csproj` / `*.Tests.csproj`; multiple or none → ask.
4. **Mock system.** Before planning, learn how THIS project mocks — you conform, not improvise. Find: the mocking guide (CLAUDE.md often points to it), the reference mock implementation, the per-domain mock classes, how a guarded route authenticates *without* a live login. Capture → `MOCK_SYSTEM`: interception mechanism, where mocks live, how seeded responses are made controllable, how auth is satisfied offline, any catch-all for endpoints a page hits incidentally (an unmocked authed GET 401s → redirect/crash, surfacing as a baffling selector timeout). All later phases conform. No mocking system at all → say so, confirm approach with the user before building one.

## Phase 1 — Plan tracks

Group `SCENARIO_LIST` into implementation tracks by coherent test class (feature/role/page). Page objects come from Phase 4, so tracks no longer collide over them. Max 7, prefer small. List each track's consumed scaffold artifacts (cross-checks Phase 4 must produce them). Confirm grouping with the user (`AskUserQuestion`); don't proceed until confirmed.

## Phase 2 — Team

- `TeamCreate` (`implement-scenarios-{timestamp}` → `TEAM_NAME`) if the harness has it; else single implicit team, agents addressed by `name` via `SendMessage`.
- `TaskCreate` per track: scenarios verbatim + `TEST_PROJECT_PATH`.
- Spawn one **persistent `wsbaser:devils-advocate`** (`name: devils-advocate`) — lives across every gate.
- Do NOT spawn union-dev or the reviewer yet.

## Phase 3 — Gate A: Automability

DA judges automability, not coverage. Send the full Gherkin plus `MOCK_SYSTEM`; require **file-cited** flags: vague steps, missing preconditions/test data, missing or ambiguous selectors, scenarios mixing success+failure. Also require a **per-scenario endpoint inventory**: every endpoint the steps trigger, the lookups each landed page fires on load, and the auth path — each tagged `mock-exists` (cite it) or `mock-needed`. An unlisted endpoint is one that quietly hits a live backend, so this inventory is what keeps the build fully mocked. Verdict: APPROVED / CHANGES REQUESTED, returned via `SendMessage` to main.

Gate A output **seeds the manifest** (Phase 4) — the endpoint inventory is the **direct build list for 4a**, the file-cited flags feed 4b. Blockers are the build list, not a stop sign:
- APPROVED → manifest mostly reuses existing primitives.
- CHANGES → almost always missing infra (role fixture, list mock, page object, stale selector) → becomes scaffold artifacts. Only if the Gherkin contradicts real app behavior, confirm a scenario change with the user before editing the `.feature`.

Ask the DA to phrase blockers as concrete artifacts ("needs a mock for endpoint X", "needs a page object for component Y with a verified selector") so they map onto manifest rows.

## Phase 4 — Scaffold (by artifact)

Two ordered sub-stages: **mocks first (4a), page objects + fixtures second (4b)**. Why ordered, not one pass: verifying a page-object selector against rendered DOM needs its mocks already live — an unmocked authed GET 401s → page crash → false "selector timeout", so grounding selectors against a not-yet-mocked page grounds them against a broken page. Mocks also partition differently (by endpoint/domain, build-list = Gate A's inventory) than page objects (by component, grounded in markup) and dedup differently → each earns its own pass.

### Phase 4a — Mock scaffold (by endpoint/domain)

**Step 1 — Spawn reviewer** (persists through 4b and into Phase 5). `Agent subagent_type:"default"`, `name: union-testing-reviewer`. Init:

```
UNION-TESTING FRAMEWORK COMPLIANCE REVIEWER
Persistent reviewer — mocks first (4a), then page objects/fixtures (4b), then test code (Phase 5).
SETUP: load the wsbaser:union-testing skill (Skill tool) — your single source of truth.
Per request: read every file; check ALL union-testing rules. For mocks: conform to
MOCK_SYSTEM (same interception/location/offline-auth), cover the inventory, controllable
responses, no live fall-through. For page-object scaffold: selectors real (match cited
source), no existing primitive duplicated, [UnionInit] correct. Per violation: file:line,
rule (cite section), snippet, fix, owning agent. Violations → SendMessage fixes to owners;
re-review on report-back; max 2 cycles, then report remainder to lead. Done →
"REVIEW COMPLETE — [summary]" to lead. Stand by.
```

**Step 2 — Mock manifest.** Gate A's per-scenario endpoint inventory is the build list. One row per endpoint (step-driven, page-load lookups, auth) + a catch-all for stray authed GETs. Dedup by endpoint. Each row (per `MOCK_SYSTEM`): status (`mock-exists`/`mock-needed`/`repair`), file path, controllable response, dependent scenarios. Can't mock one? Flag it — never let a test fall through to a live backend. Print the mock manifest.

**Step 3 — Skip if complete.** Every inventory endpoint already mocked, valid, no repair → record "full mock reuse" → 4b.

**Step 4 — Partition + build.** Disjoint-file groups by domain (one per mock class) + one catch-all. `TaskCreate` each; one `wsbaser:union-dev` per group (`name: mock-<domain>`), template `references/scaffold-engineer-activation.md` (mock variant). Conform to `MOCK_SYSTEM` — no parallel style. Mocks only — no page objects, no test classes.

**Step 5 — Mock gate.**
- Incremental review per builder as it reports (reviewer from Step 1).
- Smoke-check **offline**: every inventory endpoint has a controllable mock, and a landed page returns 200s with no live fall-through.
- DA completeness gate: inventory ↔ mock coverage (APPROVED/CHANGES). Fix gaps.
- **Freeze** → `MOCK_FILES`. 4b and Phase 5 consume them; touch only to fix a real mock bug (reported, not forked).

### Phase 4b — Page-object + fixture scaffold (by component)

Mocks now live → DOM grounding is real; selectors verified against a correctly-rendered page, not a crash page.

**Step 1 — Manifest.** Walk each scenario step → interaction/assertion → backing artifact. Ground every selector in real source (read the component markup/source; verify against the rendered DOM via the running app or a component explorer if available — `MOCK_FILES` are live, so the page renders). Fold in Gate A's file-cited flags. Use sub-agents for large surfaces. Cover:
- **Page objects/components** — status (`new`/`extend-existing`/`reuse-as-is`/`repair-stale`), file path, members (locators+actions), verified selector per member.
- **Fixtures** — the personas/auth/data states the scenarios assume, and exactly how each is seeded.
- **Reuse list** — existing primitives kept unchanged.

Dedup here — each artifact appears once. Print a concise manifest.

**Step 2 — Skip if complete.** Everything exists, valid, no repair → record "full reuse, no build" → Phase 5.

**Step 3 — Partition.** Split to-build/repair into **disjoint-file** groups (one per page object; one for fixtures). `TaskCreate` each.

**Step 4 — Spawn builders.** One `wsbaser:union-dev` per group (`name: scaffold-<artifact>`), template `references/scaffold-engineer-activation.md` (page-object variant). Page objects/fixtures only — `MOCK_FILES` are frozen, consume them, never rebuild. No test classes.

**Step 5 — Review + build gate.**
- Incremental review per builder as it reports.
- `dotnet build [TEST_PROJECT_PATH]` — scaffold must compile (no tests reference it yet). Errors → owning agent. Max 2 build-fix cycles.
- DA completeness gate: manifest + built file list → confirm every scenario's artifacts exist and selectors are real (APPROVED/CHANGES). Fix gaps.
- **Freeze** → `SCAFFOLD_FILES` (= `MOCK_FILES` + page objects + fixtures). Read-mostly after: implementers consume it; touch only to fix a real scaffold bug (reported, not forked).

## Phase 5 — Implement (by scenario)

One `wsbaser:union-dev` per track (`name: track-N`), template `references/union-dev-activation.md` with the track scenarios + `SCAFFOLD_FILES`. They **consume** the scaffold, never recreate it — missing → report a scaffold gap, not a duplicate. Reviewer is already alive.

- **Incremental:** as each track reports, send the reviewer its file list to review; don't block other tracks.
- **Final cross-track:** after all tracks + reviews, review the full test-class set for scaffold-bypass (a track that built its own page object → refactor onto `SCAFFOLD_FILES`), inconsistent patterns, conflicting fixture/state sharing. Skip scaffold files unless a test changed one. Wait "REVIEW COMPLETE" → Gate B.

## Phase 6 — Gate B: Code quality

DA reviews test code: faithfulness to Given/When/Then, meaningful assertions, pattern adherence, cross-track consistency. Framework compliance already covered by the reviewer. Critical → fix via owning agent; warnings → note and proceed.

## Phase 7 — Full run

Resolve once: `DIAG_RESULTS_ROOT` (this project's diagnostics-tree root — discover, don't assume); `FEATURES_DIR` (`SCENARIO_SOURCE` itself if a folder, else its containing folder); `RUN_STARTED_AT` (timestamp now, `yyyyMMdd_HHmmss_fff`).

```bash
dotnet test [TEST_PROJECT_PATH] --logger "trx;LogFileName=e2e-[RUN_STARTED_AT].trx" --results-directory ".reports/testresults" 2>&1 | tee ".reports/e2e-stdout-[RUN_STARTED_AT].log"
```

`TRX_PATH = .reports/testresults/e2e-[RUN_STARTED_AT].trx`, `STDOUT_LOG = .reports/e2e-stdout-[RUN_STARTED_AT].log` — named by the timestamp captured once above, so every Gate C re-run in this session overwrites the same pair (still "last attempt"), but a separate future invocation gets its own files instead of clobbering this session's.

Collect: exit code, `STDOUT_LOG`, `TRX_PATH`. Confirm `DIAG_RESULTS_ROOT` gained fresh run folders — empty means a test base class is missing the mandatory diagnostics setup (`wsbaser:union-testing`), fix that now rather than shipping an empty report. Print totals (total/passed/failed/skipped). All pass → Phase 9; failures → Phase 8.

Run **offline** — no live backend, no real credentials. Green only against a real backend = a missing mock → Gate C, not a pass. A selector timeout on a page that should have loaded is often an unmocked authed GET crashing the app — check the inventory before blaming the selector.

## Phase 8 — Gate C: Failures

DA analyzes the run: per failure → root cause (selector/timing/assertion/env/cross-track/framework/scenario-vs-app), owning agent, fix instructions. Dispatch fixes; re-run full suite (same command as Phase 7 — overwrites `TRX_PATH`/`STDOUT_LOG`); repeat from here. **Max 3 cycles**, then proceed with remaining failures noted. A failure tracing to scenario-vs-app mismatch → surface to user, don't force green.

## Phase 9 — Report + cleanup

1. `wsbaser:generate-e2e-test-report` (Skill tool): `--results DIAG_RESULTS_ROOT --features FEATURES_DIR --trx TRX_PATH --stdout STDOUT_LOG --since RUN_STARTED_AT --title "<scenario source>"`. Confirm parsed test count matches Phase 7/8's totals — mismatch (usually 0 tests) means `DIAG_RESULTS_ROOT`/`--since` is wrong; fix before handing over the report.
2. Print summary: scenarios · passed · failed · fix cycles · report path.
3. Shutdown every spawned agent (`devils-advocate`, `union-testing-reviewer`, `scaffold-*`, `track-N`) via `shutdown_request`; `TeamDelete` if the harness has it.

**Checklist:** summary printed · report generated via generate-e2e-test-report with non-zero parsed tests · shutdowns sent · team cleaned · scaffold + test files left uncommitted for review.
