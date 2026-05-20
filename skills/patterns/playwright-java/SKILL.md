---
schema_version: "2.0.0"
id: playwright-java
name: "Playwright Java E2E"
version: "1.0.0"
description: "End-to-end testing with Playwright for Java  -  Page Object Models, JUnit 5 lifecycle with Playwright.create(), BrowserContext-based auth state, semantic locators, and CI-optimized retries with tracing."
category: pattern
language: java
frameworks:
  - com.microsoft.playwright
  - JUnit5
dependencies:
  none: []
detection:
  dependencies:
    any:
      - com.microsoft.playwright
      - "com.microsoft.playwright:playwright"
  source_indicators:
    - "import com.microsoft.playwright"
    - "Playwright.create()"
    - "Page"
    - "Locator"
    - "Browser"
    - "BrowserContext"
    - "assertThat(page"
structure:
  required_dirs:
    - path: src/test/java
      purpose: "Test classes organized by feature or user flow. Each test class manages Playwright lifecycle via @BeforeAll/@AfterAll for Playwright/Browser and @BeforeEach/@AfterEach for BrowserContext/Page. Tests call Page Object methods  -  they never contain raw locator queries."
  recommended_dirs:
    - path: src/test/java/pages
      purpose: "Page Object Model classes  -  one class per page or major UI component. Each POM receives a Page in its constructor and exposes methods that represent user intentions (login, submitForm). All locator definitions live here, never in test classes."
    - path: src/test/java/fixtures
      purpose: "Browser factory, base test class with Playwright lifecycle management, and authenticated context providers. The base test class creates Playwright and Browser once per class, and BrowserContext/Page per test method."
