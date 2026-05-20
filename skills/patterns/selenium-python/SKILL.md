---
schema_version: "2.0.0"
id: selenium-python
name: "Selenium Python E2E"
version: "1.0.0"
description: "End-to-end testing with Selenium WebDriver in Python  -  Page Object Models with BasePage, explicit waits via WebDriverWait (no time.sleep), pytest fixtures for driver lifecycle, screenshot capture on failure, and conftest.py for shared setup."
category: pattern
language: python
frameworks:
  - selenium
  - pytest
dependencies:
  none: []
detection:
  dependencies:
    any:
      - selenium
      - webdriver-manager
  source_indicators:
    - "from selenium"
    - "webdriver.Chrome"
    - "find_element("
    - "By.CSS_SELECTOR"
    - "WebDriverWait"
structure:
  required_dirs:
    - path: tests
      purpose: "Test modules organized by feature or user flow. Each test file tests one major user journey. Tests import Page Objects from tests/pages/ and use pytest fixtures from conftest.py  -  they never contain raw find_element() calls or By selectors."
  recommended_dirs:
    - path: tests/pages
      purpose: "Page Object Model classes  -  one class per page, extending BasePage. BasePage provides shared explicit wait helpers so individual POMs don't duplicate wait logic. Example: LoginPage(BasePage) uses self.wait_and_find() from BasePage."
    - path: tests/fixtures
      purpose: "Shared pytest fixtures beyond conftest.py  -  test data builders, API helpers for seeding state, authenticated session factories."
    - path: conftest.py
      purpose: "Root conftest.py with pytest fixtures for driver setup/teardown. The driver fixture is the only place webdriver.Chrome() (or Remote) is called  -  tests request the driver fixture rather than constructing drivers themselves."
