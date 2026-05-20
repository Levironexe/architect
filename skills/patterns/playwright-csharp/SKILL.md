---
schema_version: "2.0.0"
id: playwright-csharp
name: "Playwright C# E2E"
version: "1.0.0"
description: "End-to-end testing with Playwright for .NET  -  Page Object Models, async/await throughout, NUnit or MSTest with PlaywrightTest base class, BrowserContext-based auth state, and CI-optimized retries with tracing."
category: pattern
language: csharp
frameworks:
  - Microsoft.Playwright
  - NUnit
  - MSTest
dependencies:
  none: []
detection:
  dependencies:
    any:
      - Microsoft.Playwright
      - Microsoft.Playwright.NUnit
      - Microsoft.Playwright.MSTest
  source_indicators:
    - "using Microsoft.Playwright"
    - "IPage"
    - "IBrowser"
    - "Locator"
    - "GotoAsync"
    - "PlaywrightTest"
    - "ILocator"
structure:
  required_dirs:
    - path: Tests
      purpose: "Test classes organized by feature or user flow. Each test class inherits from PlaywrightTest (NUnit) or PageTest and contains async test methods. Tests call Page Object methods  -  they never use raw Locator queries or page.GotoAsync with hardcoded URLs."
  recommended_dirs:
    - path: Pages
      purpose: "Page Object Model classes  -  one class per page or major UI component. Each POM receives an IPage in its constructor and exposes high-level async methods (LoginAsync, SubmitFormAsync). All locator definitions live here, never in test classes."
    - path: Fixtures
      purpose: "Custom test fixtures for authenticated browser contexts, shared test data setup, and browser configuration. Auth fixtures load saved storage state to skip login in every test."
