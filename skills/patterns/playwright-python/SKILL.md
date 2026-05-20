---
schema_version: "2.0.0"
id: playwright-python
name: "Playwright Python E2E"
version: "1.0.0"
description: "End-to-end testing with Playwright for Python  -  Page Object Models, pytest fixtures with conftest.py, sync or async API, storage_state-based auth, semantic selectors, and CI-optimized retries with tracing."
category: pattern
language: python
frameworks:
  - playwright
  - pytest
dependencies:
  none: []
detection:
  dependencies:
    any:
      - playwright
      - pytest-playwright
  source_indicators:
    - "from playwright"
    - "page.goto"
    - "page.locator"
    - "expect(page"
    - "sync_playwright"
    - "async_playwright"
    - "browser_context_args"
structure:
  required_dirs:
    - path: tests
      purpose: "Test modules organized by feature or user flow. Each test file covers one major feature (e.g., test_auth.py, test_checkout.py). Tests use pytest fixtures for page/context setup and call Page Object methods  -  they never contain raw locator queries."
  recommended_dirs:
    - path: pages
      purpose: "Page Object Model classes  -  one class per page or major UI component. Each POM receives a Playwright Page in __init__ and exposes methods that represent user intentions (login, submit_form). All selectors live here, never in test files."
    - path: conftest.py
      purpose: "Root conftest.py defines shared pytest fixtures: authenticated page via storage_state, base_url override, browser context options, and custom markers. All reusable test setup lives here  -  not duplicated across test files."
