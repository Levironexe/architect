---
name: architect-refactor
description: >
  Executes a refactoring plan phase by phase, moving files, updating imports, and pausing
  between phases for developer confirmation. Use this skill whenever the user wants to execute
  a refactor, apply an architect plan, move files per their architecture blueprint, or says
  "do the refactor", "execute phase 1", "start refactoring". Trigger even if the user just
  says "let's do it" after a planning session, or "go ahead with the plan".
metadata:
  version: "1.0"
  author-email: "levironforwork@gmail.com"
  last-updated: "2026-05-11"
---

# architect-refactor

You are executing a developer's refactoring plan one phase at a time. The goal is safe,
incremental restructuring  -  the developer controls the pace, you do the work precisely and
explain everything before you touch a file.

## Before you do anything: check for the plan

Look for `.architect/plan.md` in the project root.

If it does not exist, stop immediately and output:

```
❌ No refactoring plan found.

Run `/architect-plan` first to generate a plan, then invoke `/architect-refactor` to execute it.
```

Do not modify any files if the plan is missing.

## Architectural constraints you must follow

The following rules come from the **Selenium C# E2E** architecture blueprint. Treat them as
hard constraints  -  they are not suggestions. Every file move you make must end up satisfying
these rules.

- page_object_models -> Pages/
  Rule: All locators and user-action sequences go in Page Object Model classes. POM classes inherit from BasePage which provides shared explicit wait helpers. Tests call high-level POM methods (Login(), SubmitContactForm())  -  they never call FindElement() or By directly.
  Example:
    // Pages/BasePage.cs
    using OpenQA.Selenium;
    using OpenQA.Selenium.Support.UI;
    
    namespace MyProject.Pages
    {
        public abstract class BasePage
        {
            protected readonly IWebDriver Driver;
            protected readonly WebDriverWait Wait;
    
            protected BasePage(IWebDriver driver, int timeoutSeconds = 10)
            {
                Driver = driver;
                Wait = new WebDriverWait(driver, TimeSpan.FromSeconds(timeoutSeconds));
            }
    
            protected IWebElement WaitAndFind(By locator)
            {
                return Wait.Until(d => d.FindElement(locator));
            }
    
            protected IWebElement FindByTestId(string testId)
            {
                return WaitAndFind(By.CssSelector($"[data-testid='{testId}']"));
            }
        }
    }
    
    // Pages/LoginPage.cs
    namespace MyProject.Pages
    {
        public class LoginPage : BasePage
        {
            private By UsernameField => By.Id("username");
            private By PasswordField => By.Id("password");
            private By SubmitButton => By.CssSelector("button[type='submit']");
    
            public LoginPage(IWebDriver driver) : base(driver) {}
    
            public DashboardPage LoginAs(string username, string password)
            {
                WaitAndFind(UsernameField).SendKeys(username);
                WaitAndFind(PasswordField).SendKeys(password);
                WaitAndFind(SubmitButton).Click();
                return new DashboardPage(Driver);
            }
        }
    }

- driver_factory -> Fixtures/
  Rule: WebDriver construction and configuration lives in a factory class. Tests never call new ChromeDriver() directly. The factory handles browser options, headless mode, implicit waits, and window sizing.
  Example:
    // Fixtures/DriverFactory.cs
    using OpenQA.Selenium;
    using OpenQA.Selenium.Chrome;
    using OpenQA.Selenium.Firefox;
    
    namespace MyProject.Fixtures
    {
        public static class DriverFactory
        {
            public static IWebDriver Create(string browser = "chrome", bool headless = true)
            {
                return browser.ToLower() switch
                {
                    "chrome" => CreateChrome(headless),
                    "firefox" => CreateFirefox(headless),
                    _ => throw new ArgumentException($"Unsupported browser: {browser}")
                };
            }
    
            private static IWebDriver CreateChrome(bool headless)
            {
                var options = new ChromeOptions();
                if (headless) options.AddArgument("--headless=new");
                options.AddArgument("--no-sandbox");
                options.AddArgument("--window-size=1920,1080");
                return new ChromeDriver(options);
            }
    
            private static IWebDriver CreateFirefox(bool headless)
            {
                var options = new FirefoxOptions();
                if (headless) options.AddArgument("--headless");
                return new FirefoxDriver(options);
            }
        }
    }

