---
name: wsbaser:union-testing
description: Enforces Union.Playwright.NUnit framework usage in E2E tests, page objects, components, mocks, and test infrastructure. Use when code imports Union types, when working in Union test projects (.cs files), or when the user mentions Union, E2E testing, page objects, or test automation.
---

# Union Framework Test Authoring

## Core Principle

**The framework owns object lifecycle.** Never manually instantiate page objects or components in test code. All creation and initialization flows through Union framework mechanisms:

- **Navigation**: `Go.ToPage<T>()` creates and returns page instances
- **State resolution**: `PageAs<T>()` retrieves the current page
- **Click-and-wait**: `ClickAndWaitForRedirectAsync<T>()`, `ClickAndWaitForAlertAsync<T>()`, `ClickAndWaitForAsync<T>()` return target objects
- **[UnionInit]**: Auto-initializes component fields when a page activates

**Never use `WebPageBuilder` in test code** — it is an internal framework class.

A modal opened by a click is obtained with `element.ClickAndWaitForAlertAsync<TDialog>()`, never `new TDialog(...)`. This holds even when existing code hand-constructs the dialog with a comment explaining why `[UnionInit]` is null on it — that comment documents a violation, it does not sanction it. The real fix is to make `TDialog` a `ComponentBase + IUnionModal` so the framework constructs and actualizes it (which also restores its own `[UnionInit]` elements). Matching the surrounding `new`-everywhere style is not a reason to repeat it.

## No Raw Playwright — Tests AND Component Internals

The ban applies everywhere: test bodies, page object methods, and component methods. Raw element APIs bypass the Union initialization chain and `Expect()` auto-retry, so they are forbidden no matter where they appear.

Banned element APIs (use `[UnionInit]` fields instead): `Locator(...)`, `GetByRole/GetByTestId/GetByLabel(...)`, `.Nth(...)`, `.First`, `.All*Async()`, `.ClickAsync()`, `.FillAsync()`, `.WaitForAsync()`, `.IsVisibleAsync()`, `.TextContentAsync()`. Navigation: no `page.GotoAsync()` — use `Go.ToPage<T>()` / `Go.ToUrl()`.

The **only** raw Playwright allowed inside page-object/component internals is browser-level infrastructure Union does not model: `EvaluateAsync` (JS execution), `WaitForLoadStateAsync`. Everything that touches an element goes through `[UnionInit]`.

```csharp
// WRONG — raw locator chain by row index inside a page-object method
var btn = RootLocator.Locator("tbody tr").Nth(rowIndex).Locator(".button[.fa-split]");
await btn.WaitForAsync(...);
await btn.ClickAsync(new() { Force = true });

// CORRECT — model the repeating row as a parameterized ContainerBase (see component-patterns.md),
// expose the button as [UnionInit], and let the framework open the modal
public LineRow Row(int rowIndex) => new(_page, rowIndex);
await Row(rowIndex).SplitButton.ClickAndWaitForAlertAsync<SplitLineDialog>();
```

### Tidying a banned call is not fixing it

A raw element call is a structural violation, not a style nit. Removing `Force = true`, deleting a redundant `WaitForAsync`, or renaming variables leaves the violation in place — the call is still raw Playwright. The fix is always to **replace** the raw call with a `[UnionInit]` field (and a component for repeating elements), never to clean it up in place. If a proposed "minimal fix" still contains `.Locator(...)`/`.ClickAsync()`/`new SomeDialog(...)`, it is not a fix — do not offer it as an option.

## Element Declaration

Every interactive/assertable element must be a `[UnionInit]`-annotated `UnionElement` property — **never expose raw `ILocator` from page objects or components**. Raw `ILocator` bypasses the Union initialization chain and breaks `Expect()` auto-retry semantics.

```csharp
// CORRECT: UnionElement with [UnionInit]
[UnionInit("#username")]
public UnionElement EmailInput { get; set; }

[UnionInit(".theme-btn['Continue']")]
public UnionElement ContinueButton { get; set; }

// WRONG: Raw ILocator exposed from page object
public ILocator EmailInput => Page.Locator("#username");
```

