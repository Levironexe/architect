---
schema_version: "2.0.0"
id: selenium-java
name: "Selenium Java E2E"
version: "1.0.0"
description: "End-to-end testing with Selenium WebDriver in Java  -  Page Object Models with BasePage, explicit waits via WebDriverWait (no Thread.sleep), DriverFactory class, JUnit5 lifecycle management, screenshot capture on failure, and proper driver.quit() in @AfterEach."
category: pattern
language: java
frameworks:
  - selenium-java
  - junit-jupiter
  - testng
dependencies:
  none: []
detection:
  dependencies:
    any:
      - selenium-java
      - webdrivermanager
      - org.seleniumhq.selenium:selenium-java
  source_indicators:
    - "import org.openqa.selenium"
    - "WebDriver"
    - "findElement("
    - "By.cssSelector"
    - "WebDriverWait"
structure:
  required_dirs:
    - path: src/test/java
      purpose: "Test classes organized by feature or user flow. Each test class tests one major user journey. Tests import Page Objects from the pages package and the driver factory from fixtures  -  they never contain raw findElement() calls or By selectors."
  recommended_dirs:
    - path: src/test/java/pages
      purpose: "Page Object Model classes  -  one class per page, extending BasePage. BasePage provides shared explicit wait helpers so individual POMs don't duplicate wait logic. Example: LoginPage extends BasePage, uses waitAndFind(By) from BasePage."
    - path: src/test/java/fixtures
      purpose: "DriverFactory class and shared setup helpers. DriverFactory is the only place new ChromeDriver() or new FirefoxDriver() is called  -  tests call DriverFactory.createDriver() rather than constructing drivers themselves."
    - path: src/test/java/utils
      purpose: "Shared utility classes  -  screenshot capture, retry helpers, test data builders, custom assertions."
    - path: src/test/resources
      purpose: "Test configuration files  -  test.properties for base URL, browser choice, timeouts, and environment-specific overrides."