- test_specs -> Tests/
  Rule: Test classes contain only test orchestration  -  setup, POM method calls, and assertions. No raw Selenium API calls (FindElement, By, Actions) in test methods. Each test class focuses on one feature or user flow.
  Example:
    // Tests/LoginTests.cs  (NUnit)
    using NUnit.Framework;
    using MyProject.Fixtures;
    using MyProject.Pages;
    
    namespace MyProject.Tests
    {
        [TestFixture]
        public class LoginTests
        {
            private IWebDriver _driver;
            private LoginPage _loginPage;
    
            [SetUp]
            public void Setup()
            {
                _driver = DriverFactory.Create();
                _driver.Navigate().GoToUrl("https://app.example.com/login");
                _loginPage = new LoginPage(_driver);
            }
    
            [TearDown]
            public void TearDown()
            {
                _driver?.Quit();
                _driver?.Dispose();
            }
    
            [Test]
            public void ValidCredentials_RedirectsToDashboard()
            {
                var dashboard = _loginPage.LoginAs("admin", "password123");
                Assert.That(dashboard.IsLoaded(), Is.True);
            }
    
            [Test]
            public void InvalidCredentials_ShowsErrorMessage()
            {
                _loginPage.LoginAs("wrong", "wrong");
                Assert.That(_loginPage.GetErrorMessage(), Does.Contain("Invalid"));
            }
        }
    }

- test_configuration -> Fixtures/
  Rule: Test configuration (base URLs, browser choice, timeouts, environment toggles) lives in a config class or appsettings.test.json. Tests never hardcode URLs or credentials  -  they read from configuration.
  Example:
    // Fixtures/TestConfig.cs
    using Microsoft.Extensions.Configuration;
    
    namespace MyProject.Fixtures
    {
        public static class TestConfig
        {
            private static readonly IConfiguration Config = new ConfigurationBuilder()
                .AddJsonFile("appsettings.test.json", optional: true)
                .AddEnvironmentVariables()
                .Build();
    
            public static string BaseUrl => Config["BaseUrl"] ?? "https://localhost:5001";
            public static string Browser => Config["Browser"] ?? "chrome";
            public static bool Headless => bool.Parse(Config["Headless"] ?? "true");
            public static int TimeoutSeconds => int.Parse(Config["TimeoutSeconds"] ?? "10");
        }
    }

- screenshot_capture -> Utilities/
  Rule: Screenshot capture on failure is handled by a shared utility or base test class, not duplicated in each test. Screenshots are saved with timestamp and test name for easy debugging.
  Example:
    // Utilities/ScreenshotHelper.cs
    using OpenQA.Selenium;
    
    namespace MyProject.Utilities
    {
        public static class ScreenshotHelper
        {
            public static void CaptureOnFailure(IWebDriver driver, string testName)
            {
                var screenshot = ((ITakesScreenshot)driver).GetScreenshot();
                var fileName = $"failure_{testName}_{DateTime.Now:yyyyMMdd_HHmmss}.png";
                var path = Path.Combine("screenshots", fileName);
                Directory.CreateDirectory("screenshots");
                screenshot.SaveAsFile(path);
            }
        }
    }

- error_handling -> Utilities/
  Rule: Wrap flaky interactions (stale element, element not clickable) in retry helpers rather than scattering try-catch blocks across tests and POMs. Centralize retry logic in a utility class.
  Example:
    // Utilities/RetryHelper.cs
    using OpenQA.Selenium;
    
    namespace MyProject.Utilities
    {
        public static class RetryHelper
        {
            public static T RetryOnStale<T>(Func<T> action, int maxRetries = 3)
            {
                for (int i = 0; i < maxRetries; i++)
                {
                    try { return action(); }
                    catch (StaleElementReferenceException) when (i < maxRetries - 1)
                    {
                        Thread.Sleep(200);
                    }
                }
                return action();
            }
        }
    }

- security_testing -> Tests/
  Rule: Auth flow tests verify session handling, token storage, and access control. Never hardcode real credentials  -  use test accounts from configuration or environment variables.
  Example:
    // Tests/AuthSecurityTests.cs
    [Test]
    public void UnauthorizedAccess_RedirectsToLogin()
    {
        _driver.Navigate().GoToUrl($"{TestConfig.BaseUrl}/admin/dashboard");
        var currentUrl = _driver.Url;
        Assert.That(currentUrl, Does.Contain("/login"));
    }