separation:
  rules:
    - concern: page_object_models
      belongs_in: src/test/java/pages/
      rule_text: "Encapsulate all page locators and user-action sequences in Page Object Model classes. Each POM receives a Playwright Page in its constructor and exposes methods that represent user intentions (login, navigateToSettings). Tests call POM methods and assert outcomes  -  they never call page.locator() or page.getByRole() directly."
      example: |
        // pages/BasePage.java
        package pages;

        import com.microsoft.playwright.Page;
        import com.microsoft.playwright.Locator;

        public abstract class BasePage {
            protected final Page page;

            public BasePage(Page page) {
                this.page = page;
            }

            protected Locator getByTestId(String testId) {
                return page.getByTestId(testId);
            }

            protected void waitForUrl(String urlPattern) {
                page.waitForURL(urlPattern);
            }
        }

        // pages/LoginPage.java
        package pages;

        import com.microsoft.playwright.Page;
        import com.microsoft.playwright.options.AriaRole;

        public class LoginPage extends BasePage {

            public LoginPage(Page page) {
                super(page);
            }

            public void navigate() {
                page.navigate("/login");
            }

            public DashboardPage login(String email, String password) {
                page.getByLabel("Email").fill(email);
                page.getByLabel("Password").fill(password);
                page.getByRole(AriaRole.BUTTON,
                    new Page.GetByRoleOptions().setName("Sign in")).click();
                page.waitForURL("**/dashboard");
                return new DashboardPage(page);
            }

            public String getErrorMessage() {
                return page.getByRole(AriaRole.ALERT).textContent();
            }
        }

        // In test  -  calls POM, not raw selectors
        LoginPage loginPage = new LoginPage(page);
        loginPage.navigate();
        DashboardPage dashboard = loginPage.login("user@test.com", "password");
        assertThat(page).hasURL(Pattern.compile("/dashboard"));
      indicators:
        - "class LoginPage extends BasePage"
        - "class DashboardPage extends BasePage"
        - "new LoginPage(page)"
    - concern: browser_factory
      belongs_in: src/test/java/fixtures/
      rule_text: "Playwright and Browser lifecycle management lives in a base test class or factory. Playwright.create() and browser.launch() run once per test class (@BeforeAll). BrowserContext and Page are created per test (@BeforeEach) and closed in @AfterEach. Tests never call Playwright.create() or browser.launch() directly."
      example: |
        // fixtures/PlaywrightTestBase.java
        package fixtures;

        import com.microsoft.playwright.*;
        import org.junit.jupiter.api.*;

        public abstract class PlaywrightTestBase {
            protected static Playwright playwright;
            protected static Browser browser;
            protected BrowserContext context;
            protected Page page;

            @BeforeAll
            static void launchBrowser() {
                playwright = Playwright.create();
                browser = playwright.chromium().launch(new BrowserType.LaunchOptions()
                    .setHeadless(true));
            }

            @AfterAll
            static void closeBrowser() {
                browser.close();
                playwright.close();
            }

            @BeforeEach
            void createContextAndPage() {
                context = browser.newContext(new Browser.NewContextOptions()
                    .setBaseURL(TestConfig.getBaseUrl()));
                page = context.newPage();
            }

            @AfterEach
            void closeContext() {
                context.close();
            }
        }

        // Tests/LoginTests.java  -  extends base
        class LoginTests extends PlaywrightTestBase {
            @Test
            void validCredentialsRedirectToDashboard() {
                LoginPage loginPage = new LoginPage(page);
                loginPage.navigate();
                DashboardPage dashboard = loginPage.login("admin", "pass");
                assertThat(page).hasURL(Pattern.compile("/dashboard"));
            }
        }
      indicators:
        - "PlaywrightTestBase"
        - "Playwright.create()"
        - "@BeforeAll"
    - concern: config
      belongs_in: src/test/java/fixtures/
      rule_text: "Configure base URL, browser type, headless mode, timeouts, and retries via a TestConfig class that reads from system properties or environment variables. Never hardcode localhost URLs in test files  -  use relative paths with baseURL set on the BrowserContext. Use system properties so CI can override without code changes."
      example: |
        // fixtures/TestConfig.java
        package fixtures;

        public final class TestConfig {

            private TestConfig() {}

            public static String getBaseUrl() {
                return System.getProperty("base.url",
                    System.getenv("BASE_URL") != null
                        ? System.getenv("BASE_URL")
                        : "http://localhost:3000");
            }

            public static String getBrowser() {
                return System.getProperty("browser", "chromium");
            }

            public static boolean isHeadless() {
                return Boolean.parseBoolean(
                    System.getProperty("headless", "true"));
            }

            public static int getTimeout() {
                return Integer.parseInt(
                    System.getProperty("timeout", "30000"));
            }
        }

        // CI invocation with overrides
        // mvn test -Dbase.url=$BASE_URL -Dbrowser=chromium -Dheadless=true
      indicators:
        - "TestConfig"
        - "System.getProperty"
        - "BASE_URL"
    - concern: auth_testing
      belongs_in: src/test/java/
      rule_text: "Test authentication flows explicitly: login success, login failure, session expiry, unauthorized access to protected routes, and role-based access. Use storageState for speed in most tests, but include dedicated auth test classes that exercise the actual login boundary. Verify secure headers on responses."
      example: |
        // tests/AuthTests.java
        package tests;

        import com.microsoft.playwright.*;
        import fixtures.PlaywrightTestBase;
        import org.junit.jupiter.api.Test;

        import java.util.regex.Pattern;

        import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
        import static org.junit.jupiter.api.Assertions.*;

        class AuthTests extends PlaywrightTestBase {

            @Test
            void redirectsUnauthenticatedUsersToLogin() {
                page.navigate("/dashboard");
                assertThat(page).hasURL(Pattern.compile("/login"));
            }

            @Test
            void rejectsExpiredSession() {
                context.clearCookies();
                page.navigate("/dashboard");
                assertThat(page).hasURL(Pattern.compile("/login"));
            }

            @Test
            void returnsSecureHeaders() {
                var response = page.navigate("/");
                assertNotNull(response);
                var headers = response.headers();
                assertTrue(headers.containsKey("x-frame-options"));
            }

            @Test
            void invalidCredentialsShowError() {
                LoginPage loginPage = new LoginPage(page);
                loginPage.navigate();
                loginPage.login("wrong@test.com", "wrongpassword");
                String error = loginPage.getErrorMessage();
                assertTrue(error.toLowerCase().contains("invalid"));
            }
        }
      indicators:
        - "clearCookies"
        - "hasURL"
        - "x-frame-options"
patterns:
  naming:
    pages: "PascalCase with Page suffix  -  LoginPage.java, DashboardPage.java, CheckoutPage.java"
    tests: "PascalCase with Tests suffix  -  LoginTests.java, SearchTests.java, CheckoutTests.java"
    fixtures: "PascalCase  -  PlaywrightTestBase.java, TestConfig.java, AuthenticatedTestBase.java"
    methods: "camelCase  -  login(), navigate(), getErrorMessage(), submitForm()"
  data_flow:
    direction: "Global setup (login once) -> storageState JSON -> AuthenticatedTestBase -> Test class -> POM methods -> Page -> Browser -> Application"
    rules:
      - "Global setup class logs in once and saves cookies to .auth/user.json via BrowserContext.storageState()."
      - "AuthenticatedTestBase loads .auth/user.json into BrowserContext  -  tests get pre-authenticated Page with no login overhead."
      - "Test classes call POM methods  -  never raw Playwright locator calls."
      - "baseURL set on BrowserContext via TestConfig  -  page.navigate('/path') works in all environments."
      - "Playwright/Browser created once per class (@BeforeAll). Context/Page created per test (@BeforeEach)."
  error_handling:
    recommended: "Use Playwright's built-in auto-waiting for element actions. Configure tracing on test failure for CI debugging. Use screenshot capture in @AfterEach when test fails. Never use Thread.sleep()  -  use page.waitForURL(), locator.waitFor(), or assertThat() with timeout."