separation:
  rules:
    - concern: page_object_models
      belongs_in: tests/pages/
      rule_text: "All locators and user-action sequences go in Page Object Model classes. POM classes inherit from BasePage which provides shared explicit wait helpers. Tests call high-level POM methods (login(), submit_contact_form())  -  they never call find_element() or By directly."
      example: |
        # tests/pages/base_page.py
        from selenium.webdriver.remote.webdriver import WebDriver
        from selenium.webdriver.remote.webelement import WebElement
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC


        class BasePage:
            def __init__(self, driver: WebDriver, timeout: int = 10):
                self.driver = driver
                self.wait = WebDriverWait(driver, timeout)

            def wait_and_find(self, locator: tuple[str, str]) -> WebElement:
                """Wait for element to be present then return it."""
                return self.wait.until(EC.presence_of_element_located(locator))

            def wait_and_click(self, locator: tuple[str, str]) -> None:
                """Wait for element to be clickable then click it."""
                element = self.wait.until(EC.element_to_be_clickable(locator))
                element.click()

            def find_by_test_id(self, test_id: str) -> WebElement:
                """Find element by data-testid attribute."""
                return self.wait_and_find((By.CSS_SELECTOR, f'[data-testid="{test_id}"]'))

            def wait_for_url_contains(self, url_fragment: str, timeout: int = 10) -> None:
                """Wait until the current URL contains the given fragment."""
                WebDriverWait(self.driver, timeout).until(
                    EC.url_contains(url_fragment)
                )


        # tests/pages/login_page.py
        import os
        from selenium.webdriver.common.by import By
        from tests.pages.base_page import BasePage


        class LoginPage(BasePage):
            EMAIL_INPUT = (By.CSS_SELECTOR, '[data-testid="email-input"]')
            PASSWORD_INPUT = (By.CSS_SELECTOR, '[data-testid="password-input"]')
            SUBMIT_BUTTON = (By.CSS_SELECTOR, '[data-testid="login-submit"]')
            ERROR_ALERT = (By.CSS_SELECTOR, '[data-testid="error-alert"]')

            def goto(self) -> None:
                base_url = os.environ.get("BASE_URL", "http://localhost:8000")
                self.driver.get(f"{base_url}/login")

            def login(self, email: str, password: str) -> None:
                self.wait_and_find(self.EMAIL_INPUT).send_keys(email)
                self.wait_and_find(self.PASSWORD_INPUT).send_keys(password)
                self.wait_and_click(self.SUBMIT_BUTTON)
                self.wait_for_url_contains("/dashboard")

            def get_error_message(self) -> str:
                return self.wait_and_find(self.ERROR_ALERT).text
      indicators:
        - "class LoginPage"
        - "(BasePage)"
        - "LoginPage(driver)"
    - concern: driver_factory
      belongs_in: conftest.py
      rule_text: "Create and configure the WebDriver instance in a pytest fixture defined in conftest.py. Test functions request the driver fixture  -  they never call webdriver.Chrome() or webdriver.Remote(). This centralizes browser configuration (headless mode in CI, window size, remote grid URL) in one place."
      example: |
        # conftest.py
        import os
        import pytest
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options as ChromeOptions
        from selenium.webdriver.chrome.service import Service
        from webdriver_manager.chrome import ChromeDriverManager


        @pytest.fixture
        def driver():
            """Create a Chrome WebDriver instance, headless in CI."""
            options = ChromeOptions()
            if os.environ.get("CI"):
                options.add_argument("--headless=new")
                options.add_argument("--no-sandbox")
                options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--window-size=1920,1080")

            service = Service(ChromeDriverManager().install())
            drv = webdriver.Chrome(service=service, options=options)
            drv.implicitly_wait(0)  # force explicit waits only

            yield drv

            drv.quit()


        @pytest.fixture
        def base_url():
            """Base URL for the application under test."""
            return os.environ.get("BASE_URL", "http://localhost:8000")
      indicators:
        - "@pytest.fixture"
        - "webdriver.Chrome("
        - "yield drv"
        - "drv.quit()"
    - concern: explicit_waits
      belongs_in: tests/pages/
      rule_text: "Always use explicit waits (WebDriverWait with expected_conditions) for every element interaction. Never use time.sleep()  -  it adds a fixed delay even when the element is ready, making tests slow and still flaky. Set a consistent timeout (10s for most elements, longer for page transitions)."
      example: |
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC

        # Correct: explicit wait  -  resolves immediately when element appears, fails after timeout
        wait = WebDriverWait(driver, 10)
        element = wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, '[data-testid="result-list"]'))
        )

        # Correct: wait for element to be clickable before interaction
        button = wait.until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-testid="submit-btn"]'))
        )
        button.click()

        # Correct: wait for visibility (element present AND displayed)
        visible_el = wait.until(
            EC.visibility_of_element_located((By.ID, "success-banner"))
        )

        # Wrong: fixed sleep  -  arbitrary, slow, still flaky
        # import time
        # time.sleep(3)
        # element = driver.find_element(By.CSS_SELECTOR, '[data-testid="result-list"]')
      indicators:
        - "WebDriverWait("
        - "EC.presence_of_element_located"
        - "EC.element_to_be_clickable"
    - concern: screenshot_on_failure
      belongs_in: conftest.py
      rule_text: "Capture a screenshot and save it to disk automatically when a test fails. In CI, screenshots are the primary debugging tool  -  without them, a failing test in a headless browser is nearly impossible to diagnose. Use a pytest hook or fixture finalizer."
      example: |
        # conftest.py  -  add to existing conftest
        import os
        from datetime import datetime
        import pytest


        @pytest.hookimpl(tryfirst=True, hookwrapper=True)
        def pytest_runtest_makereport(item, call):
            """Attach test outcome to the item for use in fixtures."""
            outcome = yield
            rep = outcome.get_result()
            setattr(item, f"rep_{rep.when}", rep)


        @pytest.fixture(autouse=True)
        def screenshot_on_failure(request, driver):
            """Capture screenshot when a test fails."""
            yield
            if hasattr(request.node, "rep_call") and request.node.rep_call.failed:
                screenshot_dir = os.path.join("test-screenshots")
                os.makedirs(screenshot_dir, exist_ok=True)
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                test_name = request.node.name.replace(" ", "_")
                filepath = os.path.join(screenshot_dir, f"{test_name}_{timestamp}.png")
                driver.save_screenshot(filepath)
                print(f"\nScreenshot saved: {filepath}")
      indicators:
        - "save_screenshot"
        - "pytest_runtest_makereport"
        - "test-screenshots"
    - concern: auth_testing
      belongs_in: tests/
      rule_text: "Include dedicated authentication test modules that verify login, logout, session management, and unauthorized access. Reuse authenticated sessions via cookies for speed, but always test the auth flow itself separately. Check that protected pages redirect unauthenticated users."
      example: |
        # tests/test_auth.py
        import pytest
        from tests.pages.login_page import LoginPage


        class TestAuthentication:
            def test_redirects_to_login_when_not_authenticated(self, driver, base_url):
                driver.get(f"{base_url}/dashboard")
                assert "/login" in driver.current_url

            def test_successful_login_reaches_dashboard(self, driver, base_url):
                login_page = LoginPage(driver)
                login_page.goto()
                login_page.login("testuser@example.com", "ValidPass123!")
                assert "/dashboard" in driver.current_url

            def test_invalid_credentials_show_error(self, driver, base_url):
                login_page = LoginPage(driver)
                login_page.goto()
                login_page.login("wrong@example.com", "badpassword")
                assert "Invalid" in login_page.get_error_message()

            def test_logout_prevents_access(self, driver, base_url):
                login_page = LoginPage(driver)
                login_page.goto()
                login_page.login("testuser@example.com", "ValidPass123!")
                driver.find_element(By.CSS_SELECTOR, '[data-testid="logout-btn"]').click()
                driver.get(f"{base_url}/dashboard")
                assert "/login" in driver.current_url
      indicators:
        - "test_auth"
        - "current_url"
        - "/login"