Selectors use XCSS syntax — not CSS pseudo-classes or Playwright selector strings. Invoke `wsbaser:generate-selectors` to generate new selectors or validate and fix existing ones — it reads the markup and returns a named list of XCSS selectors for use in `[UnionInit]` attributes.

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
  ├─ Reusable sub-component ───────→ ContainerBase (composed into pages/dialogs)
  ├─ Repeating elements, not a list → ContainerBase (parameterized, see component-patterns.md)
  ├─ Modal/dialog ─────────────────→ ComponentBase + IUnionModal
  ├─ Loading indicator ────────────→ ComponentBase + ILoader
  ├─ Overlay/popover ──────────────→ ComponentBase + IOverlay
  └─ Single-page elements ────────→ Flat [UnionInit] on parent (no new class)
```

The decision tree is the primary guide. Reuse count is one signal, not the gating rule — a list used on one page is still `ListBase<T>`; a cohesive sub-component on one page is still `ContainerBase`.

**Inherit `ListBase<T>` only when the list IS the whole component.** If the class also owns non-list elements (summary, header, action buttons, totals), it `HAS-A` list — it is not one. Make it a `ContainerBase` with a nested `[UnionInit] FooList List` field. Test: any element that isn't a row or row-enumerator means `ContainerBase`, not `ListBase<T>`.

**ContainerBase vs ComponentBase**: `ContainerBase` scopes child selectors via the `root:` prefix and is the right choice for any semantically distinct sub-component composed into a page or dialog. `ComponentBase` is for top-level wrappers (modals, loaders, overlays) that don't scope child selectors. **Do not use `ComponentBase` for reusable element groups** — use `ContainerBase`. Nest as deep as the DOM requires — no artificial depth limit. All `ItemBase` fields must use `[UnionInit]`.

**[UnionInit] compatibility rule**: `[UnionInit]` properties must inherit from a Union base class (`ContainerBase`, `ComponentBase`, `ListBase<T>`, or `ItemBase`). Plain classes are invisible to the initialization chain — `[UnionInit]` will silently leave them `null`.

**`root:` + union selectors don't mix**: Never use a comma-separated union like `[UnionInit("root:a, root:b")]` — the framework scopes only the first alternative, and subsequent alternatives silently match page-globally. Split into separate `[UnionInit]` fields instead.

Read `references/component-patterns.md` for extending the framework with new types and a plain-class anti-pattern example.

## Reusable Parameterized Components

When the same inner-element shape and behavior recur across multiple instances — cells in a row, tiles on a dashboard, repeated form sections — extract them into a parameterized `ContainerBase`. The constructor takes a value (a key, an index), builds the full scoped selector from it, and passes it to `base(...)`. Each parent declaration carries just the value in its `[UnionInit]` attribute.

See "Parameterized `ContainerBase`" in `references/component-patterns.md` for the full example and rationale.

## Page Object Methods

- **Single-page operations** → action methods on the page object (`LoginAsync()`, `SelectCompanyAsync()`)
- **Multi-page workflows** → Scenario classes under `Infrastructure/Scenarios/`
- **Action methods must wait for their own completion internally** — e.g., waiting for a spinner to disappear, a network call to finish, or a field to populate before returning. The caller (test) should never need to add waits after calling an action method.

Scenario classes are mandatory for any workflow reused across multiple test classes.

## Assertions

- **Element state** (visible, text, enabled, checked): `Expect(unionElement)` — auto-retries until timeout
- **Data/logic** (counts, booleans, computed strings): FluentAssertions (`.Should().Be()`)
- **Never use `IsVisibleAsync()` / `TextContentAsync()` for assertions** — these are instant checks with no retry. Use `Expect(element).ToBeVisibleAsync()` / `Expect(element).ToHaveTextAsync()` instead.
- **No `Thread.Sleep()` / `Task.Delay()`** unless truly last resort (< 500ms, with comment explaining why)

### Use `Expect(...)`, never `Assertions.Expect(...)`

Never call `Assertions.Expect(element.RootLocator)` or `Assertions.Expect(locator)` directly. `Expect` is available in two contexts with different signatures:

- **In tests** (`UnionTest<TSession>` subclasses): `public static Expect(UnionElement)` — accepts a `UnionElement`
- **In components** (`ComponentBase` subclasses): `protected static Expect(ComponentBase)` — accepts a `ComponentBase` subclass (e.g., a nested component)

```csharp
// CORRECT — in a test; Expect takes UnionElement
await Expect(loginPage.EmailInput).ToBeVisibleAsync();