separation:
  rules:
    - concern: page_object_models
      belongs_in: Pages/
      rule_text: "Encapsulate all page locators and user-action sequences in Page Object Model classes. Each POM receives an IPage in its constructor and exposes async methods that represent user intentions (LoginAsync, NavigateToSettingsAsync). Tests call POM methods and assert outcomes  -  they never call page.Locator() or page.GetByRole() directly."
      example: |
        // Pages/BasePage.cs
        using Microsoft.Playwright;

        namespace MyProject.Pages
        {
            public abstract class BasePage
            {
                protected readonly IPage Page;

                protected BasePage(IPage page)
                {
                    Page = page;
                }

                protected ILocator GetByTestId(string testId)
                {
                    return Page.GetByTestId(testId);
                }

                protected async Task WaitForNavigationAsync(string urlPattern)
                {
                    await Page.WaitForURLAsync(urlPattern);
                }
            }
        }

        // Pages/LoginPage.cs
        using Microsoft.Playwright;

        namespace MyProject.Pages
        {
            public class LoginPage : BasePage
            {
                public LoginPage(IPage page) : base(page) {}

                public async Task GotoAsync()
                {
                    await Page.GotoAsync("/login");
                }

                public async Task<DashboardPage> LoginAsync(string email, string password)
                {
                    await Page.GetByLabel("Email").FillAsync(email);
                    await Page.GetByLabel("Password").FillAsync(password);
                    await Page.GetByRole(AriaRole.Button, new() { Name = "Sign in" }).ClickAsync();
                    await Page.WaitForURLAsync("**/dashboard");
                    return new DashboardPage(Page);
                }

                public async Task<string?> GetErrorMessageAsync()
                {
                    return await Page.GetByRole(AriaRole.Alert).TextContentAsync();
                }
            }
        }
      indicators:
        - "class LoginPage : BasePage"
        - "class DashboardPage : BasePage"
        - "new LoginPage(Page)"
    - concern: test_fixtures
      belongs_in: Fixtures/
      rule_text: "Create custom test fixtures that provide authenticated browser contexts by loading saved storage state. Auth setup runs once (via global setup or a dedicated setup project) and saves cookies/localStorage to a JSON file. Test classes that need auth inherit from a base fixture that loads this state  -  skipping the login UI entirely."
      example: |
        // Fixtures/AuthenticatedTestBase.cs
        using Microsoft.Playwright;
        using Microsoft.Playwright.NUnit;
        using NUnit.Framework;

        namespace MyProject.Fixtures
        {
            public class AuthenticatedTestBase : PlaywrightTest
            {
                protected IBrowser Browser { get; private set; } = null!;
                protected IBrowserContext Context { get; private set; } = null!;
                protected IPage AuthedPage { get; private set; } = null!;

                [SetUp]
                public async Task SetUpAuthContext()
                {
                    Browser = await Playwright.Chromium.LaunchAsync(new()
                    {
                        Headless = true
                    });
                    Context = await Browser.NewContextAsync(new()
                    {
                        StorageStatePath = ".auth/user.json"
                    });
                    AuthedPage = await Context.NewPageAsync();
                }

                [TearDown]
                public async Task TearDownAuthContext()
                {
                    await Context.CloseAsync();
                    await Browser.CloseAsync();
                }
            }
        }

        // Tests/DashboardTests.cs  -  uses auth fixture
        using NUnit.Framework;
        using Microsoft.Playwright;
        using MyProject.Fixtures;
        using MyProject.Pages;

        namespace MyProject.Tests
        {
            public class DashboardTests : AuthenticatedTestBase
            {
                [Test]
                public async Task ShowsUserDashboard()
                {
                    var dashboard = new DashboardPage(AuthedPage);
                    await dashboard.GotoAsync();
                    await Expect(AuthedPage.GetByRole(AriaRole.Heading, new() { Name = "Dashboard" }))
                        .ToBeVisibleAsync();
                }
            }
        }
      indicators:
        - "AuthenticatedTestBase"
        - "StorageStatePath"
        - "AuthedPage"
    - concern: config
      belongs_in: playwright config
      rule_text: "Configure base URL, retries, timeouts, and browser options using environment variables or runsettings files. Never hardcode localhost URLs in test files  -  use relative paths with a configured base URL. Use .runsettings or environment variables so the same tests run against local, staging, and CI."
      example: |
        // playwright.runsettings
        <?xml version="1.0" encoding="utf-8"?>
        <RunSettings>
          <Playwright>
            <BrowserName>chromium</BrowserName>
            <LaunchOptions>
              <Headless>true</Headless>
            </LaunchOptions>
          </Playwright>
          <TestRunParameters>
            <Parameter name="BaseUrl" value="http://localhost:5000" />
          </TestRunParameters>
        </RunSettings>

        // Fixtures/TestConfig.cs
        using NUnit.Framework;

        namespace MyProject.Fixtures
        {
            public static class TestConfig
            {
                public static string BaseUrl =>
                    TestContext.Parameters.Get("BaseUrl",
                        Environment.GetEnvironmentVariable("BASE_URL") ?? "http://localhost:5000");

                public static int RetryCount =>
                    int.Parse(Environment.GetEnvironmentVariable("RETRY_COUNT") ?? "0");
            }
        }
      indicators:
        - ".runsettings"
        - "TestConfig.BaseUrl"
        - "RETRY_COUNT"
    - concern: auth_testing
      belongs_in: Tests/
      rule_text: "Test authentication flows explicitly: login success, login failure, session expiry, unauthorized access to protected routes, and role-based access. Use saved storage state for speed in most tests, but include dedicated auth test classes that exercise the actual login boundary."
      example: |
        // Tests/AuthTests.cs
        using Microsoft.Playwright;
        using Microsoft.Playwright.NUnit;
        using NUnit.Framework;

        namespace MyProject.Tests
        {
            public class AuthTests : PageTest
            {
                [Test]
                public async Task RedirectsUnauthenticatedUsersToLogin()
                {
                    await Page.GotoAsync("/dashboard");
                    await Expect(Page).ToHaveURLAsync(new Regex("/login"));
                }

                [Test]
                public async Task RejectsExpiredSession()
                {
                    await Page.Context.ClearCookiesAsync();
                    await Page.GotoAsync("/dashboard");
                    await Expect(Page).ToHaveURLAsync(new Regex("/login"));
                }

                [Test]
                public async Task ReturnsSecureHeaders()
                {
                    var response = await Page.GotoAsync("/");
                    var headers = response!.Headers;
                    Assert.That(headers.ContainsKey("x-frame-options"), Is.True);
                }
            }
        }
      indicators:
        - "ClearCookiesAsync"
        - "ToHaveURLAsync"
        - "x-frame-options"
patterns:
  naming:
    pages: "PascalCase with Page suffix  -  LoginPage.cs, DashboardPage.cs, CheckoutPage.cs"
    tests: "PascalCase with Tests suffix  -  LoginTests.cs, SearchTests.cs, CheckoutTests.cs"
    fixtures: "PascalCase  -  AuthenticatedTestBase.cs, TestConfig.cs, GlobalSetup.cs"
    methods: "PascalCase async methods with Async suffix  -  LoginAsync, GotoAsync, GetErrorMessageAsync"
  data_flow:
    direction: "GlobalSetup (login once) -> StorageState JSON -> Auth fixture -> Test class -> POM async methods -> IPage -> Browser -> Application"
    rules:
      - "GlobalSetup logs in once and saves cookies/localStorage to .auth/user.json."
      - "Auth fixture base class loads .auth/user.json  -  tests get pre-authenticated IPage with no login overhead."
      - "Test classes call POM async methods  -  never raw Playwright locator calls."
      - "Base URL from TestConfig or .runsettings  -  page.GotoAsync('/path') works in all environments."
      - "All Playwright calls are async/await  -  no .Result or .Wait() blocking calls."
  error_handling:
    recommended: "Use Playwright's built-in auto-waiting for element actions. Configure trace collection on first retry (Trace.StartAsync) for CI debugging. Use screenshot capture on test failure via TearDown. Never use Thread.Sleep()  -  use Page.WaitForURLAsync, Locator.WaitForAsync, or Expect with timeout."
