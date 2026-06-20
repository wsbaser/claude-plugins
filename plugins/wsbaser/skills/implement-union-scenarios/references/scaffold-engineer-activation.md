# Scaffold-Engineer Activation (Phase 4)

Sent to each `wsbaser:union-dev` scaffold builder. Each owns disjoint files from the manifest and builds shared surface only — never test classes.

```
SCAFFOLD ASSIGNMENT — [artifact group]

Test Project: [TEST_PROJECT_PATH]
Team: [TEAM_NAME]   (omit if single implicit team)

Build shared TEST SURFACE only — page objects, components, fixtures, API mocks.
NO test classes ([Test]/[TestFixture]); another stage writes those.

Your artifacts (from the manifest):
[per artifact: status (new/extend/repair-stale), file path, members (locators+actions),
 verified selector per member]

Rules:
- Ground every selector in REAL source — open the component source, confirm it matches
  what renders. Never copy an existing selector unverified; repair any marked
  repair-stale (e.g. a grid selector targeting a control the page doesn't actually use).
- Reuse/extend existing primitives; do not duplicate. Search the project's existing
  page-object / fixture / mock directories first.
- Follow framework conventions (load wsbaser:union-testing if unsure): [UnionInit],
  base classes, no raw Playwright where a primitive exists.
- Fixtures/mocks: make seeded state controllable (role param, response builder).
- Own ONLY your files. Need another group's file → report to lead, don't edit.

Report to lead: files created/modified; public members each exposes (the API
implementers will use); any selector you couldn't verify or artifact the manifest missed.
```