// CORRECT — inside a ComponentBase subclass; Expect takes a ComponentBase
public sealed class FormRow : ContainerBase
{
    [UnionInit]
    public ErrorToast Toast { get; set; }  // ErrorToast : ComponentBase

    public async Task WaitForErrorAsync()
    {
        await Expect(Toast).ToBeVisibleAsync();
    }
}

// WRONG — bypasses Union wrapper; never use Assertions.Expect directly
await Assertions.Expect(loginPage.EmailInput.RootLocator).ToBeVisibleAsync();
await Assertions.Expect(page.Locator("#email")).ToBeVisibleAsync();
```

### Anti-pattern: WaitForXxx before Expect()

**Never create `WaitForXxx` methods whose purpose is to pre-wait before an `Expect()` assertion.** `Expect()` already auto-retries until the condition is met — adding a wait before it is redundant.

```csharp
// WRONG — redundant wait before assertion
await dialog.WaitForIsatCodePopulatedAsync();
await Expect(dialog.IsatCodeMask).Not.ToBeEmptyAsync();

// CORRECT — Expect() auto-retries, no pre-wait needed
await Expect(dialog.IsatCodeMask).Not.ToBeEmptyAsync();
```

Waits inside **action methods** are fine — e.g., `EnterSsnAndSearchAsync()` waiting for a spinner to disappear before returning. The anti-pattern applies only to waits that exist solely to pre-wait before an assertion.

## Test Naming

Test names follow the pattern `{Subject}_{WhenCondition}_{ExpectedOutcome}`. The **subject is always first** — it determines alphabetical grouping, so tests about the same subject must share the same prefix. A fourth segment is allowed when two independent conditions both need to be named; prefer three segments when one condition can be expressed as a qualifier on the subject or outcome.

**Rule: start with the entity under test, not with qualifiers or context.**

Qualifiers (delisted, invalid, missing) and context (edit mode, create mode) belong in the middle segment, never at the start.

```csharp
// CORRECT — subject first, qualifier in the middle
public async Task CompanySsn_WhenFoundDelisted_SetsActiveToggleOff() { }
public async Task CompanySsn_InEditMode_WhenFoundDelisted_DoesNotChangeIsActiveStatus() { }
public async Task CompanySsn_WhenIsatCodeUnresolvable_LeavesIsatCodeEmpty() { }
public async Task IndividualSsn_WhenFound_FillsNameAndAddressOnly() { }
public async Task SsnNotFound_ShowsWarningTooltipAndLeavesNameEmpty() { }

