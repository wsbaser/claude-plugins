---
name: wsbaser:union-testing
description: Enforces correct Union.Playwright.NUnit framework usage when writing, updating, or reviewing E2E tests, page objects, components, scenarios, mocks, or test infrastructure. MUST trigger whenever code imports Union.Playwright.NUnit types (UnionService, UnionPage, UnionTest, UnionInit, BrowserGo, BrowserState, ComponentBase, ContainerBase, ListBase, ItemBase, UnionElement, MatchablePage), creates or modifies .cs files in test projects that reference Union, or when the user mentions "Union framework", "E2E tests", "page objects", or "test automation" in the context of this .NET testing stack. Even if the task seems simple (adding one element to a page), this skill ensures the Union abstraction layer is used correctly.
---

# Union Framework Test Authoring

## Core Principle

**The framework owns object lifecycle.** Never manually instantiate page objects or components in test code. All creation and initialization flows through Union framework mechanisms:

- **Navigation**: `Go.ToPage<T>()` creates and returns page instances
- **State resolution**: `PageAs<T>()` retrieves the current page
- **Click-and-wait**: `ClickAndWaitForRedirectAsync<T>()`, `ClickAndWaitForAlertAsync<T>()`, `ClickAndWaitForAsync<T>()` return target objects
- **[UnionInit]**: Auto-initializes component fields when a page activates

**Never use `WebPageBuilder` in test code** — it is an internal framework class.

## No Raw Playwright in Tests

Test method bodies must never use raw Playwright APIs:
- No `page.GotoAsync()` — use `Go.ToPage<T>()` or `Go.ToUrl()`
- No `page.Locator()`, `GetByRole()`, `GetByTestId()`, `GetByLabel()` — use `[UnionInit]` fields
- No `page.ClickAsync()` for navigation — use `ClickAndWaitForRedirectAsync<T>()`

**In page object/component internals**, raw Playwright is allowed only for browser-level infrastructure not covered by Union (e.g., `EvaluateAsync` for JS execution, `WaitForLoadStateAsync`). Element interaction APIs are still not allowed — use `[UnionInit]` fields.

## Element Declaration

Every interactive element must be an `[UnionInit]`-annotated field with a CSS selector:

```csharp
[UnionInit("#username")]
public UnionElement EmailInput { get; set; }

[UnionInit(".theme-btn:has-text('Continue')")]
public UnionElement ContinueButton { get; set; }
```

**Selector priority** (use the highest-priority selector available in the markup):
1. aria attributes (`[aria-label='...']`, `[role='...']`)
2. data-testid (`[data-testid='...']`)
3. ID (`#myId`)
4. CSS class (`.my-class`)
5. Text-based (`text=...`, `:has-text('...')`)
6. `:has()` pseudo-selectors
7. Attribute selectors (`[attr='value']`)

When higher-priority selectors become available in the app markup (especially aria attributes), update existing selectors. Read `references/selector-strategy.md` for migration guidance.

## Navigation

| Intent | Method | Returns |
|--------|--------|---------|
| Navigate to a page | `Go.ToPage<T>()` | Page instance |
| Navigate to unmapped URL | `Go.ToUrl(url)` | void |
| Click triggers redirect | `element.ClickAndWaitForRedirectAsync<T>()` | Target page |
| Click opens modal | `element.ClickAndWaitForAlertAsync<T>()` | Modal instance |
| Click shows component | `element.ClickAndWaitForAsync<T>()` | Component instance |
| Check current page | `State.PageAs<T>()` | Page or null |
| Refresh / Back | `Go.Refresh()` / `Go.Back()` | void |

**Action-then-use**: Use the returned object directly. Do not verify with `PageIs<T>()` unless testing redirects or conditional logic. No manual `Actualize()` — it runs automatically.

**Happy path** uses `ClickAndWaitForRedirectAsync<T>()` — if redirect doesn't happen, let NullReferenceException fail the test naturally. **Validation tests** use plain `ClickAsync()` then assert error messages.

Read `references/navigation-state.md` for detailed patterns.

## Component Decision Tree

```
What are you modeling?
  ├─ Repeating list of items ──────→ ListBase<TItem>
  │    └─ Individual item ─────────→ ItemBase
  ├─ Group reused across pages ────→ ContainerBase
  ├─ Modal/dialog ─────────────────→ ComponentBase + IUnionModal
  ├─ Loading indicator ────────────→ ComponentBase + ILoader
  ├─ Overlay/popover ──────────────→ ComponentBase + IOverlay
  └─ Single-page elements ────────→ Flat [UnionInit] on parent (no new class)
```

Only create `ContainerBase` when the component is reused across pages. Nest as deep as the DOM requires — no artificial depth limit. All `ItemBase` fields must use `[UnionInit]`.

Read `references/component-patterns.md` for extending the framework with new types.

## Page Object Methods

- **Single-page operations** → action methods on the page object (`LoginAsync()`, `SelectCompanyAsync()`)
- **Multi-page workflows** → Scenario classes under `Infrastructure/Scenarios/`

Scenario classes are mandatory for any workflow reused across multiple test classes.

## Assertions

- **Element state** (visible, text, enabled): Playwright `Expect()` — auto-waits
- **Data/logic** (counts, booleans, strings): FluentAssertions (`.Should().Be()`)
- **No `Thread.Sleep()` / `Task.Delay()`** unless truly last resort (< 500ms, with comment explaining why)

## Test Infrastructure

Read `references/infrastructure.md` for:
- Test class structure (`UnionTest<TSession>`, `GetSessionProvider()`)
- Session and service registration (`ITestSession`, `AddScoped<>`)
- Mandatory SetUp steps (page capture, diagnostics, context timeout)
- API mock organization (one mock class per API domain)
- Diagnostics (mandatory: screenshot on failure, logging)
- DI patterns (`TestContextAccessor` bridge)
- Multi-service support (independent page hierarchies)

## Project Structure

```
Infrastructure/
  Union/           — UnionService, page base, test session, provider
  Configuration/   — Config loading, test settings
  Scenarios/       — Reusable multi-step workflows
  Mocks/           — API mock classes (one per API domain)
  Services/        — Backend API interaction
  Diagnostics/     — Test logging, artifact capture
  Fixtures/        — Test data definitions
Pages/             — Page objects organized by feature area
Tests/             — Test classes organized by feature area
```

## Blazor Apps

Read `references/blazor-guidance.md` for hydration waits, NetworkIdle fallback, and SignalR considerations.
