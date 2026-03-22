# Navigation & State Management

## Navigation Methods

### Go.ToPage<T>() — Intentional Navigation

Use when you want to actively navigate to a specific page:

```csharp
var loginPage = await Session.App.Go.ToPage<LoginPage>();
// Use the returned page object directly — no need to verify with PageIs
await loginPage.EmailInput.FillAsync("user@example.com");
```

The framework:
1. Navigates to the page's `AbsolutePath` URL
2. Retries page resolution until timeout (`NavigationResolveTimeoutMs`, default 5000ms)
3. Calls `WaitLoadedAsync()` on the resolved page
4. Returns the initialized page with all `[UnionInit]` fields ready

### Go.ToUrl() — Unmapped URLs

Use only when navigating to a URL that doesn't map to any page type:

```csharp
await Session.App.Go.ToUrl("https://external-auth.example.com/callback");
```

### Go.Refresh() / Go.Back()

Both automatically re-actualize state after the browser action:

```csharp
await Session.App.Go.Refresh();
var currentPage = Session.App.State.PageAs<DashboardPage>();
```

## Click-and-Wait Methods

These are the primary way to handle action-triggered page/component changes. They return the target object — use it directly.

### ClickAndWaitForRedirectAsync<T>() — Page Navigation via Click

```csharp
// Happy path: expect redirect
var dashboard = await loginPage.LoginButton
    .ClickAndWaitForRedirectAsync<DashboardPage>();
// If redirect doesn't happen, dashboard is null → NullReferenceException fails test naturally
await dashboard.WelcomeMessage.IsVisibleAsync();
```

### ClickAndWaitForAlertAsync<T>() — Modal/Dialog Appearance

```csharp
var dialog = await page.CompanyNameButton
    .ClickAndWaitForAlertAsync<CompanyListDialog>();
await dialog.Selection.SearchAsync("Acme Corp");
```

### ClickAndWaitForAsync<T>() — Component Appearance

```csharp
var form = await page.EditButton
    .ClickAndWaitForAsync<EditForm>();
await form.NameInput.FillAsync("New Name");
```

### Plain ClickAsync() — Validation Tests

When testing that a click does NOT navigate (e.g., form validation prevents submit):

```csharp
// Validation test: click submit without filling required fields
await page.SubmitButton.ClickAsync();
// Assert validation errors appear
await Expect(page.ValidationError).ToBeVisibleAsync();
await Expect(page.ValidationError).ToHaveTextAsync("Email is required");
```

## State Inspection

### PageAs<T>() — Check Current Page Type

Use after an external action to find out where you are:

```csharp
// After a scenario navigates somewhere
await Session.Scenarios.Login.LoginAsync(user);
var page = Session.App.State.PageAs<OverviewPage>();
```

Returns `null` if the current page is not type `T`.

### PageIs<T>() — Boolean Check

Use for assertions about redirects or conditional logic:

```csharp
// Testing that clicking "Logout" redirects to login page
await page.LogoutButton.ClickAndWaitForRedirectAsync<LoginPage>();
Session.App.State.PageIs<LoginPage>().Should().BeTrue(
    "Logout should redirect to login page");
```

**Do NOT use PageIs<T>() as a routine verification after Go.ToPage<T>().** The return value from `Go.ToPage<T>()` is sufficient.

## Page Object Action Methods

Wrap common interactions in page object methods. These return component references when applicable:

```csharp
public class AuthenticatedPage : SevenCPage
{
    [UnionInit(".company-name-btn")]
    public UnionElement CompanyNameButton { get; set; }

    [UnionInit]
    public CompanyListDialog CompanyDialog { get; set; }

    // Action method wrapping ClickAndWait
    public async Task<CompanyListDialog> OpenCompanyDialogAsync()
    {
        return await CompanyNameButton
            .ClickAndWaitForAlertAsync<CompanyListDialog>();
    }
}
```

Tests can either call the page method or use ClickAndWait directly for one-off interactions:

```csharp
// Via page method (preferred for common actions)
var dialog = await page.OpenCompanyDialogAsync();

// Direct ClickAndWait (acceptable for one-off interactions)
var popup = await page.SomeButton
    .ClickAndWaitForAlertAsync<RarelyUsedPopup>();
```

## WaitLoadedAsync Override

Override on page classes to add custom wait logic after navigation:

```csharp
public abstract class AppPage : UnionPage
{
    public override async Task WaitLoadedAsync()
    {
        // Wait for app-specific load conditions
        await PlaywrightPage.WaitForLoadStateAsync(LoadState.NetworkIdle);
    }
}
```

See `references/blazor-guidance.md` for Blazor-specific WaitLoadedAsync patterns.