separation:
  rules:
    - concern: page_object_models
      belongs_in: pages/
      rule_text: "Encapsulate all page selectors and user-action sequences in Page Object Model classes. Each POM receives a Playwright Page object in __init__. Methods represent user intentions (login, add_to_cart, submit_form)  -  not individual click/fill operations. Tests call POM methods and assert outcomes."
      example: |
        # pages/base_page.py
        from playwright.sync_api import Page


        class BasePage:
            def __init__(self, page: Page) -> None:
                self.page = page

            def get_by_test_id(self, test_id: str):
                return self.page.get_by_test_id(test_id)

            def wait_for_url(self, url_pattern: str) -> None:
                self.page.wait_for_url(url_pattern)


        # pages/login_page.py
        from playwright.sync_api import Page
        from pages.base_page import BasePage


        class LoginPage(BasePage):
            def __init__(self, page: Page) -> None:
                super().__init__(page)

            def goto(self) -> None:
                self.page.goto("/login")

            def login(self, email: str, password: str) -> None:
                self.page.get_by_label("Email").fill(email)
                self.page.get_by_label("Password").fill(password)
                self.page.get_by_role("button", name="Sign in").click()
                self.page.wait_for_url("**/dashboard")

            def get_error_message(self) -> str | None:
                return self.page.get_by_role("alert").text_content()


        # In test file  -  test calls POM, not raw selectors
        def test_valid_login(page):
            login_page = LoginPage(page)
            login_page.goto()
            login_page.login("user@test.com", "password")
            expect(page).to_have_url(re.compile("/dashboard"))
      indicators:
        - "class LoginPage(BasePage)"
        - "class DashboardPage(BasePage)"
        - "LoginPage(page)"
    - concern: fixtures
      belongs_in: conftest.py
      rule_text: "Define shared fixtures in conftest.py  -  authenticated page contexts, page object factories, test data setup, and browser configuration. Auth fixtures load storage_state saved by a setup script. Tests that need auth use the authenticated_page fixture instead of performing login in each test."
      example: |
        # conftest.py
        import json
        from pathlib import Path

        import pytest
        from playwright.sync_api import BrowserContext, Page


        @pytest.fixture(scope="session")
        def browser_context_args(browser_context_args: dict) -> dict:
            return {
                **browser_context_args,
                "storage_state": ".auth/user.json",
            }


        @pytest.fixture
        def authenticated_page(context: BrowserContext) -> Page:
            """Provides a page with pre-loaded auth state from global setup."""
            page = context.new_page()
            yield page
            page.close()


        @pytest.fixture
        def login_page(page: Page):
            from pages.login_page import LoginPage
            return LoginPage(page)


        @pytest.fixture
        def dashboard_page(authenticated_page: Page):
            from pages.dashboard_page import DashboardPage
            return DashboardPage(authenticated_page)


        # tests/test_dashboard.py  -  uses auth fixture
        def test_shows_user_data(dashboard_page):
            dashboard_page.goto()
            expect(dashboard_page.page).to_have_title(re.compile("Dashboard"))
      indicators:
        - "browser_context_args"
        - "authenticated_page"
        - "storage_state"
    - concern: config
      belongs_in: pytest.ini / conftest.py
      rule_text: "Configure base_url, browser, headed/headless mode, timeouts, and retries via pytest CLI flags, pytest.ini, or conftest.py fixtures. Never hardcode localhost URLs in test files  -  use page.goto('/path') which pytest-playwright prepends with --base-url. Use environment variables for environment-specific settings."
      example: |
        # pytest.ini
        [pytest]
        addopts =
            --base-url http://localhost:3000
            --browser chromium
            --headed
        markers =
            smoke: Smoke tests for critical paths
            auth: Authentication flow tests

        # conftest.py  -  override base_url from environment
        import os
        import pytest


        @pytest.fixture(scope="session")
        def base_url():
            return os.environ.get("BASE_URL", "http://localhost:3000")


        # CI invocation with overrides
        # pytest --base-url=$BASE_URL --browser=chromium --retries=2 --tracing=on-first-retry
      indicators:
        - "pytest.ini"
        - "--base-url"
        - "base_url"
    - concern: auth_testing
      belongs_in: tests/
      rule_text: "Test authentication flows explicitly: login success, login failure, session expiry, unauthorized access to protected routes, and role-based access control. Use storage_state for speed in most tests, but include dedicated auth test files that exercise the actual login boundary. Verify secure headers on responses."
      example: |
        # tests/test_auth.py
        import re
        from playwright.sync_api import expect, Page


        def test_redirects_unauthenticated_to_login(page: Page):
            page.goto("/dashboard")
            expect(page).to_have_url(re.compile("/login"))


        def test_rejects_expired_session(page: Page, context):
            context.clear_cookies()
            page.goto("/dashboard")
            expect(page).to_have_url(re.compile("/login"))


        def test_returns_secure_headers(page: Page):
            response = page.goto("/")
            assert response is not None
            headers = response.headers
            assert "x-frame-options" in headers


        def test_invalid_credentials_show_error(login_page):
            login_page.goto()
            login_page.login("wrong@test.com", "wrongpassword")
            error = login_page.get_error_message()
            assert error is not None
            assert "invalid" in error.lower()
      indicators:
        - "clear_cookies"
        - "to_have_url"
        - "x-frame-options"
patterns:
  naming:
    tests: "snake_case with test_ prefix  -  test_auth.py, test_checkout.py, test_search.py"
    page_objects: "snake_case module, PascalCase class  -  login_page.py / LoginPage, dashboard_page.py / DashboardPage"
    fixtures: "snake_case  -  authenticated_page, login_page, browser_context_args"
    methods: "snake_case  -  login(), goto(), get_error_message(), submit_form()"
  data_flow:
    direction: "Global setup (login once) -> storage_state JSON -> conftest.py fixture -> Test function -> POM methods -> Page -> Browser -> Application"
    rules:
      - "Global setup script logs in once and saves cookies to .auth/user.json."
      - "conftest.py browser_context_args loads .auth/user.json  -  tests get pre-authenticated page with no login overhead."
      - "Test functions call POM methods  -  never raw Playwright locator calls."
      - "base_url from pytest.ini or --base-url flag  -  page.goto('/path') works in all environments."
      - "Retries via pytest-playwright --retries flag for CI  -  flaky tests get retried before failing."
  error_handling:
    recommended: "Use Playwright's built-in auto-waiting for element actions. Configure --tracing=on-first-retry for CI debugging. Use --screenshot=only-on-failure for visual snapshots. Never use time.sleep()  -  use page.wait_for_url(), locator.wait_for(), or expect() with timeout parameter."
