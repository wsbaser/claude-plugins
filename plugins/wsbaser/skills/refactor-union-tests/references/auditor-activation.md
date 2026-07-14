# Auditor Activation (Phase 1)

Sent to each read-only analysis subagent (`Agent subagent_type:"default"`). Auditors never write or edit — they return a structured findings list. Three variants: **framework-auditor** and **mocking-auditor** run together when no `FOCUS` is given; **focused-auditor** runs alone when `FOCUS` is given.

## Framework-auditor variant (no FOCUS)

```
FRAMEWORK COMPLIANCE AUDIT — read-only, no edits

Target files: [TARGET_FILES]
Test project: [TEST_PROJECT_PATH]

SETUP: load the wsbaser:union-testing skill (Skill tool) — your single source of truth.

Read every file in Target files in full. Check ALL rules: raw Playwright in test bodies
AND page-object/component methods (Locator/.Nth/.First/.ClickAsync/.FillAsync/.WaitForAsync/
.IsVisibleAsync/.TextContentAsync — only EvaluateAsync/WaitForLoadStateAsync exempt),
elements not declared as [UnionInit] UnionElement (raw ILocator exposed), manual
instantiation of page objects/components/dialogs via `new`, Assertions.Expect(...) instead
of Expect(...), WaitForXxx-before-Expect anti-pattern, IsVisibleAsync/TextContentAsync used
for assertions, test names that aren't subject-first, missing // .Arrange / .Act / .Assert
markers, test classes inheriting UnionTest<TSession> directly instead of a service base,
component decision-tree misuse (ListBase<T> that HAS-A list, ComponentBase used for a
reusable element group instead of ContainerBase), [UnionInit] on a plain class, comma-union
selectors combined with root:.

Selectors: don't take an existing [UnionInit] value on faith — cross-check it against the
component source/markup the page object claims to represent. A selector that targets a
control the page doesn't actually render is a stale-selector violation.

Return one entry per violation:
- file, line
- rule violated (cite the union-testing section)
- snippet (the offending code)
- suggested fix
- severity (critical/warning)
- intent_risk: true if applying the fix would change what the test verifies (e.g. a
  "fix" that would require dropping an assertion because the framework-correct path can't
  reach that state) — false otherwise. When true, explain why in one line.

Do not fix anything. Do not skip a file because it "looks fine" — read it fully.
Report the complete findings list to lead.
```

## Mocking-auditor variant (no FOCUS)

```
MOCKING SYSTEM COMPLIANCE AUDIT — read-only, no edits

Target files: [TARGET_FILES]
Test project: [TEST_PROJECT_PATH]
Mock system (as discovered by lead): [MOCK_SYSTEM — interception mechanism, mock location,
  offline-auth approach, catch-all pattern, path to the mocking guide/exemplar]

Independently confirm MOCK_SYSTEM still holds (read the guide/exemplar yourself) before
auditing against it — don't trust the summary blindly.

For every file in Target files, check:
- Every backend call the file's tests provoke (step-driven, page-load lookups, auth) has a
  controllable mock — not a live call reaching a real backend.
- No live fall-through: an unmocked authed route silently 401s/crashes rather than being
  caught by a catch-all.
- Mock style matches the project's own exemplar — same interception API, same file
  location convention, same offline-auth technique. A mock that reinvents its own style is
  a violation even if it technically works.
- One mock class per API domain — no duplicate mock classes covering the same domain.
- Seeded responses are controllable (parameterized), not hardcoded in a way that blocks
  reuse across scenarios.

Return one entry per violation, same shape as the framework-auditor:
- file, line, rule violated (describe the MOCK_SYSTEM expectation violated), snippet,
  suggested fix, severity, intent_risk (true only if the fix would change what a test
  verifies — a pure mocking-mechanism fix is normally intent_risk: false).

Do not fix anything. Report the complete findings list to lead.
```

## Focused-auditor variant (FOCUS given)

```
FOCUSED COMPLIANCE AUDIT — read-only, no edits
Focus: [FOCUS]

Target files: [TARGET_FILES]
Test project: [TEST_PROJECT_PATH]
Mock system (for reference, in case Focus touches it): [MOCK_SYSTEM]

SETUP: load the wsbaser:union-testing skill (Skill tool) for full context, but filter your
findings to violations relevant to Focus only. Do not report unrelated violations you
happen to notice — note them in one line as "out of scope for this pass" instead, so
nothing is silently lost but the manifest stays focused.

Read every file in Target files in full.

Return one entry per in-scope violation: file, line, rule violated, snippet, suggested fix,
severity, intent_risk (true if the fix would change what the test verifies).

Do not fix anything. Report the complete findings list (plus the out-of-scope note) to lead.
```