// WRONG — qualifier before subject; breaks grouping
public async Task DelistedCompanySsn_WhenFound_SetsActiveToggleOff() { }
public async Task EditMode_RegistrySearchWithDelistedCompany_DoesNotChangeIsActiveStatus() { }
```

Sorted alphabetically, the correct names cluster naturally:
1. `CompanySsn_InEditMode_...`
2. `CompanySsn_WhenFound_...`
3. `CompanySsn_WhenFoundDelisted_...`
4. `CompanySsn_WhenIsatCodeUnresolvable_...`
5. `IndividualSsn_WhenFound_...`
6. `SsnNotFound_...`

For the registry/SSN domain in this project, the agreed subject prefixes are:
- `CompanySsn_` — any test driven by a company SSN (including delisted, unresolvable, edit mode)
- `IndividualSsn_` — tests driven by an individual/person SSN
- `SsnNotFound_` — tests for a not-found registry response (applies to any SSN type)

**Applying this to other domains:** the same rule holds everywhere. If tests cover "expired token" and "valid token" scenarios, both should start with `Token_` — not `ExpiredToken_` vs `Token_`. Put the distinguishing condition in the middle segment.

## Test Body Structure

Mark the three phases with `// .Arrange`, `// .Act`, `// .Assert` comments. Omit a phase's comment only when that phase is empty. Each marker may carry a short summary of what the block does: `// .Act - <summary>`.

```csharp
public async Task CompanySsn_WhenFound_FillsName()
{
    // .Arrange - open the registry page
    var page = await SO.Go.ToPage<RegistryPage>();

    // .Act - search by company SSN
    await page.EnterSsnAndSearchAsync("1234567890");

    // .Assert - name field populated from registry
    await Expect(page.NameInput).ToHaveValueAsync("Acme Ltd");
}
```

## Test Authoring Checklist

Before committing a new test, verify:

- **No manual instantiation** — page objects and components are obtained only via `Go.ToPage<T>()`, `ClickAndWaitForRedirectAsync<T>()`, or `[UnionInit]`; never `new`
- **Elements declared with `[UnionInit]`** — no raw `ILocator` properties exposed from page objects or components
- **Navigation via Union methods** — `Go.ToPage<T>()` or `ClickAndWaitForAsync<T>()`; no `page.GotoAsync()`
- **Assertions use `Expect(...)`** — no `Assertions.Expect(...)` calls anywhere (in tests or component methods); no `WaitForXxx` immediately before an `Expect()` call; no `IsVisibleAsync()` / `TextContentAsync()` for assertions
- **Test name is subject-first** — follows `{Subject}_{WhenCondition}_{ExpectedOutcome}`; qualifiers never lead
- **Body marked AAA** — `// .Arrange`, `// .Act`, `// .Assert` comments delimit the three phases (optional `- <summary>` suffix)
- **Test class inherits from service base** — never directly from `UnionTest<TSession>`; a service-specific base class (e.g., `StackOverflowTestBase`) owns `GetSessionProvider()` and exposes service shorthand properties

## Page Object & Component Checklist

The test-body rules above are not enough — most violations hide inside page-object and component methods. Before committing one, verify:

- **No raw element API** — no `Locator(...)`, `.Nth(...)`, `.First`, `.All*Async()`, `.ClickAsync()`, `.FillAsync()`, `.WaitForAsync()`, `.IsVisibleAsync()`, `.TextContentAsync()` anywhere in the method body. Only `EvaluateAsync` / `WaitForLoadStateAsync` are exempt.
- **Every element is a `[UnionInit]` field** — including elements addressed by row index (model the row as a parameterized `ContainerBase`, not `.Nth(i)`).
- **Modals via `ClickAndWaitForAlertAsync<T>()`** — no `new TDialog(...)`, even with a justifying comment.
- **A "minimal fix" that keeps a raw call is rejected** — replacing the primitive is the only fix; tidying it (dropping `Force`, removing a redundant wait) is not.

## Test Infrastructure

Every service needs a **service-specific base test class**. Test classes must never inherit directly from `UnionTest<TSession>` — the base class is mandatory because it:
- Implements `GetSessionProvider()` once, preventing repetition across every test class
- Exposes each service as a `protected` shorthand property so tests write `SO.Go` instead of `Session.SO.Go`

```csharp
// CORRECT — test class inherits from service base
public class StackOverflowTests : StackOverflowTestBase { }

// WRONG — direct inheritance from UnionTest<TSession>
public class StackOverflowTests : UnionTest<StackOverflowTestSession> { }
```

Read `references/infrastructure.md` for:
- Base test class pattern (mandatory, with shorthand properties)
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