If the above block is empty, use your best judgment based on the stack and the plan itself.

## Anti-patterns to avoid

After each step, verify you have not introduced any of the following:

- raw-selectors-in-tests [critical]
  Tests contain raw FindElement() or By calls instead of using Page Object methods. This couples tests to DOM structure and creates massive duplication when selectors change.
  Bad example:
    [Test]
    public void Login_Works()
    {
        _driver.FindElement(By.Id("username")).SendKeys("admin");
        _driver.FindElement(By.Id("password")).SendKeys("pass");
        _driver.FindElement(By.CssSelector("button[type='submit']")).Click();
        Assert.That(_driver.FindElement(By.CssSelector(".welcome")).Text, Does.Contain("Welcome"));
    }
  Good example:
    [Test]
    public void Login_Works()
    {
        var dashboard = _loginPage.LoginAs("admin", "pass");
        Assert.That(dashboard.GetWelcomeMessage(), Does.Contain("Welcome"));
    }

- thread-sleep [critical]
  Using Thread.Sleep() instead of explicit waits. Creates slow, flaky tests that either wait too long or not long enough.
  Bad example:
    _driver.FindElement(By.Id("submit")).Click();
    Thread.Sleep(3000);
    var result = _driver.FindElement(By.Id("result")).Text;
  Good example:
    WaitAndFind(By.Id("submit")).Click();
    var result = Wait.Until(d => d.FindElement(By.Id("result"))).Text;

- no-base-page [warning]
  Page Objects don't inherit from a BasePage. Wait helpers, common actions, and driver reference are duplicated in every POM.
  Bad example:
    public class LoginPage
    {
        private IWebDriver _driver;
        public LoginPage(IWebDriver driver) { _driver = driver; }
    
        public void Login(string user, string pass)
        {
            var wait = new WebDriverWait(_driver, TimeSpan.FromSeconds(10));
            wait.Until(d => d.FindElement(By.Id("username"))).SendKeys(user);
            // wait logic duplicated in every POM method
        }
    }
  Good example:
    public class LoginPage : BasePage
    {
        public LoginPage(IWebDriver driver) : base(driver) {}
    
        public void Login(string user, string pass)
        {
            WaitAndFind(By.Id("username")).SendKeys(user);
            WaitAndFind(By.Id("password")).SendKeys(pass);
            WaitAndFind(SubmitButton).Click();
        }
    }

- driver-in-tests [warning]
  Tests construct WebDriver directly instead of using a factory. Browser options, headless config, and driver setup are scattered across test classes.
  Bad example:
    [SetUp]
    public void Setup()
    {
        var options = new ChromeOptions();
        options.AddArgument("--headless");
        options.AddArgument("--no-sandbox");
        _driver = new ChromeDriver(options);
    }
  Good example:
    [SetUp]
    public void Setup()
    {
        _driver = DriverFactory.Create();
    }

- hardcoded-urls [warning]
  Test URLs and credentials hardcoded in test classes instead of read from configuration.
  Bad example:
    _driver.Navigate().GoToUrl("https://staging.myapp.com/login");
    _loginPage.LoginAs("testuser@email.com", "P@ssw0rd!");
  Good example:
    _driver.Navigate().GoToUrl($"{TestConfig.BaseUrl}/login");
    _loginPage.LoginAs(TestConfig.TestUsername, TestConfig.TestPassword);

- no-teardown-disposal [critical]
  Tests don't properly dispose the WebDriver in TearDown. Leaves browser processes running, causes resource leaks and port exhaustion.
  Bad example:
    [TearDown]
    public void TearDown()
    {
        _driver.Close();  // only closes window, doesn't kill process
    }
  Good example:
    [TearDown]
    public void TearDown()
    {
        try
        {
            ScreenshotHelper.CaptureOnFailure(_driver, TestContext.CurrentContext.Test.Name);
        }
        finally
        {
            _driver?.Quit();
            _driver?.Dispose();
        }
    }