anti_patterns:
  - id: raw-selectors-in-tests
    severity: critical
    description: "Tests contain raw page.locator() or page.query_selector() calls instead of Page Object methods. When the UI changes, every test that references that selector breaks. With POMs, only the Page Object file needs updating."
    bad_example: |
      # Raw selectors in test  -  brittle, hard to maintain
      def test_user_can_log_in(page):
          page.goto("/login")
          page.locator("#email-input").fill("user@test.com")
          page.locator("button.submit-btn").click()
          expect(page.locator(".dashboard-header")).to_be_visible()
    good_example: |
      # POM method  -  one place to update when UI changes
      def test_user_can_log_in(page):
          login_page = LoginPage(page)
          login_page.goto()
          login_page.login("user@test.com", "password")
          expect(page).to_have_url(re.compile("/dashboard"))
  - id: hardcoded-urls
    severity: warning
    description: "Using hardcoded localhost URLs in page.goto() calls instead of relative paths. Breaks when running against staging, CI, or any non-localhost environment. Configure base_url once via pytest.ini or --base-url flag."
    bad_example: |
      # Hardcoded URL  -  only works on localhost:3000
      page.goto("http://localhost:3000/dashboard")
      page.goto("http://localhost:3000/login")
    good_example: |
      # Relative path  -  pytest-playwright prepends base_url
      page.goto("/dashboard")
      page.goto("/login")
      # base_url configured via: pytest --base-url=http://localhost:3000
  - id: no-fixtures
    severity: warning
    description: "Tests don't use pytest fixtures for setup and teardown. Page objects are constructed inline, browser contexts are created manually, and auth setup is duplicated across test files. Fixtures centralize this in conftest.py."
    bad_example: |
      # No fixtures  -  setup duplicated in every test
      def test_dashboard(browser):
          context = browser.new_context(
              storage_state=".auth/user.json"
          )
          page = context.new_page()
          page.goto("/dashboard")
          # ... test logic ...
          context.close()

      def test_settings(browser):
          context = browser.new_context(
              storage_state=".auth/user.json"
          )
          page = context.new_page()
          # same setup duplicated again
    good_example: |
      # conftest.py  -  fixture handles setup/teardown
      @pytest.fixture
      def authenticated_page(context):
          page = context.new_page()
          yield page
          page.close()

      # Tests just declare the fixture they need
      def test_dashboard(dashboard_page):
          dashboard_page.goto()
          expect(dashboard_page.page).to_have_title(re.compile("Dashboard"))
  - id: auth-in-every-test
    severity: warning
    description: "Performing the full login flow (goto /login, fill email, fill password, click submit) at the start of every authenticated test. A 50-test suite wastes 50-150 seconds on redundant logins. Use storage_state to log in once."
    bad_example: |
      # Full login in every test  -  multiplies execution time
      def test_view_dashboard(page):
          page.goto("/login")
          page.get_by_label("Email").fill("user@test.com")
          page.get_by_label("Password").fill("Password123")
          page.get_by_role("button", name="Sign in").click()
          page.wait_for_url("**/dashboard")
          # Now the actual test starts...
    good_example: |
      # Auth fixture provides pre-authenticated page
      def test_view_dashboard(authenticated_page):
          authenticated_page.goto("/dashboard")
          expect(authenticated_page.get_by_role("heading", name="Dashboard")).to_be_visible()
  - id: no-retries
    severity: warning
    description: "Running Playwright tests in CI without retries or trace collection. A single transient failure causes the entire pipeline to fail with no diagnostic information. Configure retries and tracing for CI runs."
    bad_example: |
      # CI pipeline with no retries or diagnostics
      pytest tests/
      # One flaky test fails the entire build
      # No trace or screenshot to debug the failure
    good_example: |
      # CI pipeline with retries and diagnostics
      pytest tests/ \
        --retries=2 \
        --tracing=on-first-retry \
        --screenshot=only-on-failure \
        --output=test-results/

      # conftest.py  -  capture screenshot on failure
      @pytest.fixture(autouse=True)
      def capture_on_failure(page, request):
          yield
          if request.node.rep_call and request.node.rep_call.failed:
              page.screenshot(path=f"screenshots/{request.node.name}.png")
---
