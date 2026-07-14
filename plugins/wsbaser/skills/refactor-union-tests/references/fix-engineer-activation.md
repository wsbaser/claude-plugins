# Fix-Engineer Activation (Phase 4)

Sent to each `wsbaser:union-dev` fixer. Each owns a disjoint set of files from the Violation Manifest and repairs them in place — never rewrites scenario logic, never adds or removes assertions or coverage. Fill the bracketed slots from the manifest.

```
REFACTOR ASSIGNMENT — Track [N]

Test Project: [TEST_PROJECT_PATH]
Team: [TEAM_NAME]   (omit if single implicit team)
Mock system: [MOCK_SYSTEM — interception, mock location, offline-auth, catch-all;
  + path to the mocking guide/exemplar]

Fix EXISTING files only — no new page objects, no new mocks, no new test classes, no new
scenarios. Every file below already exists and already passes (or already fails for a
reason unrelated to your fix — see baseline note per file).

Your violations (from the manifest):
[per violation: file, line, rule violated, snippet, suggested fix, severity]

Rules:
- Fix framework compliance ONLY. The test must verify the exact same thing after your fix
  as before it — same assertions, same scenario coverage, same pass/fail semantics. If a
  violation's only fix would require dropping an assertion or changing what's verified
  (manifest marks this intent_risk: true), STOP and report to lead instead of applying it —
  do not force a "fix" that changes test meaning.
- Conform to MOCK_SYSTEM exactly for any mocking-related fix — same interception, location,
  offline-auth as the exemplar; no parallel style. Load wsbaser:union-testing if unsure of
  any rule.
- Reuse existing shared primitives (page objects, components, scenarios, fixtures) — a
  compliance fix is never an excuse to fork a duplicate. Search the project's existing
  directories before creating anything new (and if you find yourself about to create a
  file, stop — this phase repairs files, it does not scaffold new ones).
- Selectors: don't blindly keep an existing [UnionInit] value — if the manifest flags it
  stale, re-verify against the real rendered markup/component source before fixing it.
- Own ONLY your files. Need to touch another track's file → report to lead, don't edit it.

Run filtered: dotnet test [TEST_PROJECT_PATH] --filter "FullyQualifiedName~[YourClass]"

Self-fix: fix issues in YOUR files; re-run; max 3 retries. A failure that traces to a
scenario/app mismatch (the test was already wrong about real app behavior) → report to
lead as such, don't force green by changing what's asserted.

Report to lead: files modified; violations fixed vs. violations you stopped on
(intent_risk) with why; pass/fail before/after your fix; retries used.
```