- assertions-in-pom [warning]
  Page Object classes contain Assert statements. POMs should return data or state  -  assertions belong in test classes only.
  Bad example:
    // In LoginPage.cs
    public void VerifyLoginSuccess()
    {
        var welcome = WaitAndFind(By.CssSelector(".welcome"));
        Assert.That(welcome.Displayed, Is.True);  // assertion in POM
    }
  Good example:
    // In LoginPage.cs
    public bool IsWelcomeDisplayed()
    {
        try { return WaitAndFind(By.CssSelector(".welcome")).Displayed; }
        catch { return false; }
    }
    
    // In Tests
    Assert.That(_loginPage.IsWelcomeDisplayed(), Is.True);

If the above block is empty, at minimum: do not put business logic in route handlers, do not
hardcode secrets, do not create circular imports.

## How to execute the plan

### 1. Read the plan and check progress

Read `.architect/plan.md` in full.

If `.architect/state.json` exists, use it to determine where to resume:
- Parse the JSON and find the first phase with status `"pending"` or `"in_progress"`
- If a phase is `"in_progress"`, resume from its first unchecked step (`- [ ]`) in plan.md
- If all phases are `"completed"`, output "✅ All phases complete." and stop
- Set the found phase as your current target

If `.architect/state.json` does not exist, fall back to the checkbox method: look for the first
phase that still has unchecked steps (`- [ ]`). If all steps in a phase are already checked
(`- [x]`), skip to the next phase.

### 2. Execute the current phase, step by step

For each unchecked step in the current phase:

**Before touching the file**, state in the chat:
> "Step N.M: Moving `<source>` → `<target>`. Reason: <why from the plan>. Updating imports in: <files>."

Then:
1. Create the target directory if it doesn't exist
2. Move or create the file as specified
3. Update all imports listed in the step's "Imports to update" field, using the exact
   old-path → new-path substitutions specified (not just the file list)
4. If the step has a "Verify:" line, run the grep command it specifies. If it returns results,
   fix the remaining references before proceeding  -  do not mark the step done with known
   orphaned imports
5. Verify the project still makes sense (no obviously broken imports left behind)
6. Mark the step as done in `.architect/plan.md` by changing `- [ ]` to `- [x]`

If a step would create a circular dependency, skip it, explain why in the chat, and continue
with the next step.

### 3. After completing all steps in the phase, verify and update state

Run verification:
```
npx @levironexe/architect verify . --phase N
```
(Replace N with the current phase number.)

If the command is not available, fall back to:
```
npx @levironexe/architect scan .
```

**If verification FAILS** (exit code 1, or tsc errors / broken imports reported):
- Stop immediately
- Show the verification output to the developer
- Do not proceed to the next phase
- Output: "Phase N verification failed. Fix the issues above and run `/architect-refactor` to retry."

**If verification PASSES:**

Update `.architect/state.json` (if it exists):
- Set the current phase's `status` to `"completed"` and add `"completed_at": "<ISO timestamp>"`
- If a next phase exists, set its `status` to `"in_progress"` and `"started_at": "<ISO timestamp>"`
- Update `current_phase` to N+1
- Read the health score from `.architect/scans/phase-N.json` and set `latest_health` to that value

Then output exactly this (replacing the placeholders):

```
✅ Phase N complete: <phase name>
Verification: PASSED (0 tsc errors, 0 broken imports)
Health: <baseline_health> → <latest_health> (+<delta>)

Steps executed:
- [x] Step N.1: <description>
- [x] Step N.2: <description>
...

Proceed to Phase N+1 (<next phase name>)? **yes / no**
```

Then stop. Wait for the developer to respond before touching Phase N+1.

If there is no next phase, output:

```
✅ All phases complete.

The refactoring is done. Run `npx @levironexe/architect diff .` to see the full before/after comparison.
```

### 4. On developer confirmation

If the developer says yes (or "continue", "proceed", "go ahead"), execute the next phase
following the same step-by-step process.

If the developer says no (or "stop", "wait", "pause"), stop and confirm:
> "Paused after Phase N. The plan in `.architect/plan.md` is up to date  -  all completed steps
> are checked. Run `/architect-refactor` again when you're ready to continue."

## Important: what NOT to do

- Do not skip the pre-flight plan check  -  refactoring without a plan risks breaking the codebase
- Do not execute more than one phase per invocation unless the developer explicitly asks for all phases
- Do not modify files outside the scope of the current step
- Do not change business logic while moving files  -  the goal is structural change only
- Do not proceed to Phase N+1 automatically  -  always wait for the developer's yes/no
