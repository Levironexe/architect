---
schema_version: "2.0.0"
id: selenium-csharp
name: "Selenium C# E2E"
version: "1.0.0"
description: "End-to-end testing with Selenium WebDriver in C#  -  Page Object Models with BasePage, explicit waits (no Thread.Sleep), WebDriver factory, screenshot capture on failure, and proper IWebDriver disposal in TearDown."
category: pattern
language: csharp
frameworks:
  - Selenium.WebDriver
  - NUnit
  - xUnit
dependencies:
  none: []
detection:
  dependencies:
    any:
      - Selenium.WebDriver
      - Selenium.Support
      - Selenium.WebDriver.ChromeDriver
      - Selenium.WebDriver.GeckoDriver
  files:
    - "*.csproj"
  source_indicators:
    - "using OpenQA.Selenium"
    - "IWebDriver"
    - "FindElement("
    - "By.CssSelector"
    - "WebDriverWait"
structure:
  required_dirs:
    - path: Tests
      purpose: "Test specs organized by feature or user flow. Each test class tests one major user journey. Tests import Page Objects from Pages/ and the driver factory from Fixtures/  -  they never contain raw FindElement() calls or By selectors."
  recommended_dirs:
    - path: Pages
      purpose: "Page Object Model classes  -  one class per page, extending BasePage. BasePage provides shared explicit wait helpers so individual POMs don't duplicate wait logic. Example: LoginPage : BasePage, uses WaitAndFind() from BasePage."
    - path: Fixtures
      purpose: "WebDriver factory (DriverFactory.cs) and shared setup helpers. DriverFactory is the only place new ChromeDriver() or new FirefoxDriver() is called  -  tests call DriverFactory.Create() rather than constructing drivers themselves."
    - path: Models
      purpose: "Test data models and DTOs used across tests. Keeps test data construction separate from test logic."
    - path: Utilities
      purpose: "Shared helper methods  -  screenshot capture, retry logic, test data generators, custom assertions."
separation:
  rules:
    - concern: page_object_models
      belongs_in: Pages/
      rule_text: "All locators and user-action sequences go in Page Object Model classes. POM classes inherit from BasePage which provides shared explicit wait helpers. Tests call high-level POM methods (Login(), SubmitContactForm())  -  they never call FindElement() or By directly."
      example: |
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
    - concern: driver_factory
      belongs_in: Fixtures/
      rule_text: "WebDriver construction and configuration lives in a factory class. Tests never call new ChromeDriver() directly. The factory handles browser options, headless mode, implicit waits, and window sizing."
      example: |
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
    - concern: test_specs
      belongs_in: Tests/
      rule_text: "Test classes contain only test orchestration  -  setup, POM method calls, and assertions. No raw Selenium API calls (FindElement, By, Actions) in test methods. Each test class focuses on one feature or user flow."
      example: |
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
    - concern: test_configuration
      belongs_in: Fixtures/
      rule_text: "Test configuration (base URLs, browser choice, timeouts, environment toggles) lives in a config class or appsettings.test.json. Tests never hardcode URLs or credentials  -  they read from configuration."
      example: |
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
    - concern: screenshot_capture
      belongs_in: Utilities/
      rule_text: "Screenshot capture on failure is handled by a shared utility or base test class, not duplicated in each test. Screenshots are saved with timestamp and test name for easy debugging."
      example: |
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
    - concern: error_handling
      belongs_in: Utilities/
      rule_text: "Wrap flaky interactions (stale element, element not clickable) in retry helpers rather than scattering try-catch blocks across tests and POMs. Centralize retry logic in a utility class."
      example: |
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
    - concern: security_testing
      belongs_in: Tests/
      rule_text: "Auth flow tests verify session handling, token storage, and access control. Never hardcode real credentials  -  use test accounts from configuration or environment variables."
      example: |
        // Tests/AuthSecurityTests.cs
        [Test]
        public void UnauthorizedAccess_RedirectsToLogin()
        {
            _driver.Navigate().GoToUrl($"{TestConfig.BaseUrl}/admin/dashboard");
            var currentUrl = _driver.Url;
            Assert.That(currentUrl, Does.Contain("/login"));
        }
