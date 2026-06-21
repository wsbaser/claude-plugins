# Scaffold-Engineer Activation (Phase 4)

Sent to each `wsbaser:union-dev` scaffold builder. Each owns disjoint files from the manifest and builds shared surface only — never test classes. The scaffold runs in two ordered sub-stages, so there are **two variants**: send the **mock variant** in 4a, the **page-object variant** in 4b. Fill the bracketed slots from the manifest.

## Mock variant (Phase 4a)

```
MOCK SCAFFOLD ASSIGNMENT — [domain / endpoint group]

Test Project: [TEST_PROJECT_PATH]
Team: [TEAM_NAME]   (omit if single implicit team)
Mock system: [MOCK_SYSTEM — interception, mock location, offline-auth, catch-all;
  + path to the mocking guide/exemplar]

Build API MOCKS only — no page objects, no fixtures, no test classes.

Your endpoints (from the mock manifest, = Gate A inventory rows):
[per endpoint: status (mock-exists/mock-needed/repair), file path, controllable response,
 dependent scenarios]

Rules:
- Follow MOCK_SYSTEM exactly — same interception, location, offline-auth as the exemplar;
  no parallel style. Load wsbaser:union-testing if unsure.
- Cover every endpoint assigned to you + (catch-all owner only) a catch-all for stray
  authed GETs — else a landed page 401s into a crash. Mocked/offline only; never wire
  through to a live backend.
- Make seeded responses controllable (response builder / param), so scenarios can vary them.
- Reuse/extend existing mocks; do not duplicate. Search the project's mock directory first.
- Own ONLY your files. Need another group's file → report to lead, don't edit.

Report to lead: files created/modified; the controllable knobs each mock exposes
(implementers and page-object builders will rely on them); any endpoint you couldn't mock.
```

## Page-object variant (Phase 4b)

```
SCAFFOLD ASSIGNMENT — [page-object / fixture group]

Test Project: [TEST_PROJECT_PATH]
Team: [TEAM_NAME]   (omit if single implicit team)
Mock system: [MOCK_SYSTEM — interception, mock location, offline-auth, catch-all]
Frozen mocks: [MOCK_FILES — already built in 4a; the app renders offline against these.
  Consume, never rebuild a mock]

Build shared TEST SURFACE only — page objects, components, fixtures.
NO mocks (4a built them), NO test classes ([Test]/[TestFixture]); other stages own those.

Your artifacts (from the manifest):
[per artifact: status (new/extend/repair-stale), file path, members (locators+actions),
 verified selector per member]

Rules:
- Ground every selector in REAL source — open the component source, confirm it matches
  what renders. MOCK_FILES are live, so the page renders correctly: verify against rendered
  DOM, not a crash page. Never copy an existing selector unverified; repair any marked
  repair-stale (e.g. a grid selector targeting a control the page doesn't actually use).
- Reuse/extend existing primitives; do not duplicate. Search the project's existing
  page-object / fixture directories first.
- Follow framework conventions (load wsbaser:union-testing if unsure): [UnionInit],
  base classes, no raw Playwright where a primitive exists.
- Fixtures: make seeded state controllable (role param). A fixture/page object that needs an
  endpoint not in MOCK_FILES → report the mock gap to lead, don't add a live call.
- Own ONLY your files. Need another group's file → report to lead, don't edit.

Report to lead: files created/modified; public members each exposes (the API
implementers will use); any selector you couldn't verify, mock gap, or artifact the
manifest missed.
```
