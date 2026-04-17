# Component Patterns

## Contents

- [Choosing the Right Base Class](#choosing-the-right-base-class)
- [Creating New Component Types](#creating-new-component-types)
- [Component Nesting](#component-nesting)
- [MatchablePage](#matchablepage)

## Choosing the Right Base Class

### ComponentBase — Simple Wrappers

Use for components that need visibility checking and a root element but don't scope child selectors.

```csharp
public sealed class ToastComponent : ComponentBase
{
    [UnionInit(".toaster__icon--success")]
    public UnionElement SuccessToast { get; set; }

    [UnionInit(".toaster__icon--error")]
    public UnionElement ErrorToast { get; set; }

    public async Task WaitForSuccessToastAsync(int timeoutMs = 10000)
    {
        await Expect(SuccessToast).ToBeVisibleAsync(
            new() { Timeout = timeoutMs });
    }
}
```

Use `ComponentBase + IUnionModal` for dialogs:

```csharp
public sealed class CompanyListDialog : ComponentBase, IUnionModal
{
    public override string RootScss => ".company-content-wrap.slider-select-company";

    [UnionInit]
    public CompanySelectionComponent Selection { get; set; }

    public async Task AcceptAsync() => await Selection.ContinueButton.ClickAsync();
    public async Task DismissAsync() => await Selection.CancelButton.ClickAsync();
}
```

### ContainerBase — Semantically Distinct Sub-components

Use for any semantically distinct sub-component composed into a page or dialog — a `ListBase<T>` on a single page is still the right choice if the DOM represents a list/table, and a `ContainerBase` is the right choice any time a chunk of the page forms a cohesive unit with its own elements and behavior. Reuse across pages is one reason to reach for `ContainerBase`, not the only one. The constructor receives `(IUnionPage parentPage, string rootScss)` — the framework calls this automatically via `[UnionInit]`. The `root:` prefix scopes child selectors relative to the container's root.

```csharp
public sealed class CompanySelectionComponent : ContainerBase
{
    public CompanySelectionComponent(IUnionPage parentPage)
        : base(parentPage, ".select-company-wrapper") { }

    [UnionInit("root:input[type='search']")]
    public UnionElement SearchInput { get; set; }

    [UnionInit("root:.theme-btn:has-text('Continue')")]
    public UnionElement ContinueButton { get; set; }

    [UnionInit]
    public CompanyList Companies { get; set; }

    public async Task SearchAsync(string query)
    {
        await SearchInput.FillAsync(query);
    }

    public async Task SelectCompanyByNameAsync(string name)
    {
        var item = Companies.CreateItem(name);
        await item.ClickAsync();
    }
}
```

The `root:` prefix **only works inside `ContainerBase` and `ListBase` subclasses**. On regular `ComponentBase` or pages, `root:` passes through as a literal string.

#### Common Pitfalls

**Constructor signature** — `ContainerBase` takes `(IUnionPage parentPage, string rootScss)`, not `(IContainer, string)`. Always pass `IUnionPage` as the first argument:

```csharp
// WRONG: IContainer is not the correct parameter type
public CompanySelectionComponent(IContainer parent)
    : base(parent, ".select-company-wrapper") { }  // does not compile

// CORRECT: Use IUnionPage
public CompanySelectionComponent(IUnionPage parentPage)
    : base(parentPage, ".select-company-wrapper") { }
```

**IContainer limitation** — `ComponentBase` does **not** implement `IContainer`. You cannot pass `this` from a parent `ComponentBase` to a child that expects `IContainer`:

```csharp
// WRONG: ComponentBase does not implement IContainer
public sealed class MyDialog : ComponentBase
{
    public MyDialog(IUnionPage page) : base(page, ".dialog") { }

    // Cannot pass 'this' — ComponentBase is not IContainer
    public MyPanel Panel => new MyPanel(this, ".panel");  // compile error
}
```

**Pass-through pattern** — When a `ContainerBase` child needs the same scope as its parent, use `[UnionInit(".same-root-selector")]` on the parent. The framework passes the page and selector to the child's constructor automatically:

```csharp
public sealed class ParentDialog : ComponentBase, IUnionModal
{
    // Framework calls constructor with (page); child scopes itself via base(parentPage, ".select-company-wrapper")
    [UnionInit(".select-company-wrapper")]
    public CompanySelectionComponent Selection { get; set; }
}
```

#### Parameterized `ContainerBase` — one component, many instances

When the same inner-element shape and behavior recur across many parent declarations (cells in a row, tiles on a dashboard, sections in a form), let each parent declaration supply just the varying values. The constructor takes `(IUnionPage parentPage, …)` plus any number of additional parameters; `[UnionInit(...)]` arguments map 1:1 to those parameters after `parentPage`. The component uses them however it needs — most commonly to build the root selector passed to `base(...)`, but equally to shape inner selectors, behavior methods, assertions, or per-instance state.

```csharp
// ToggleCardComponent.cs — one file per class
public sealed class ToggleCardComponent : ContainerBase
{
    public ToggleCardComponent(IUnionPage parentPage, string featureKey)
        : base(parentPage, $".feature-card[data-feature='{featureKey}']") { }

    [UnionInit("root:.card-title")]
    public UnionElement Title { get; set; }

    [UnionInit("root:.toggle-switch")]
    public UnionElement Switch { get; set; }

    public Task ToggleAsync() => Switch.ClickAsync();
}

// Parent: each card is one line, varying only in the [UnionInit] value
public class SettingsDashboardPage : AppPage
{
    [UnionInit("notifications")]
    public ToggleCardComponent NotificationsCard { get; set; }

    [UnionInit("darkMode")]
    public ToggleCardComponent DarkModeCard { get; set; }

    [UnionInit("betaAccess")]
    public ToggleCardComponent BetaAccessCard { get; set; }
}
```

The parent carries only the irreducible varying value. If the constructor signature changes, the compiler forces every caller to update — a guarantee the full-selector-in-attribute style does not provide.

**Parameters aren't limited to strings — prefer typed parameters whenever the value is semantically not a string.** `[UnionInit]` forwards its arguments untouched to the constructor, so any C# attribute-legal value works: primitives (`int`, `bool`, `double`, `char`), `enum` values, `typeof(T)`, 1-D arrays, and `null`. A typed parameter keeps call sites type-safe and avoids `.ToString()` / `Enum.Parse` noise inside the component. The only limit is the C# rule that attribute arguments must be compile-time constants — no `new Foo()`, method calls, or `DateTime.Now`.

```csharp
public sealed class TileComponent : ContainerBase
{
    public TileComponent(IUnionPage page, string key, int index, KpiKind kind)
        : base(page, $"[data-kpi='{key}'][data-index='{index}']") { }

    // ... inner elements + behavior ...
}

[UnionInit("orders", 0, KpiKind.Currency)]
public TileComponent OrdersTile { get; set; }
```

### Anti-pattern: Plain class used as a [UnionInit] property

A common mistake is creating a shared component as a plain C# class with an `ILocator` constructor. This breaks the Union initialization chain — `[UnionInit]` on a parent cannot instantiate a plain class, so the property stays `null` at runtime.

```csharp
// WRONG: Plain class — cannot be a [UnionInit] property
public sealed class RegistrySearchComponent
{
    private readonly ILocator _root;

    public RegistrySearchComponent(ILocator root) { _root = root; }

    public async Task SearchAsync(string ssn) { ... }
}

// WRONG: Manual construction in parent constructor bypasses [UnionInit]
public sealed class CustomerSliderDialog : ComponentBase
{
    public RegistrySearchComponent RegistrySearch { get; }  // no [UnionInit]

    public CustomerSliderDialog(IUnionPage page)
        : base(page, ".base-slider")
    {
        RegistrySearch = new RegistrySearchComponent(RootLocator);  // manual — fragile
    }
}
```

The fix is to inherit from `ContainerBase` so the framework can construct it via `[UnionInit]`:

```csharp
// CORRECT: ContainerBase — fully participates in Union lifecycle
public sealed class RegistrySearchComponent : ContainerBase
{
    public RegistrySearchComponent(IUnionPage parentPage)
        : base(parentPage, ".registry-search") { }

    [UnionInit("root:input[type='search']")]
    public UnionElement SearchInput { get; set; }

    public async Task SearchAsync(string ssn) { ... }
}

// CORRECT: Parent uses [UnionInit] — framework handles construction
public sealed class CustomerSliderDialog : ComponentBase
{
    [UnionInit(".base-slider")]
    public RegistrySearchComponent RegistrySearch { get; set; }
}
```

For a handful of unrelated elements that don't form a cohesive sub-component, don't create a container — use flat `[UnionInit]` fields on the page. Use this only when the elements are semantically unrelated, not as a shortcut to avoid a `ContainerBase` for a single-page sub-component:

```csharp
// CORRECT: Single-page form with unrelated top-level inputs — flat on page
public class CheckoutPage : AppPage
{
    public override string AbsolutePath => "/checkout";

    [UnionInit("#card-number")]
    public UnionElement CardNumber { get; set; }

    [UnionInit("#expiry")]
    public UnionElement Expiry { get; set; }

    [UnionInit("#cvv")]
    public UnionElement Cvv { get; set; }
}

// WRONG: wrapping unrelated inputs in a ContainerBase with no cohesion of its own
public sealed class PaymentForm : ContainerBase { ... }  // unnecessary abstraction
```

If those fields formed a cohesive unit (e.g. a `PaymentDetailsForm` with its own heading, validation, and submit button), `ContainerBase` would be correct even though it lives on a single page.

### ListBase<T> — Repeating Items

Use for lists where each item has the same structure.

```csharp
public class CompanyList : ListBase<CompanyItem>
{
    public override string RootScss => ".company-list.companies-wrap";
    public override string ItemIdScss => ".select-company-option-wrap p";
    public override string? IdAttribute => null; // uses text content

    public async Task<CompanyItem> GetRandomInvitationAsync()
    {
        var items = await GetItemsAsync();
        var invitations = new List<CompanyItem>();
        foreach (var item in items)
        {
            if (await item.IsInvitationAsync())
                invitations.Add(item);
        }
        return invitations[Random.Shared.Next(invitations.Count)];
    }
}
```

Key properties:
- `ItemIdScss` — selector for elements containing item identifiers
- `IdAttribute` — attribute name containing the ID (null = use text content)

Key methods:
- `GetIdsAsync()` — extract all item IDs from DOM
- `GetItemsAsync()` — create item instances for all IDs
- `CreateItem(id)` — create a single item by ID
- `FindSingleAsync()` — get first item
- `FindRandomAsync()` — get random item

### ItemBase — Individual List Items

`ItemBase` is reserved for items inside a `ListBase<T>`. Do not use it as a standalone parameterized component: it carries the semantic contract "an individual inside a list," and using it outside that context confuses readers and breaks conventions that tooling and future refactors rely on (e.g. searching for `ItemBase` subclasses to find list items). For repeating parameterized elements that aren't produced by a list, use `ContainerBase` — see "Reusable Parameterized Components" in `SKILL.md`.

Every interactive element inside an ItemBase must be an `[UnionInit]` field. No inline locator chaining.

```csharp
public class CompanyItem : ItemBase
{
    public override string ItemScss =>
        $".select-company-option-wrap:has(p:text-is(\"{Id}\"))";

    [UnionInit("root:p")]
    public UnionElement Name { get; set; }

    [UnionInit("root:.badge")]
    public UnionElement InvitationBadge { get; set; }

    // CORRECT: Action method using [UnionInit] field
    public async Task<bool> IsInvitationAsync()
    {
        return await InvitationBadge.IsVisibleAsync();
    }

    // WRONG: Inline locator chaining
    public async Task<bool> IsInvitationBad()
    {
        return await RootLocator.Locator(".badge").IsVisibleAsync();
    }
}
```

## Creating New Component Types

When you need a new component type, follow this checklist:

1. **Choose base class** using the decision tree in SKILL.md
2. **Define `RootScss`** — the CSS selector for the component's root element
3. **Declare child elements** with `[UnionInit]` — use `root:` prefix inside containers
4. **Add action methods** for common interactions that belong to this component
5. **Implement interfaces** if applicable (`IUnionModal`, `ILoader`, `IOverlay`)

## Component Nesting

Component hierarchy should mirror the DOM hierarchy. No artificial depth limit.

```
AuthenticatedPage (UnionPage)
  └─ CompanyListDialog (ComponentBase + IUnionModal)
      └─ CompanySelectionComponent (ContainerBase)
          ├─ CompanyList (ListBase<CompanyItem>)
          │   └─ CompanyItem (ItemBase)
          └─ DeclineInvitationForm (ComponentBase)
```

## MatchablePage

When multiple pages share the same URL but differ by DOM content, use `MatchablePage` with an overridden `MatchAsync()`:

```csharp
public class CompanySelectionLoginPage : MatchablePage
{
    public override string AbsolutePath => "/login";

    public override async ValueTask<UriMatchResult> MatchAsync(
        RequestData requestData, BaseUrlInfo baseUrlInfo, IPage playwrightPage)
    {
        var baseResult = await base.MatchAsync(requestData, baseUrlInfo, playwrightPage);
        if (!baseResult.Success) return baseResult;

        if (!await ElementExistsAsync(playwrightPage, ".company-selector"))
            return UriMatchResult.Unmatched("Company selector not found");

        return baseResult;
    }
}
```

MatchablePages are checked **before** regular UnionPages during routing. Registration order determines priority among MatchablePages. Refer to the Union framework source for detailed MatchAsync patterns.