patterns:
  naming:
    pages: "PascalCase with Page suffix  -  LoginPage.cs, DashboardPage.cs, CheckoutPage.cs"
    tests: "PascalCase with Tests suffix  -  LoginTests.cs, SearchTests.cs, CheckoutTests.cs"
    fixtures: "PascalCase  -  DriverFactory.cs, TestConfig.cs, TestDataBuilder.cs"
    methods: "PascalCase test methods describing scenario  -  ValidCredentials_RedirectsToDashboard"
  data_flow:
    direction: "Test → Page Object → WebDriver (tests never touch WebDriver directly)"
    rules:
      - "Tests call POM methods (LoginPage.LoginAs()). POMs call BasePage helpers (WaitAndFind()). BasePage calls IWebDriver."
      - "Data flows down only  -  POMs never call test methods, BasePage never calls POMs."
      - "Driver lifecycle managed in SetUp/TearDown, never in POM constructors or test methods."
  error_handling:
    recommended: "Use WebDriverWait with ExpectedConditions for all element interactions. Never use Thread.Sleep(). Catch WebDriverException in TearDown for screenshot capture. Use retry helpers for known flaky interactions (StaleElementReference)."
anti_patterns:
  - id: raw-selectors-in-tests
    severity: critical
    description: "Tests contain raw FindElement() or By calls instead of using Page Object methods. This couples tests to DOM structure and creates massive duplication when selectors change."
    bad_example: |
      [Test]
      public void Login_Works()
      {
          _driver.FindElement(By.Id("username")).SendKeys("admin");
          _driver.FindElement(By.Id("password")).SendKeys("pass");
          _driver.FindElement(By.CssSelector("button[type='submit']")).Click();
          Assert.That(_driver.FindElement(By.CssSelector(".welcome")).Text, Does.Contain("Welcome"));
      }
    good_example: |
      [Test]
      public void Login_Works()
      {
          var dashboard = _loginPage.LoginAs("admin", "pass");
          Assert.That(dashboard.GetWelcomeMessage(), Does.Contain("Welcome"));
      }
  - id: thread-sleep
    severity: critical
    description: "Using Thread.Sleep() instead of explicit waits. Creates slow, flaky tests that either wait too long or not long enough."
    bad_example: |
      _driver.FindElement(By.Id("submit")).Click();
      Thread.Sleep(3000);
      var result = _driver.FindElement(By.Id("result")).Text;
    good_example: |
      WaitAndFind(By.Id("submit")).Click();
      var result = Wait.Until(d => d.FindElement(By.Id("result"))).Text;
  - id: no-base-page
    severity: warning
    description: "Page Objects don't inherit from a BasePage. Wait helpers, common actions, and driver reference are duplicated in every POM."
    bad_example: |
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
    good_example: |
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
  - id: driver-in-tests
    severity: warning
    description: "Tests construct WebDriver directly instead of using a factory. Browser options, headless config, and driver setup are scattered across test classes."
    bad_example: |
      [SetUp]
      public void Setup()
      {
          var options = new ChromeOptions();
          options.AddArgument("--headless");
          options.AddArgument("--no-sandbox");
          _driver = new ChromeDriver(options);
      }
    good_example: |
      [SetUp]
      public void Setup()
      {
          _driver = DriverFactory.Create();
      }
  - id: hardcoded-urls
    severity: warning
    description: "Test URLs and credentials hardcoded in test classes instead of read from configuration."
    bad_example: |
      _driver.Navigate().GoToUrl("https://staging.myapp.com/login");
      _loginPage.LoginAs("testuser@email.com", "P@ssw0rd!");
    good_example: |
      _driver.Navigate().GoToUrl($"{TestConfig.BaseUrl}/login");
      _loginPage.LoginAs(TestConfig.TestUsername, TestConfig.TestPassword);
  - id: no-teardown-disposal
    severity: critical
    description: "Tests don't properly dispose the WebDriver in TearDown. Leaves browser processes running, causes resource leaks and port exhaustion."
    bad_example: |
      [TearDown]
      public void TearDown()
      {
          _driver.Close();  // only closes window, doesn't kill process
      }
    good_example: |
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
  - id: assertions-in-pom
    severity: warning
    description: "Page Object classes contain Assert statements. POMs should return data or state  -  assertions belong in test classes only."
    bad_example: |
      // In LoginPage.cs
      public void VerifyLoginSuccess()
      {
          var welcome = WaitAndFind(By.CssSelector(".welcome"));
          Assert.That(welcome.Displayed, Is.True);  // assertion in POM
      }
    good_example: |
      // In LoginPage.cs
      public bool IsWelcomeDisplayed()
      {
          try { return WaitAndFind(By.CssSelector(".welcome")).Displayed; }
          catch { return false; }
      }

      // In Tests
      Assert.That(_loginPage.IsWelcomeDisplayed(), Is.True);
---

# Selenium C# E2E

Architecture skill for C# Selenium WebDriver test projects. Enforces Page Object Model pattern, driver factory, explicit waits, and clean test structure using NUnit or xUnit conventions.
