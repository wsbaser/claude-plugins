---
name: wsbaser:refactor-union-tests
description: Refactors EXISTING Union.Playwright.NUnit E2E tests, page objects, components, and mocks into compliance with wsbaser:union-testing rules and the project's own mocking system. Takes an AREA (path/folder/glob naming which tests to fix) and an optional FOCUS (what to prioritize — e.g. mocking, selectors, raw Playwright, test naming). No FOCUS → runs two parallel read-only auditors (framework compliance + mocking system compliance) and merges their findings; FOCUS given → runs one scoped auditor. Fixes are compliance-only: no new coverage, no changed assertions, no altered test intent — a violation whose fix would change what a test verifies is surfaced to the user, not silently applied. Captures a baseline test run before touching files and re-runs after, so any newly broken test is caught as a regression. ONLY invoke explicitly as /wsbaser:refactor-union-tests — it spawns an agent team and runs dotnet test, so never start it on its own; do NOT trigger on phrases like "clean up these tests" or "these tests look messy". Counterpart to wsbaser:implement-union-scenarios (which builds NEW tests from .feature files); this one repairs tests that already exist.
---

# Refactor Existing Union E2E Tests Into Compliance

Existing test classes/page objects/mocks → the same files, framework-compliant. No new scenarios, no new assertions, no coverage added or removed — only how the test is written changes, never what it verifies. A fix that can't preserve test intent is a finding to raise with the user, not a rewrite to force through.

**Two parts:** an **analysis** pass (read-only, finds violations) and a **fix** pass (disjoint-file groups, reviewed, build-gated, regression-checked) — mirrors `implement-union-scenarios`'s scaffold/implement split, except the analysis pass reads code instead of building a manifest from Gherkin.

**Mocking conformance is mandatory, not optional.** Every fix — even a pure selector repair — must keep the file working against the project's existing mocking system (discovered in Pre-flight). Don't invent a parallel mocking style; don't make a fix that quietly starts hitting a live backend.

**No regression, ever.** A test passing before this skill touches its file must still pass after. This is checked mechanically (baseline run vs. re-run), not assumed.

## Pre-flight

1. **Area.** Arg = path, folder, or glob naming which tests to refactor (`AREA`). No arg → ask (`AskUserQuestion`), don't guess. Resolve to a concrete file list — the test classes themselves, plus every page object/component/mock they reference — → `TARGET_FILES`. Print file count.
2. **Focus (optional).** Arg 2 = free text naming what to prioritize (`FOCUS`) — e.g. "mocking", "raw Playwright in page objects", "selectors", "test naming". Absent → full sweep (Phase 1 runs two auditors). Present → Phase 1 runs one scoped auditor.
3. **Project.** Resolve test `.csproj` → `TEST_PROJECT_PATH`: CLAUDE.md first; else glob `*.E2E*.csproj` / `*.AutoTests.csproj` / `*.Tests.csproj`; multiple or none → ask.
4. **Mock system.** Same discovery as `implement-union-scenarios`: the mocking guide, the reference mock implementation, per-domain mock classes, how a guarded route authenticates offline. Capture → `MOCK_SYSTEM`. Needed regardless of `FOCUS` — every fix must conform to it, not only a dedicated mocking pass. No mocking system at all → say so, confirm approach with the user before fixing anything mock-related.
5. **Baseline run.** Before touching any file:
   ```bash
   dotnet test [TEST_PROJECT_PATH] --filter "<TARGET_FILES test classes, FQN~ORed>"
   ```
   Capture pass/fail per test → `BASELINE_RESULTS`. This is the regression contract for Phase 5: anything green now must stay green; anything already red is pre-existing and out of scope — don't chase it under this skill.

## Phase 1 — Analyze (read-only)

**No `FOCUS`** → spawn two subagents in parallel (`Agent subagent_type:"default"` — read-only tools, no Write/Edit), templates in `references/auditor-activation.md`:
- **framework-auditor** — loads `wsbaser:union-testing` (Skill tool), reads every file in `TARGET_FILES`, reports violations against the full Test Authoring Checklist + Page Object & Component Checklist: raw Playwright in test or page-object/component bodies, elements not declared `[UnionInit]`, `Assertions.Expect(...)` misuse, `WaitForXxx`-before-`Expect` anti-pattern, test naming not subject-first, missing AAA markers, test classes inheriting `UnionTest<TSession>` directly, component decision-tree misuse, selectors that don't match the real rendered markup.
- **mocking-auditor** — independently (re)confirms `MOCK_SYSTEM`, then checks `TARGET_FILES` for: endpoints hit without a controllable mock, live fall-through (an unmocked authed call reaching the real backend), mock style diverging from the project's exemplar (wrong interception mechanism, wrong location, no offline-auth), missing catch-all for stray authed calls, duplicate mock classes for one domain.