separation:
  rules:
    - concern: page_object_models
      belongs_in: src/test/java/pages/
      rule_text: "All locators and user-action sequences go in Page Object Model classes. POM classes extend BasePage which provides shared explicit wait helpers. Tests call high-level POM methods (login(), submitContactForm())  -  they never call findElement() or By directly."
      example: |
        // src/test/java/pages/BasePage.java
        package pages;

        import org.openqa.selenium.By;
        import org.openqa.selenium.WebDriver;
        import org.openqa.selenium.WebElement;
        import org.openqa.selenium.support.ui.ExpectedConditions;
        import org.openqa.selenium.support.ui.WebDriverWait;
        import java.time.Duration;

        public abstract class BasePage {
            protected final WebDriver driver;
            protected final WebDriverWait wait;

            protected BasePage(WebDriver driver) {
                this.driver = driver;
                this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
            }

            protected WebElement waitAndFind(By locator) {
                return wait.until(ExpectedConditions.presenceOfElementLocated(locator));
            }

            protected void waitAndClick(By locator) {
                wait.until(ExpectedConditions.elementToBeClickable(locator)).click();
            }

            protected WebElement findByTestId(String testId) {
                return waitAndFind(By.cssSelector("[data-testid='" + testId + "']"));
            }

            protected void waitForUrlContains(String urlFragment) {
                wait.until(ExpectedConditions.urlContains(urlFragment));
            }
        }


        // src/test/java/pages/LoginPage.java
        package pages;

        import org.openqa.selenium.By;
        import org.openqa.selenium.WebDriver;

        public class LoginPage extends BasePage {
            private static final By EMAIL_INPUT = By.cssSelector("[data-testid='email-input']");
            private static final By PASSWORD_INPUT = By.cssSelector("[data-testid='password-input']");
            private static final By SUBMIT_BUTTON = By.cssSelector("[data-testid='login-submit']");
            private static final By ERROR_ALERT = By.cssSelector("[data-testid='error-alert']");

            public LoginPage(WebDriver driver) {
                super(driver);
            }

            public void navigateTo(String baseUrl) {
                driver.get(baseUrl + "/login");
            }

            public DashboardPage login(String email, String password) {
                waitAndFind(EMAIL_INPUT).sendKeys(email);
                waitAndFind(PASSWORD_INPUT).sendKeys(password);
                waitAndClick(SUBMIT_BUTTON);
                waitForUrlContains("/dashboard");
                return new DashboardPage(driver);
            }

            public String getErrorMessage() {
                return waitAndFind(ERROR_ALERT).getText();
            }
        }
      indicators:
        - "class LoginPage"
        - "extends BasePage"
        - "new LoginPage(driver)"
    - concern: driver_factory
      belongs_in: src/test/java/fixtures/
      rule_text: "Create and configure the WebDriver instance in a dedicated DriverFactory class. Test classes call DriverFactory.createDriver()  -  they never call new ChromeDriver(). This centralizes browser configuration (headless mode in CI, window size, remote grid URL) in one place. Driver lifecycle is managed via @BeforeEach and @AfterEach."
      example: |
        // src/test/java/fixtures/DriverFactory.java
        package fixtures;

        import org.openqa.selenium.WebDriver;
        import org.openqa.selenium.chrome.ChromeDriver;
        import org.openqa.selenium.chrome.ChromeOptions;
        import org.openqa.selenium.firefox.FirefoxDriver;
        import org.openqa.selenium.firefox.FirefoxOptions;
        import io.github.bonigarcia.wdm.WebDriverManager;

        public class DriverFactory {
            public static WebDriver createDriver() {
                return createDriver("chrome");
            }

            public static WebDriver createDriver(String browser) {
                switch (browser.toLowerCase()) {
                    case "chrome":
                        return createChrome();
                    case "firefox":
                        return createFirefox();
                    default:
                        throw new IllegalArgumentException("Unsupported browser: " + browser);
                }
            }

            private static WebDriver createChrome() {
                WebDriverManager.chromedriver().setup();
                ChromeOptions options = new ChromeOptions();
                if (System.getenv("CI") != null) {
                    options.addArguments("--headless=new");
                    options.addArguments("--no-sandbox");
                    options.addArguments("--disable-dev-shm-usage");
                }
                options.addArguments("--window-size=1920,1080");
                return new ChromeDriver(options);
            }

            private static WebDriver createFirefox() {
                WebDriverManager.firefoxdriver().setup();
                FirefoxOptions options = new FirefoxOptions();
                if (System.getenv("CI") != null) {
                    options.addArguments("--headless");
                }
                return new FirefoxDriver(options);
            }
        }


        // In a test class  -  driver lifecycle via JUnit5
        import org.junit.jupiter.api.BeforeEach;
        import org.junit.jupiter.api.AfterEach;
        import fixtures.DriverFactory;

        private WebDriver driver;

        @BeforeEach
        void setUp() {
            driver = DriverFactory.createDriver();
        }

        @AfterEach
        void tearDown() {
            if (driver != null) {
                driver.quit();
            }
        }
      indicators:
        - "DriverFactory"
        - "createDriver"
        - "@BeforeEach"
        - "@AfterEach"
    - concern: explicit_waits
      belongs_in: src/test/java/pages/
      rule_text: "Always use explicit waits (WebDriverWait with ExpectedConditions) for every element interaction. Never use Thread.sleep()  -  it adds a fixed delay even when the element is ready, making tests slow and still flaky. Set a consistent timeout (10s for most elements, longer for page transitions)."
      example: |
        import org.openqa.selenium.By;
        import org.openqa.selenium.WebDriver;
        import org.openqa.selenium.WebElement;
        import org.openqa.selenium.support.ui.ExpectedConditions;
        import org.openqa.selenium.support.ui.WebDriverWait;
        import java.time.Duration;

        // Correct: explicit wait  -  resolves immediately when element appears, fails after timeout
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        WebElement element = wait.until(
            ExpectedConditions.presenceOfElementLocated(By.cssSelector("[data-testid='result-list']"))
        );

        // Correct: wait for element to be clickable before interaction
        WebElement button = wait.until(
            ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='submit-btn']"))
        );
        button.click();

        // Correct: wait for visibility (element present AND displayed)
        WebElement banner = wait.until(
            ExpectedConditions.visibilityOfElementLocated(By.id("success-banner"))
        );

        // Wrong: fixed sleep  -  arbitrary, slow, still flaky
        // Thread.sleep(3000);
        // WebElement el = driver.findElement(By.cssSelector("[data-testid='result-list']"));
      indicators:
        - "WebDriverWait("
        - "ExpectedConditions."
        - "Duration.ofSeconds"
    - concern: screenshot_on_failure
      belongs_in: src/test/java/utils/
      rule_text: "Capture a screenshot and save it to disk automatically when a test fails. Use a JUnit5 extension (implements TestWatcher) or a TestNG listener. In CI, screenshots are the primary debugging tool  -  without them, a failing test in a headless browser is nearly impossible to diagnose."
      example: |
        // src/test/java/utils/ScreenshotExtension.java
        package utils;

        import org.junit.jupiter.api.extension.ExtensionContext;
        import org.junit.jupiter.api.extension.TestWatcher;
        import org.openqa.selenium.OutputType;
        import org.openqa.selenium.TakesScreenshot;
        import org.openqa.selenium.WebDriver;
        import java.io.File;
        import java.io.IOException;
        import java.nio.file.Files;
        import java.nio.file.Path;
        import java.nio.file.Paths;
        import java.time.LocalDateTime;
        import java.time.format.DateTimeFormatter;

        public class ScreenshotExtension implements TestWatcher {
            private final WebDriver driver;

            public ScreenshotExtension(WebDriver driver) {
                this.driver = driver;
            }

            @Override
            public void testFailed(ExtensionContext context, Throwable cause) {
                if (driver instanceof TakesScreenshot) {
                    File screenshot = ((TakesScreenshot) driver).getScreenshotAs(OutputType.FILE);
                    String timestamp = LocalDateTime.now().format(
                        DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")
                    );
                    String testName = context.getDisplayName().replaceAll("\\s+", "_");
                    Path dir = Paths.get("test-screenshots");
                    try {
                        Files.createDirectories(dir);
                        Files.copy(screenshot.toPath(),
                            dir.resolve(testName + "_" + timestamp + ".png"));
                    } catch (IOException e) {
                        System.err.println("Failed to save screenshot: " + e.getMessage());
                    }
                }
            }
        }


        // Usage in test class:
        import org.junit.jupiter.api.extension.RegisterExtension;

        @RegisterExtension
        ScreenshotExtension screenshotWatcher;

        @BeforeEach
        void setUp() {
            driver = DriverFactory.createDriver();
            screenshotWatcher = new ScreenshotExtension(driver);
        }
      indicators:
        - "getScreenshotAs"
        - "TestWatcher"
        - "test-screenshots"
    - concern: auth_testing
      belongs_in: src/test/java/
      rule_text: "Include dedicated authentication test classes that verify login, logout, session management, and unauthorized access. Reuse authenticated sessions via cookies for speed, but always test the auth flow itself separately. Check that protected pages redirect unauthenticated users."
      example: |
        // src/test/java/AuthTest.java
        package tests;

        import org.junit.jupiter.api.Test;
        import org.junit.jupiter.api.BeforeEach;
        import org.junit.jupiter.api.AfterEach;
        import org.openqa.selenium.WebDriver;
        import fixtures.DriverFactory;
        import fixtures.TestConfig;
        import pages.LoginPage;

        import static org.junit.jupiter.api.Assertions.*;

        class AuthTest {
            private WebDriver driver;
            private LoginPage loginPage;

            @BeforeEach
            void setUp() {
                driver = DriverFactory.createDriver();
                loginPage = new LoginPage(driver);
            }

            @AfterEach
            void tearDown() {
                if (driver != null) {
                    driver.quit();
                }
            }

            @Test
            void redirectsToLoginWhenNotAuthenticated() {
                driver.get(TestConfig.getBaseUrl() + "/dashboard");
                assertTrue(driver.getCurrentUrl().contains("/login"));
            }

            @Test
            void successfulLoginReachesDashboard() {
                loginPage.navigateTo(TestConfig.getBaseUrl());
                loginPage.login("testuser@example.com", "ValidPass123!");
                assertTrue(driver.getCurrentUrl().contains("/dashboard"));
            }

            @Test
            void invalidCredentialsShowError() {
                loginPage.navigateTo(TestConfig.getBaseUrl());
                loginPage.login("wrong@example.com", "badpassword");
                assertTrue(loginPage.getErrorMessage().contains("Invalid"));
            }

            @Test
            void logoutPreventsAccess() {
                loginPage.navigateTo(TestConfig.getBaseUrl());
                loginPage.login("testuser@example.com", "ValidPass123!");
                driver.findElement(By.cssSelector("[data-testid='logout-btn']")).click();
                driver.get(TestConfig.getBaseUrl() + "/dashboard");
                assertTrue(driver.getCurrentUrl().contains("/login"));
            }
        }
      indicators:
        - "AuthTest"
        - "getCurrentUrl"
        - "/login"
