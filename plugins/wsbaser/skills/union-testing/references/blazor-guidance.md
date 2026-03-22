# Blazor-Specific Guidance

## Blazor Hydration in WaitLoadedAsync

Blazor apps require special handling because the page renders server-side HTML first, then hydrates with interactive WebAssembly or Server-side Blazor. Elements exist in the DOM before they're interactive.

### Base Page WaitLoadedAsync Pattern

```csharp
public abstract class AppPage : UnionPage
{
    [UnionInit]
    public ToastComponent Toast { get; set; }

    public override async Task WaitLoadedAsync()
    {
        // Step 1: Wait for Blazor runtime to initialize
        await WaitForBlazorHydrationAsync();

        // Step 2: Wait for NetworkIdle with fallback
        try
        {
            await PlaywrightPage.WaitForLoadStateAsync(
                LoadState.NetworkIdle,
                new() { Timeout = 5000 });
        }
        catch (TimeoutException)
        {
            // NetworkIdle may never complete due to persistent SignalR connections.
            // Fall back to DOMContentLoaded which is sufficient after hydration.
            await PlaywrightPage.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
        }
    }

    private async Task WaitForBlazorHydrationAsync()
    {
        var timeout = 30000; // BlazorHydrationTimeoutMs from config
        await PlaywrightPage.WaitForFunctionAsync(
            "() => window.Blazor !== undefined",
            null,
            new() { Timeout = timeout });
    }
}
```

## Why NetworkIdle Times Out

Blazor Server maintains a persistent SignalR WebSocket connection for real-time communication. This connection keeps the network "active" indefinitely, so Playwright's `NetworkIdle` state (no network activity for 500ms) is never reached.

The pattern is:
1. Wait for `window.Blazor` — confirms the Blazor runtime has loaded and hydration is complete
2. Attempt `NetworkIdle` with a short timeout — catches any remaining API calls
3. Fall back to `DOMContentLoaded` — the page is already interactive after step 1

This `catch (TimeoutException)` is one of the few acceptable patterns for exception-based control flow in the framework. The timeout is expected behavior, not an error.

## SignalR Considerations

- SignalR reconnection can cause brief UI flickers — if tests fail intermittently on page transitions, check SignalR connection state
- Route interception (`Context.RouteAsync`) does NOT intercept WebSocket frames — only HTTP requests
- To mock SignalR messages, use Playwright's `page.EvaluateAsync` to invoke handlers directly

## DevExpress and Third-Party Components

Some third-party components (DevExpress, Telerik) don't emit standard DOM events that Playwright can wait on. For these:

```csharp
// Acceptable: short delay as last resort with explanation
public async Task SelectDeclineReasonAsync(string reason)
{
    await DropdownButton.ClickAsync();
    // DevExpress dropdown animation has no reliable completion event
    await PlaywrightPage.WaitForTimeoutAsync(300);
    await PlaywrightPage.Locator($"text={reason}").ClickAsync();
}
```

This is one of the few cases where a short delay (< 500ms) is acceptable. Always add a comment explaining why an event-based wait isn't possible. Prefer Playwright's `WaitForTimeoutAsync` over `Task.Delay` — it integrates with Playwright's timeline and tracing.

## Blazor Form Interactions

Blazor forms often use `@onchange` or `@oninput` events that fire after focus leaves the element. When filling form fields:

```csharp
// Use FillAsync which triggers input + change events
await emailInput.FillAsync("user@example.com");

// For components that need explicit blur to trigger validation:
await emailInput.FillAsync("user@example.com");
await emailInput.BlurAsync();
```

## Resource Blocking for Performance

Blazor apps load significant resources. For faster test execution, consider blocking non-essential resources:

```csharp
// In [SetUp] — optional performance optimization
if (config.ResourceBlocking.Enabled)
{
    await Context.RouteAsync("**/*.{png,jpg,gif,svg,woff,woff2}", route =>
        route.AbortAsync());
}
```

Configure via `appsettings.json`:
```json
{
  "ResourceBlocking": {
    "Enabled": false,
    "BlockImages": true,
    "BlockFonts": true,
    "BlockAnalytics": true
  }
}
```

Keep this disabled by default — enable in CI for speed. Some tests may depend on images or fonts rendering correctly.