patterns:
  naming:
    pages: "snake_case with _page suffix  -  login_page.py, dashboard_page.py, checkout_page.py"
    tests: "snake_case with test_ prefix  -  test_login.py, test_search.py, test_checkout.py"
    base_page: "tests/pages/base_page.py  -  BasePage class with shared wait helpers"
    conftest: "conftest.py  -  pytest fixtures for driver, base_url, screenshot_on_failure"
    methods: "snake_case  -  test methods start with test_, POM methods describe the action (login, get_error_message)"
  data_flow:
    direction: "Test -> POM Methods (explicit waits) -> WebDriver -> Browser -> Application"
    rules:
      - "The driver fixture in conftest.py is the only place webdriver.Chrome() is called."
      - "BasePage provides shared wait_and_find() and wait_for_url_contains()  -  no copy-pasted wait logic in POMs."
      - "Tests call POM methods  -  never raw find_element() or By selectors."
      - "driver.quit() runs in the fixture teardown  -  no orphaned browser processes."
      - "Screenshots are saved on test failure via pytest hook for CI debugging."
  error_handling:
    recommended: "Use pytest fixture teardown (yield pattern) for guaranteed driver cleanup. WebDriverWait raises TimeoutException with a descriptive message when elements are not found  -  let it propagate rather than catching and re-raising. For flaky StaleElementReferenceException, add a retry decorator to the specific POM method."