**`FOCUS` given** → spawn one subagent scoped to that concern only (same file, focused-auditor variant) — still loads `wsbaser:union-testing` for reference but filters findings to the named focus.

Every variant returns a **structured findings list** (file, line, rule cited, snippet, suggested fix, severity, and — critically — a flag if applying the fix would change what the test verifies) rather than prose, so Phase 2 can merge mechanically.

## Phase 2 — Aggregate + confirm

Merge the subagent finding list(s) into one deduped **Violation Manifest** (dedup by file+line — the same stale selector or missing `[UnionInit]` shouldn't appear twice because both auditors happened to notice it). Print the manifest: file · line · rule · severity · fix summary.

Any finding flagged "fix changes test intent" gets called out by name — `AskUserQuestion` whether to apply it, skip it, or have the user resolve it manually. Don't proceed past this phase with an unresolved intent-changing finding.

## Phase 3 — Team + partition

- `TaskCreate` per track once the manifest is grouped into **disjoint-file** fix tracks (max 7, prefer small — a track never spans a file another track owns; a shared file used by two tracks' findings becomes one track).
- Spawn two persistent reviewers, addressed by `name` via `SendMessage`:
  - `union-testing-reviewer` (`Agent subagent_type:"default"`) — same activation as `implement-union-scenarios` Phase 4a: loads `wsbaser:union-testing`, checks every fix against its rules and `MOCK_SYSTEM` conformance. Per violation: file:line, rule cited, snippet, fix, owning agent. Max 2 review cycles per track, then report remainder to lead.
  - `regression-reviewer` (`wsbaser:regression-reviewer` agent) — checks each track's diff preserves original test behavior: same assertions, same scenario coverage, same pass/fail semantics — only the framework usage changed. Flags any diff that silently drops or alters what's verified.

## Phase 4 — Fix (by disjoint file group)

One `wsbaser:union-dev` per track (`name: fix-<n>`), activation template `references/fix-engineer-activation.md`. Each owns disjoint files from the manifest, fixes in place — never rewrites scenario logic, never adds/removes assertions — and must **STOP and report**, not force a fix, when a violation can't be resolved without changing what the test verifies.

- **Incremental review:** as each track reports, send both reviewers its file list; don't block other tracks.
- **Build gate:** `dotnet build [TEST_PROJECT_PATH]` — max 2 build-fix cycles.
- **Freeze** → `FIXED_FILES` once both reviewers approve and the build is clean.

## Phase 5 — Regression run + fix cycles

```bash
dotnet test [TEST_PROJECT_PATH] --filter "<same filter as baseline>" --logger "trx;LogFileName=refactor-[RUN_STARTED_AT].trx" --results-directory ".reports/testresults"
```

Compare against `BASELINE_RESULTS` test-by-test:
- **Was passing, now failing** → regression introduced by this refactor. Dispatch to the owning track's `union-dev`; re-run; max 3 cycles (same pattern as Gate C in `implement-union-scenarios`).
- **Was failing, still failing** → pre-existing, noted, not chased.
- **Was failing, now passing** → possible, note it, but don't treat it as required — this skill doesn't hunt for coverage improvements.

All target tests either match baseline or are explicitly noted → proceed to Phase 6.

## Phase 6 — Report + cleanup

Print: `AREA` · `FOCUS` (or "full sweep") · violations found/fixed (by rule) · violations deferred to user (intent-changing) · build status · before/after test totals · fix cycles used · list of `FIXED_FILES`.

Shutdown spawned agents (`union-testing-reviewer`, `regression-reviewer`, `fix-*`) via `shutdown_request`; `TeamDelete` if the harness has it. Leave changed files uncommitted for user review.

**Checklist:** manifest printed and confirmed · no unresolved intent-changing finding applied silently · build clean · regression comparison shows no newly-broken test (or each is explicitly noted as accepted) · summary printed · files left uncommitted.
