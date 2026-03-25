# Test Infrastructure

## Contents

- [Test Class Structure](#test-class-structure)
- [Test Session](#test-session)
- [Session Provider](#session-provider)
- [Service Definition](#service-definition)
- [Multi-Service Support](#multi-service-support)
- [Scenario Classes](#scenario-classes)
- [API Mock Organization](#api-mock-organization)
- [Diagnostics (Mandatory)](#diagnostics-mandatory)
- [DI Bridge Pattern (TestContextAccessor)](#di-bridge-pattern-testcontextaccessor)

## Test Class Structure

Every test class inherits from `UnionTest<TSession>`:

```csharp
[TestFixture]
public class CompanySelectionTests : AppTest  // AppTest extends UnionTest<AppTestSession>
{
    [Test]
    public async Task CompanySelection_SelectCompany_NavigatesToDashboard()
    {
        await Session.Scenarios.Login.LoginAsync(TestUsers.MultiCompany);
        var dialog = Session.App.State.PageAs<CompanySelectionPage>();
        await dialog.Selection.SelectCompanyByNameAsync("Acme Corp");
        var dashboard = await dialog.Selection.ContinueButton
            .ClickAndWaitForRedirectAsync<DashboardPage>();
        await Expect(dashboard.WelcomeMessage).ToBeVisibleAsync();
    }
}
```

### Base Test Class Pattern

```csharp
public class AppTest : UnionTest<AppTestSession>
{
    protected AppTestSession Session => base.Session;
    protected IBrowserContext Context => base.Context;
    protected CompanyApiMocks ApiMocks { get; private set; }

    protected override TestSessionProvider<AppTestSession> GetSessionProvider()
        => AppSessionProvider.Instance;  // Singleton

    [SetUp]
    public async Task AppSetUp()
    {
        // Mandatory: capture page creation events
        Context.Page += OnPageCreated;

        // Mandatory: initialize diagnostics
        Session.Diagnostics.Initialize(TestContext.CurrentContext);

        // Mandatory: set context timeout
        Context.SetDefaultTimeout(Session.Config.DefaultTimeoutMs);

        // Optional: setup API mocks
        ApiMocks = new CompanyApiMocks(Context);

        // Optional: initialize DI bridge for per-test state
        var accessor = Session.Services.GetRequiredService<ITestContextAccessor>();
        accessor.Initialize(ApiMocks);
    }

    [TearDown]
    public async Task AppTearDown()
    {
        // Clear DI bridge
        var accessor = Session.Services.GetRequiredService<ITestContextAccessor>();
        accessor.Clear();

        // Capture diagnostics on failure
        var outcome = TestContext.CurrentContext.Result.Outcome;
        if (outcome.Status == TestStatus.Failed)
        {
            await Session.Diagnostics.CaptureScreenshotAsync("failure");
            await Session.Diagnostics.WriteAllLogsAsync();
        }
    }
}
```

## Test Session

```csharp
public class AppTestSession : ITestSession
{
    private readonly AppService _appService;

    public AppTestSession(AppService appService, TestConfiguration config,
        TestDiagnostics diagnostics, AppScenarios scenarios)
    {
        _appService = appService;
        Config = config;
        Diagnostics = diagnostics;
        Scenarios = scenarios;
    }

    // Named service property for ergonomic access
    public AppService App => _appService;
    public TestConfiguration Config { get; }
    public TestDiagnostics Diagnostics { get; }
    public AppScenarios Scenarios { get; }
    public IServiceProvider Services { get; internal set; }

    public List<IUnionService> GetServices() => new() { _appService };
}
```

## Session Provider

```csharp
public class AppSessionProvider : TestSessionProvider<AppTestSession>
{
    // Singleton instance
    public static readonly AppSessionProvider Instance = new();

    protected override void ConfigureServices(IServiceCollection services)
    {
        var config = TestConfigurationHelper.BuildConfiguration();

        // Singleton: shared across all tests
        services.AddSingleton(config.Get<TestConfiguration>()
            ?? throw new InvalidOperationException("TestConfiguration not found"));

        // Scoped: fresh per test
        services.AddScoped<AppService>();
        services.AddScoped<TestDiagnostics>();
        services.AddScoped<AppTestSession>();
        services.AddScoped<ITestContextAccessor, TestContextAccessor>();

        // Scenarios (scoped)
        services.AddScoped<LoginScenarios>();
        services.AddScoped<AppScenarios>();
    }
}
```

## Service Definition

One `UnionService<T>` per application under test. Pages auto-register via reflection.

```csharp
public class AppService : UnionService<AppPage>
{
    private readonly TestConfiguration _config;

    public AppService(TestConfiguration config) => _config = config;

    public override string BaseUrl => _config.BaseUrl;
}
```

## Multi-Service Support

When testing multiple applications, each gets its own service with independent page hierarchies:

```csharp
public class AppTestSession : ITestSession
{
    public FrontendService Frontend { get; }
    public AdminService Admin { get; }

    public List<IUnionService> GetServices() => new() { Frontend, Admin };
}
```

Each service has its own page base type. No cross-references between service page hierarchies.

## Scenario Classes

Reusable multi-step workflows that are used across multiple test classes:

```csharp
public class LoginScenarios
{
    private readonly AppService _app;
    private readonly ApiService _api;

    public LoginScenarios(AppService app, ApiService api)
    {
        _app = app;
        _api = api;
    }

    public async Task LoginAsync(TestUser user)
    {
        var loginPage = await _app.Go.ToPage<LoginPage>();
        await loginPage.EmailInput.FillAsync(user.Email);
        await loginPage.PasswordInput.FillAsync(user.Password);
        await loginPage.LoginButton.ClickAndWaitForRedirectAsync<DashboardPage>();
    }

    public async Task LoginWithCompanySelectionAsync(
        TestUser user, List<TestCompany> companies)
    {
        var loginPage = await _app.Go.ToPage<LoginPage>();
        await loginPage.LoginAsync(user.Email, user.Password);
        // Navigate through company selection flow...
    }
}
```

Scenario classes live in `Infrastructure/Scenarios/` and are registered as scoped in the session provider.

## API Mock Organization

One mock class per API domain, using Playwright's `Context.RouteAsync()`:

```csharp
public class CompanyApiMocks
{
    private readonly IBrowserContext _context;

    public CompanyApiMocks(IBrowserContext context) => _context = context;

    public async Task MockCompanyListAsync(List<TestCompany> companies)
    {
        await _context.RouteAsync("**/api/companies", async route =>
        {
            var json = JsonSerializer.Serialize(companies);
            await route.FulfillAsync(new()
            {
                ContentType = "application/json",
                Body = json
            });
        });
    }

    public async Task SetupStandardCompanySelectionMocksAsync(
        List<TestCompany> companies)
    {
        await MockCompanyListAsync(companies);
        await MockCompanyLoginAsync();
        // ... other related mocks
    }
}
```

Test data lives in fixture classes under `Infrastructure/Fixtures/`:

```csharp
public static class CompanyTestData
{
    public static readonly TestCompany AcmeCorp = new("Acme Corp", "acme-id");
    public static readonly TestCompany GlobalInc = new("Global Inc", "global-id");

    public static readonly List<TestCompany> MultipleCompanies = new()
    {
        AcmeCorp, GlobalInc
    };
}
```

## Diagnostics (Mandatory)

Every test base class must set up diagnostics. Minimum requirements:
- Screenshot capture on test failure
- Console/network log collection
- Diagnostic output to `TestContext`

```csharp
[TearDown]
public async Task TearDown()
{
    if (TestContext.CurrentContext.Result.Outcome.Status == TestStatus.Failed)
    {
        await Session.Diagnostics.CaptureScreenshotAsync("failure");
        await Session.Diagnostics.WriteAllLogsAsync();
    }
}
```

## DI Bridge Pattern (TestContextAccessor)

When per-test state (like API mocks) needs to be accessible from DI-resolved services:

```csharp
public interface ITestContextAccessor
{
    CompanyApiMocks? ApiMocks { get; }
    void Initialize(CompanyApiMocks mocks);
    void Clear();
}

public class TestContextAccessor : ITestContextAccessor
{
    public CompanyApiMocks? ApiMocks { get; private set; }

    public void Initialize(CompanyApiMocks mocks) => ApiMocks = mocks;
    public void Clear() => ApiMocks = null;
}
```

Register as scoped, initialize in `[SetUp]`, clear in `[TearDown]`.