patterns:
  naming:
    pages: "PascalCase with Page suffix  -  LoginPage.java, DashboardPage.java, CheckoutPage.java"
    tests: "PascalCase with Test suffix  -  LoginTest.java, SearchTest.java, CheckoutTest.java"
    base_page: "src/test/java/pages/BasePage.java  -  abstract class with shared wait helpers"
    factory: "src/test/java/fixtures/DriverFactory.java  -  static createDriver() method"
    methods: "camelCase  -  test methods describe the scenario (redirectsToLoginWhenNotAuthenticated), POM methods describe the action (login, getErrorMessage)"
  data_flow:
    direction: "Test -> POM Methods (explicit waits) -> WebDriver -> Browser -> Application"
    rules:
      - "DriverFactory.createDriver() is the only place new ChromeDriver() is called."
      - "BasePage provides shared waitAndFind() and waitForUrlContains()  -  no copy-pasted wait logic in POMs."
      - "Tests call POM methods  -  never raw findElement() or By selectors."
      - "driver.quit() runs in @AfterEach  -  no orphaned browser processes."
      - "Screenshots are saved on test failure via JUnit5 TestWatcher extension for CI debugging."
  error_handling:
    recommended: "Use WebDriverWait with ExpectedConditions for all element interactions. Never use Thread.sleep(). Wrap driver.quit() in a null check in @AfterEach  -  if the driver failed to initialize, quit() on null throws NullPointerException. For StaleElementReferenceException, add retry logic in a utility method."