anti_patterns:
  - id: raw_selectors_in_tests
    severity: warning
    description: "Using find_element() and By selectors directly in test functions instead of Page Object Model methods. When a selector changes, every test that uses it breaks  -  with POMs, only one file needs updating."
    bad_example: |
      # Wrong: raw locators in test function  -  breaks when selector changes
      def test_can_log_in(driver):
          driver.find_element(By.CSS_SELECTOR, "#email-field").send_keys("user@test.com")
          driver.find_element(By.CSS_SELECTOR, "#password-field").send_keys("password")
          driver.find_element(By.CSS_SELECTOR, '[type="submit"]').click()
          assert "dashboard" in driver.current_url
    good_example: |
      # Correct: POM method  -  one place to update when UI changes
      def test_can_log_in(driver):
          login_page = LoginPage(driver)
          login_page.goto()
          login_page.login("user@test.com", "password")
          assert "dashboard" in driver.current_url
  - id: time_sleep
    severity: critical
    description: "Using time.sleep() instead of WebDriverWait with expected_conditions. Fixed sleeps are arbitrary  -  too short causes flakiness, too long slows the entire suite. A 2-second sleep in 200 tests adds 6+ minutes of pure waste."
    bad_example: |
      import time

      # Wrong: fixed sleep  -  arbitrary, slow on fast machines, still flaky on slow ones
      def test_search_results(driver):
          driver.find_element(By.ID, "search-input").send_keys("selenium")
          driver.find_element(By.ID, "search-btn").click()
          time.sleep(3)  # hope 3 seconds is enough
          results = driver.find_elements(By.CSS_SELECTOR, ".result-item")
          assert len(results) > 0
    good_example: |
      from selenium.webdriver.support.ui import WebDriverWait
      from selenium.webdriver.support import expected_conditions as EC

      # Correct: explicit wait  -  resolves as soon as elements appear, up to 10s
      def test_search_results(driver):
          search_page = SearchPage(driver)
          search_page.search("selenium")
          results = search_page.get_results()
          assert len(results) > 0

      # Inside SearchPage (POM):
      def get_results(self) -> list:
          self.wait.until(
              EC.presence_of_all_elements_located((By.CSS_SELECTOR, ".result-item"))
          )
          return self.driver.find_elements(By.CSS_SELECTOR, ".result-item")
  - id: no_base_page
    severity: warning
    description: "Page Objects don't inherit from a BasePage class. Wait helpers, common actions, and driver reference are duplicated in every POM. When wait timeout needs changing, every file must be updated."
    bad_example: |
      # Wrong: each POM creates its own WebDriverWait and duplicates helpers
      class LoginPage:
          def __init__(self, driver):
              self.driver = driver
              self.wait = WebDriverWait(driver, 10)  # duplicated in every POM

          def login(self, email, password):
              self.wait.until(
                  EC.presence_of_element_located((By.ID, "email"))
              ).send_keys(email)
              # same wait pattern copy-pasted everywhere
    good_example: |
      # Correct: inherit from BasePage  -  shared wait helpers, single timeout config
      class LoginPage(BasePage):
          EMAIL_INPUT = (By.ID, "email")
          PASSWORD_INPUT = (By.ID, "password")

          def login(self, email: str, password: str) -> None:
              self.wait_and_find(self.EMAIL_INPUT).send_keys(email)
              self.wait_and_find(self.PASSWORD_INPUT).send_keys(password)
              self.wait_and_click(self.SUBMIT_BUTTON)
  - id: driver_in_tests
    severity: warning
    description: "Calling webdriver.Chrome() or webdriver.Remote() directly in test functions instead of using the shared pytest fixture. Browser configuration is duplicated and must be updated in every test file when it changes."
    bad_example: |
      # Wrong: driver construction duplicated in every test file
      def test_homepage(self):
          driver = webdriver.Chrome()
          driver.get("http://localhost:8000")
          assert "Welcome" in driver.title
          driver.quit()
    good_example: |
      # Correct: driver from shared fixture  -  one place to configure all browser options
      def test_homepage(driver, base_url):
          driver.get(base_url)
          assert "Welcome" in driver.title
  - id: hardcoded_urls
    severity: warning
    description: "Test URLs and credentials hardcoded in test functions instead of read from fixtures, environment variables, or config. Changing the staging URL means editing every test file."
    bad_example: |
      # Wrong: URL and credentials hardcoded in test
      def test_login(driver):
          driver.get("https://staging.myapp.com/login")
          login_page = LoginPage(driver)
          login_page.login("testuser@email.com", "P@ssw0rd!")
    good_example: |
      # Correct: URL from fixture, credentials from environment
      def test_login(driver, base_url):
          driver.get(f"{base_url}/login")
          login_page = LoginPage(driver)
          login_page.login(
              os.environ["TEST_USERNAME"],
              os.environ["TEST_PASSWORD"],
          )
  - id: no_conftest
    severity: warning
    description: "No conftest.py for shared fixtures. Driver setup, teardown, and common fixtures are duplicated across test files instead of centralized. Adding a new browser option requires editing every test module."
    bad_example: |
      # tests/test_login.py  -  setup duplicated in every test file
      import pytest
      from selenium import webdriver

      class TestLogin:
          def setup_method(self):
              self.driver = webdriver.Chrome()  # duplicated everywhere

          def teardown_method(self):
              self.driver.quit()  # duplicated everywhere

      # tests/test_search.py  -  same setup copy-pasted
      class TestSearch:
          def setup_method(self):
              self.driver = webdriver.Chrome()  # same duplication
    good_example: |
      # conftest.py  -  single source of truth for driver lifecycle
      @pytest.fixture
      def driver():
          options = ChromeOptions()
          if os.environ.get("CI"):
              options.add_argument("--headless=new")
          drv = webdriver.Chrome(options=options)
          yield drv
          drv.quit()

      # tests/test_login.py  -  just request the fixture
      class TestLogin:
          def test_valid_login(self, driver):
              login_page = LoginPage(driver)
              # no setup/teardown needed  -  fixture handles it
---