anti_patterns:
  - id: raw-selectors-in-tests
    severity: critical
    description: "Tests contain raw page.locator() or page.querySelector() calls instead of Page Object methods. When the UI changes, every test that references that locator breaks. With POMs, only the Page Object file needs updating."
    bad_example: |
      // Raw selectors in test  -  brittle, hard to maintain
      @Test
      void userCanLogIn() {
          page.navigate("/login");
          page.locator("#email-input").fill("user@test.com");
          page.locator("button.submit-btn").click();
          assertThat(page.locator(".dashboard-header")).isVisible();
      }
    good_example: |
      // POM method  -  one place to update when UI changes
      @Test
      void userCanLogIn() {
          LoginPage loginPage = new LoginPage(page);
          loginPage.navigate();
          loginPage.login("user@test.com", "password");
          assertThat(page).hasURL(Pattern.compile("/dashboard"));
      }
  - id: no-browser-close
    severity: critical
    description: "Tests don't properly close Playwright, Browser, or BrowserContext. Leaves browser processes running, causes resource leaks, port exhaustion, and CI runner memory issues. Always close in @AfterAll and @AfterEach."
    bad_example: |
      // No cleanup  -  browser processes accumulate
      class LoginTests {
          static Playwright playwright;
          static Browser browser;
          Page page;

          @BeforeAll
          static void setup() {
              playwright = Playwright.create();
              browser = playwright.chromium().launch();
          }

          @BeforeEach
          void createPage() {
              page = browser.newPage();
          }

          // No @AfterEach or @AfterAll  -  resources leak
      }
    good_example: |
      class LoginTests {
          static Playwright playwright;
          static Browser browser;
          BrowserContext context;
          Page page;

          @BeforeAll
          static void launchBrowser() {
              playwright = Playwright.create();
              browser = playwright.chromium().launch();
          }

          @AfterAll
          static void closeBrowser() {
              browser.close();
              playwright.close();
          }

          @BeforeEach
          void createContext() {
              context = browser.newContext();
              page = context.newPage();
          }

          @AfterEach
          void closeContext() {
              context.close();
          }
      }
  - id: hardcoded-urls
    severity: warning
    description: "Using hardcoded localhost URLs in page.navigate() calls instead of relative paths with baseURL. Breaks when running against staging, CI, or any non-localhost environment. Set baseURL once on BrowserContext via TestConfig."
    bad_example: |
      // Hardcoded URL  -  only works on localhost:3000
      page.navigate("http://localhost:3000/dashboard");
      page.navigate("http://localhost:3000/login");
    good_example: |
      // Relative path  -  Playwright prepends baseURL from context
      page.navigate("/dashboard");
      page.navigate("/login");
      // baseURL set via: new Browser.NewContextOptions().setBaseURL(TestConfig.getBaseUrl())
  - id: auth-in-every-test
    severity: warning
    description: "Performing the full login flow (navigate to /login, fill email, fill password, click submit) at the start of every authenticated test. A 50-test suite wastes 50-150 seconds on redundant logins. Use storageState to log in once."
    bad_example: |
      // Full login in every test  -  multiplies execution time
      @Test
      void viewDashboard() {
          page.navigate("/login");
          page.getByLabel("Email").fill("user@test.com");
          page.getByLabel("Password").fill("Password123");
          page.getByRole(AriaRole.BUTTON,
              new Page.GetByRoleOptions().setName("Sign in")).click();
          page.waitForURL("**/dashboard");
          // Now the actual test starts...
      }
    good_example: |
      // Auth base class provides pre-authenticated context
      class DashboardTests extends AuthenticatedTestBase {
          @Test
          void viewDashboard() {
              page.navigate("/dashboard");
              assertThat(page.getByRole(AriaRole.HEADING,
                  new Page.GetByRoleOptions().setName("Dashboard"))).isVisible();
          }
      }

      // fixtures/AuthenticatedTestBase.java
      public abstract class AuthenticatedTestBase extends PlaywrightTestBase {
          @Override
          void createContextAndPage() {
              context = browser.newContext(new Browser.NewContextOptions()
                  .setBaseURL(TestConfig.getBaseUrl())
                  .setStorageStatePath(Paths.get(".auth/user.json")));
              page = context.newPage();
          }
      }
---