anti_patterns:
  - id: raw_selectors_in_tests
    severity: warning
    description: "Using findElement() and By selectors directly in test methods instead of Page Object Model methods. When a selector changes, every test that uses it breaks  -  with POMs, only one file needs updating."
    bad_example: |
      // Wrong: raw locators in test method  -  breaks when selector changes
      @Test
      void canLogIn() {
          driver.findElement(By.id("email-field")).sendKeys("user@test.com");
          driver.findElement(By.id("password-field")).sendKeys("password");
          driver.findElement(By.cssSelector("[type='submit']")).click();
          assertTrue(driver.getCurrentUrl().contains("dashboard"));
      }
    good_example: |
      // Correct: POM method  -  one place to update when UI changes
      @Test
      void canLogIn() {
          loginPage.navigateTo(baseUrl);
          DashboardPage dashboard = loginPage.login("user@test.com", "password");
          assertTrue(dashboard.isLoaded());
      }
  - id: thread_sleep
    severity: critical
    description: "Using Thread.sleep() instead of WebDriverWait with ExpectedConditions. Fixed sleeps are arbitrary  -  too short causes flakiness, too long slows the entire suite. A 2-second sleep in 200 tests adds 6+ minutes of pure waste."
    bad_example: |
      // Wrong: fixed sleep  -  arbitrary, slow on fast machines, still flaky on slow ones
      @Test
      void searchReturnsResults() throws InterruptedException {
          driver.findElement(By.id("search-input")).sendKeys("selenium");
          driver.findElement(By.id("search-btn")).click();
          Thread.sleep(3000);  // hope 3 seconds is enough
          List<WebElement> results = driver.findElements(By.cssSelector(".result-item"));
          assertFalse(results.isEmpty());
      }
    good_example: |
      // Correct: explicit wait  -  resolves as soon as elements appear, up to 10s
      @Test
      void searchReturnsResults() {
          SearchPage searchPage = new SearchPage(driver);
          searchPage.search("selenium");
          List<WebElement> results = searchPage.getResults();
          assertFalse(results.isEmpty());
      }

      // Inside SearchPage (POM):
      public List<WebElement> getResults() {
          wait.until(ExpectedConditions.presenceOfAllElementsLocatedBy(
              By.cssSelector(".result-item")
          ));
          return driver.findElements(By.cssSelector(".result-item"));
      }
  - id: no_base_page
    severity: warning
    description: "Page Objects don't extend a BasePage class. Wait helpers, common actions, and driver reference are duplicated in every POM. When the wait timeout needs changing, every file must be updated."
    bad_example: |
      // Wrong: each POM creates its own WebDriverWait and duplicates helpers
      public class LoginPage {
          private WebDriver driver;
          private WebDriverWait wait;

          public LoginPage(WebDriver driver) {
              this.driver = driver;
              this.wait = new WebDriverWait(driver, Duration.ofSeconds(10)); // duplicated
          }

          public void login(String email, String password) {
              wait.until(ExpectedConditions.presenceOfElementLocated(By.id("email")))
                  .sendKeys(email);
              // same wait pattern copy-pasted in every POM
          }
      }
    good_example: |
      // Correct: extend BasePage  -  shared wait helpers, single timeout config
      public class LoginPage extends BasePage {
          private static final By EMAIL_INPUT = By.id("email");
          private static final By PASSWORD_INPUT = By.id("password");
          private static final By SUBMIT_BUTTON = By.cssSelector("[type='submit']");

          public LoginPage(WebDriver driver) {
              super(driver);
          }

          public DashboardPage login(String email, String password) {
              waitAndFind(EMAIL_INPUT).sendKeys(email);
              waitAndFind(PASSWORD_INPUT).sendKeys(password);
              waitAndClick(SUBMIT_BUTTON);
              return new DashboardPage(driver);
          }
      }
  - id: driver_in_tests
    severity: warning
    description: "Calling new ChromeDriver() directly in test methods or @BeforeEach instead of using DriverFactory. Browser configuration is duplicated and must be updated in every test class when it changes."
    bad_example: |
      // Wrong: driver construction duplicated in every test class
      @BeforeEach
      void setUp() {
          ChromeOptions options = new ChromeOptions();
          options.addArguments("--headless");
          options.addArguments("--no-sandbox");
          driver = new ChromeDriver(options);  // duplicated in every test class
      }
    good_example: |
      // Correct: driver from shared factory  -  one place to configure all browser options
      @BeforeEach
      void setUp() {
          driver = DriverFactory.createDriver();
      }
  - id: hardcoded_urls
    severity: warning
    description: "Test URLs and credentials hardcoded in test classes instead of read from configuration or environment variables. Changing the staging URL means editing every test class."
    bad_example: |
      // Wrong: URL and credentials hardcoded in test
      @Test
      void loginWorks() {
          driver.get("https://staging.myapp.com/login");
          loginPage.login("testuser@email.com", "P@ssw0rd!");
      }
    good_example: |
      // Correct: URL from config, credentials from environment
      @Test
      void loginWorks() {
          driver.get(TestConfig.getBaseUrl() + "/login");
          loginPage.login(
              System.getenv("TEST_USERNAME"),
              System.getenv("TEST_PASSWORD")
          );
      }

      // src/test/java/fixtures/TestConfig.java
      public class TestConfig {
          private static final Properties props = new Properties();

          static {
              try (var is = TestConfig.class.getResourceAsStream("/test.properties")) {
                  if (is != null) props.load(is);
              } catch (IOException e) {
                  throw new RuntimeException("Failed to load test.properties", e);
              }
          }

          public static String getBaseUrl() {
              return System.getenv().getOrDefault("BASE_URL",
                  props.getProperty("base.url", "http://localhost:8080"));
          }
      }
  - id: no_teardown
    severity: critical
    description: "Missing driver.quit() in @AfterEach. Each test creates a new browser process  -  20 tests without cleanup means 20 browser processes competing for memory. In CI, this causes OOM kills and port exhaustion."
    bad_example: |
      // Wrong: no cleanup  -  browser process leaked after every test
      @BeforeEach
      void setUp() {
          driver = DriverFactory.createDriver();
      }

      // No @AfterEach at all  -  orphaned browser processes accumulate
      // Or only driver.close() which just closes the window, not the process:
      @AfterEach
      void tearDown() {
          driver.close();  // only closes window, doesn't kill chromedriver process
      }
    good_example: |
      // Correct: quit() with null check so cleanup always runs
      @AfterEach
      void tearDown() {
          if (driver != null) {
              driver.quit();  // kills browser AND chromedriver process
          }
      }

      // Even better: screenshot on failure before quit
      @AfterEach
      void tearDown(TestInfo testInfo) {
          try {
              // screenshot logic handled by ScreenshotExtension
          } finally {
              if (driver != null) {
                  driver.quit();
              }
          }
      }
---
