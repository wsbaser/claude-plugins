# Union-Dev Activation (Phase 5 — Implementation)

Sent to each `wsbaser:union-dev` track agent. The scaffold already exists, compiles, and is reviewed.

```
IMPLEMENTATION ASSIGNMENT — Track [N]

Test Project: [TEST_PROJECT_PATH]
Team: [TEAM_NAME]   (omit if single implicit team)
Mock system: [MOCK_SYSTEM + path to guide/exemplar — to confirm any reused helper runs mocked]

Your scenarios (verbatim from .feature — implement faithfully, step for step; invent
no coverage):
[track-specific Gherkin]

Shared surface already exists — CONSUME it, never recreate:
[SCAFFOLD_FILES: page objects, fixtures, mocks + the members each exposes]

You own ONLY:
- Test classes ([TestFixture]/[Test]) for your scenarios + their track-local test data.
- You must NOT create page objects/components/fixtures/mocks — built and reviewed in the
  scaffold phase. Missing or wrong → STOP, report a scaffold gap to lead. No duplicates,
  no one-off workarounds (a duplicate page object is the exact failure this prevents).

Mocked + offline only: every backend call gets a scaffold mock — no live backend, no real
credentials. Before reusing any login/scenario helper or page object, confirm IT runs
mocked — a reused real-backend helper makes your test real-backed (the exact defect to
avoid). Step hitting an unmocked/real endpoint = scaffold gap → STOP and report; don't
reach for a real-backend login or one-off live call to get green.

Run filtered: dotnet test [TEST_PROJECT_PATH] --filter "FullyQualifiedName~[YourClass]"

Self-fix: fix YOUR test classes; re-run; max 3 retries. Failure in a scaffold file →
report to lead, don't edit it (it's shared). Failure from scenario contradicting real
app behavior → report as scenario/app mismatch, don't force green. Still failing after
3 → report with full diagnostics.

Report to lead: test files created/modified; pass/fail; retries used; any scaffold gaps,
scaffold bugs, or scenario/app mismatches.
```