anti_patterns:
  - id: raw-selectors-in-tests
    severity: critical
    description: "Tests contain raw Page.Locator() or Page.QuerySelectorAsync() calls instead of Page Object methods. When the UI changes, every test that references that locator breaks. With POMs, only the Page Object file needs updating."
    bad_example: |
      // Tests contain raw locator calls  -  brittle, hard to maintain
      [Test]
      public async Task UserCanLogIn()
      {
          await Page.GotoAsync("/login");
          await Page.Locator("#email-input").FillAsync("user@test.com");
          await Page.Locator("button.submit-btn").ClickAsync();
          await Expect(Page.Locator(".dashboard-header")).ToBeVisibleAsync();
      }
    good_example: |
      // POM method  -  one place to update when UI changes
      [Test]
      public async Task UserCanLogIn()
      {
          var loginPage = new LoginPage(Page);
          await loginPage.GotoAsync();
          await loginPage.LoginAsync("user@test.com", "password");
          await Expect(Page).ToHaveURLAsync(new Regex("/dashboard"));
      }
  - id: no-base-page
    severity: warning
    description: "Page Objects don't inherit from a BasePage class. Common helpers (WaitForNavigationAsync, GetByTestId) are duplicated in every POM. When a shared pattern changes, every POM must be updated individually."
    bad_example: |
      // Every POM defines its own helpers  -  duplicated logic
      public class LoginPage
      {
          private readonly IPage _page;
          public LoginPage(IPage page) { _page = page; }

          public async Task LoginAsync(string email, string password)
          {
              await _page.WaitForSelectorAsync("#email");
              await _page.Locator("#email").FillAsync(email);
              // wait logic duplicated in every POM
          }
      }
    good_example: |
      // Inherit shared helpers from BasePage
      public class LoginPage : BasePage
      {
          public LoginPage(IPage page) : base(page) {}

          public async Task LoginAsync(string email, string password)
          {
              await Page.GetByLabel("Email").FillAsync(email);
              await Page.GetByLabel("Password").FillAsync(password);
              await Page.GetByRole(AriaRole.Button, new() { Name = "Sign in" }).ClickAsync();
              await WaitForNavigationAsync("**/dashboard");
          }
      }
  - id: hardcoded-urls
    severity: warning
    description: "Using hardcoded localhost URLs in GotoAsync() calls instead of relative paths. Breaks when running against staging, CI, or any non-localhost environment. Configure base URL once via TestConfig or .runsettings."
    bad_example: |
      // Hardcoded URL  -  only works on localhost:5000
      await Page.GotoAsync("http://localhost:5000/dashboard");
      await Page.GotoAsync("http://localhost:5000/login");
    good_example: |
      // Relative path  -  works with any configured base URL
      await Page.GotoAsync("/dashboard");
      await Page.GotoAsync("/login");
      // Base URL configured in .runsettings or TestConfig
  - id: no-retries-in-ci
    severity: warning
    description: "Running Playwright tests in CI without retries or trace collection. A single transient failure causes the entire pipeline to fail with no diagnostic information. Configure retries and trace-on-failure for CI runs."
    bad_example: |
      // No CI configuration  -  single failure kills the build
      dotnet test
      // No retries, no trace, no screenshot on failure
    good_example: |
      // CI pipeline with retries and diagnostics
      dotnet test --settings playwright.runsettings -- NUnit.NumberOfTestWorkers=4
      // .runsettings configures retries, trace, and screenshot-on-failure
      // TearDown captures screenshot and trace on test failure

      // Fixtures/AuthenticatedTestBase.cs  -  capture on failure
      [TearDown]
      public async Task TearDownWithDiagnostics()
      {
          if (TestContext.CurrentContext.Result.Outcome.Status == TestStatus.Failed)
          {
              var path = $"screenshots/fail_{TestContext.CurrentContext.Test.Name}.png";
              await AuthedPage.ScreenshotAsync(new() { Path = path, FullPage = true });
          }
          await Context.CloseAsync();
          await Browser.CloseAsync();
      }
  - id: auth-in-every-test
    severity: warning
    description: "Performing the full login flow (GotoAsync /login, fill email, fill password, click submit) at the start of every authenticated test. A 50-test suite wastes 50-150 seconds on redundant logins. Use global setup with StorageStatePath to log in once."
    bad_example: |
      // Full login in every test  -  multiplies execution time
      [Test]
      public async Task ViewDashboard()
      {
          await Page.GotoAsync("/login");
          await Page.GetByLabel("Email").FillAsync("user@test.com");
          await Page.GetByLabel("Password").FillAsync("Password123");
          await Page.GetByRole(AriaRole.Button, new() { Name = "Sign in" }).ClickAsync();
          await Page.WaitForURLAsync("**/dashboard");
          // Now the actual test starts...
      }
    good_example: |
      // Auth fixture provides pre-authenticated page  -  login ran once
      public class DashboardTests : AuthenticatedTestBase
      {
          [Test]
          public async Task ViewDashboard()
          {
              await AuthedPage.GotoAsync("/dashboard");
              await Expect(AuthedPage.GetByRole(AriaRole.Heading, new() { Name = "Dashboard" }))
                  .ToBeVisibleAsync();
          }
      }
---
