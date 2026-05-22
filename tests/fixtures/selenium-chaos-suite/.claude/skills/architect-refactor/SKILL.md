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

The following rules come from the **Selenium E2E** architecture blueprint. Treat them as
hard constraints  -  they are not suggestions. Every file move you make must end up satisfying
these rules.

- page_object_models -> tests/e2e/pages
  Rule: All locators and user-action sequences go in Page Object Model classes. POM classes extend BasePage which provides shared explicit wait helpers. Tests call high-level POM methods (login(), submitContactForm())  -  they never call driver.findElement() or By directly.
  Example:
    // tests/e2e/pages/base.page.ts
    import { WebDriver, By, until, WebElement } from 'selenium-webdriver';
    
    export class BasePage {
      constructor(protected driver: WebDriver) {}
    
      protected async waitAndFind(testId: string, timeout = 5000): Promise<WebElement> {
        const locator = By.css(`[data-testid="${testId}"]`);
        await this.driver.wait(until.elementLocated(locator), timeout);
        return this.driver.findElement(locator);
      }
    
      protected async waitForUrl(urlFragment: string, timeout = 5000) {
        await this.driver.wait(
          async () => (await this.driver.getCurrentUrl()).includes(urlFragment),
          timeout,
          `URL did not contain "${urlFragment}" within ${timeout}ms`
        );
      }
    }
    
    // tests/e2e/pages/login.page.ts
    import { By } from 'selenium-webdriver';
    import { BasePage } from './base.page';
    
    export class LoginPage extends BasePage {
      async goto() {
        await this.driver.get(`${process.env.BASE_URL ?? 'http://localhost:3000'}/login`);
      }
    
      async login(email: string, password: string) {
        const emailInput = await this.waitAndFind('email-input');
        const passwordInput = await this.waitAndFind('password-input');
        await emailInput.sendKeys(email);
        await passwordInput.sendKeys(password);
        const submitBtn = await this.waitAndFind('login-submit');
        await submitBtn.click();
        await this.waitForUrl('/dashboard');
      }
    
      async getErrorMessage() {
        const alert = await this.waitAndFind('error-alert');
        return alert.getText();
      }
    }

- explicit_waits -> tests/e2e/pages
  Rule: Always use explicit waits (driver.wait with until.*) for every element interaction. Never use driver.sleep() or setTimeout()  -  they add fixed delay even when the element is ready, making tests slow and still flaky. Set a consistent timeout (5-10s for most elements, longer for page transitions).
  Example:
    import { until, By, WebDriver } from 'selenium-webdriver';
    
    // ✓ Explicit wait  -  resolves immediately when element appears, fails after timeout
    const locator = By.css('[data-testid="result-list"]');
    await driver.wait(until.elementLocated(locator), 8000, 'Result list not found within 8s');
    const el = await driver.findElement(locator);
    await driver.wait(until.elementIsVisible(el), 3000);
    
    // ✓ Wait for element to become clickable
    await driver.wait(until.elementIsEnabled(el), 3000);
    await el.click();
    
    // ❌ Fixed sleep  -  arbitrary, slow, still flaky:
    // await driver.sleep(3000);
    // await driver.findElement(locator); // may still fail if 3s wasn't enough

- driver_factory -> tests/e2e/fixtures
  Rule: Create and configure the WebDriver instance in a single factory function exported from tests/e2e/fixtures/create-driver.ts. Test files import createDriver()  -  they never call `new Builder()`. This centralizes browser configuration (headless mode in CI, device emulation, etc.) in one place.
  Example:
    // tests/e2e/fixtures/create-driver.ts
    import { Builder, WebDriver, Capabilities } from 'selenium-webdriver';
    import chrome from 'selenium-webdriver/chrome';
    
    export async function createDriver(): Promise<WebDriver> {
      const options = new chrome.Options();
      if (process.env.CI) {
        options.addArguments('--headless', '--no-sandbox', '--disable-dev-shm-usage');
      }
      return new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();
    }
    
    // tests/e2e/auth.spec.ts
    import { createDriver } from '../fixtures/create-driver';
    let driver: WebDriver;
    beforeEach(async () => { driver = await createDriver(); });
    afterEach(async () => {
      try { await driver.quit(); } catch { /* already closed */ }
    });

- screenshot_on_failure -> tests/e2e
  Rule: Capture a screenshot and save it to disk in the afterEach (or afterAll) error handler. In CI, screenshots are the primary debugging tool  -  without them, a failing test in a headless browser is nearly impossible to diagnose.
  Example:
    // tests/e2e/helpers/screenshot.ts
    import { WebDriver } from 'selenium-webdriver';
    import fs from 'fs';
    import path from 'path';
    
    export async function screenshotOnFailure(driver: WebDriver, testName: string) {
      const screenshot = await driver.takeScreenshot();
      const dir = path.resolve('test-screenshots');
      fs.mkdirSync(dir, { recursive: true });
      const filename = `${testName.replace(/\s+/g, '-')}-${Date.now()}.png`;
      fs.writeFileSync(path.join(dir, filename), screenshot, 'base64');
      console.log(`Screenshot saved: ${path.join(dir, filename)}`);
    }
    
    // In test file:
    afterEach(async function() {
      // Mocha: this.currentTest.state === 'failed'
      if (this.currentTest?.state === 'failed') {
        await screenshotOnFailure(driver, this.currentTest.fullTitle());
      }
      await driver.quit();
    });

- auth_testing -> tests
  Rule: Include dedicated authentication test suites that verify login, logout, session management, and unauthorized access. Reuse authenticated sessions via cookies or tokens for speed, but always test the auth flow itself separately. Verify CSRF token handling on form submissions. Check that protected pages redirect unauthenticated users.
  Example:
    // tests/auth.spec.ts
    describe('Authentication', () => {
      it('redirects to login when not authenticated', async () => {
        await driver.get(`${baseUrl}/dashboard`);
        expect(await driver.getCurrentUrl()).toContain('/login');
      });
    
      it('prevents access after logout', async () => {
        await loginAs('testuser');
        await driver.findElement(By.id('logout')).click();
        await driver.get(`${baseUrl}/dashboard`);
        expect(await driver.getCurrentUrl()).toContain('/login');
      });
    });

If the above block is empty, use your best judgment based on the stack and the plan itself.

## Anti-patterns to avoid

After each step, verify you have not introduced any of the following:

- raw_selectors_in_tests [warning]
  Using driver.findElement() and By selectors directly in test spec files instead of Page Object Model methods. When a selector changes, every test that uses it breaks  -  with POMs, only one file needs updating.
  Bad example:
    // ❌ Raw locators in test file  -  breaks when selector changes
    it('can log in', async () => {
      await driver.findElement(By.css('#email-field')).sendKeys('user@test.com');
      await driver.findElement(By.css('#password-field')).sendKeys('password');
      await driver.findElement(By.css('[type="submit"]')).click();
    });
  Good example:
    // ✓ POM method  -  one place to update when UI changes
    it('can log in', async () => {
      await loginPage.login('user@test.com', 'password');
    });

- implicit_or_fixed_waits [critical]
  Using driver.manage().setImplicitWaitTimeout() or driver.sleep() instead of explicit waits. Implicit waits apply globally and interact badly with explicit waits. Fixed sleeps are arbitrary  -  too short causes flakiness, too long slows CI.
  Bad example:
    // ❌ Global implicit wait  -  interacts badly with explicit waits
    await driver.manage().setImplicitWaitTimeout(5000);
    
    // ❌ Fixed sleep  -  arbitrary, slow on fast machines, still flaky on slow ones
    await driver.sleep(3000);
    const el = await driver.findElement(By.css('#result'));
  Good example:
    // ✓ Explicit wait  -  resolves as soon as element appears, up to 5s
    const el = await driver.wait(
      until.elementLocated(By.css('[data-testid="result"]')),
      5000,
      'Result element not found within 5s'
    );

- driver_not_quit [critical]
  Not calling driver.quit() after each test leaves orphaned Chrome/Firefox processes. Each test creates a new browser process  -  20 tests without cleanup = 20 browser processes competing for memory. In CI, this causes OOM kills.
  Bad example:
    // ❌ No cleanup  -  browser process leaked after every test
    afterEach(async () => {
      // Missing: await driver.quit();
    });
  Good example:
    // ✓ quit() in try/catch so cleanup always runs
    afterEach(async () => {
      try {
        await driver.quit();
      } catch {
        // driver may already be closed if test crashed it
      }
    });

- new_builder_in_tests [warning]
  Calling `new Builder()` in individual test files instead of importing from the shared driver factory. Browser configuration (headless mode, window size, proxy) is duplicated and must be updated in every test file when it changes.
  Bad example:
    // ❌ Builder configuration duplicated in every test file
    beforeEach(async () => {
      driver = await new Builder().forBrowser('chrome').build(); // headless? window size? proxy?
    });
  Good example:
    // ✓ Import from shared factory  -  one place to configure all browser options
    import { createDriver } from '../fixtures/create-driver';
    beforeEach(async () => { driver = await createDriver(); });

- xpath_selectors [warning]
  Using XPath selectors (By.xpath()) for element selection. XPath selectors are tightly coupled to the DOM tree structure  -  adding a wrapper <div>, moving elements, or renaming tags breaks the selector. They are also slow compared to CSS selectors.
  Bad example:
    // ❌ XPath  -  breaks on any DOM structure change
    await driver.findElement(By.xpath('//div[@class="login-form"]/form/div[2]/input')).sendKeys(email);
    await driver.findElement(By.xpath('//button[contains(text(),"Submit")]')).click();
  Good example:
    // ✓ data-testid selector  -  stable regardless of DOM structure
    await driver.findElement(By.css('[data-testid="email-input"]')).sendKeys(email);
    await driver.findElement(By.css('[data-testid="login-submit"]')).click();

- no_screenshot_on_failure [warning]
  Not capturing screenshots on test failure. A headless browser test that fails in CI with no screenshot leaves only an error message  -  developers cannot see what the page looked like when the test failed, making debugging extremely difficult.
  Bad example:
    // ❌ No screenshot  -  only error message on failure
    afterEach(async () => {
      await driver.quit(); // no screenshot before quitting
    });
  Good example:
    // ✓ Screenshot saved before quit when test fails
    afterEach(async function() {
      if (this.currentTest?.state === 'failed') {
        const screenshot = await driver.takeScreenshot();
        fs.writeFileSync(`test-screenshots/${Date.now()}.png`, screenshot, 'base64');
      }
      await driver.quit();
    });

- no_auth_boundary_tests [warning]
  Test suite logs in once in a global setup and never tests what happens when the session is missing, expired, or invalid. Auth regressions go undetected because every test assumes a valid session.
  Bad example:
    // Global setup logs in once — no test checks what happens without auth
    beforeAll(async () => { await loginAs('admin'); });
    // Every test runs as admin — no unauthorized access tests exist
  Good example:
    // Separate auth suite tests the boundary explicitly
    describe('Auth boundary', () => {
      it('rejects unauthenticated access', ...);
      it('rejects expired tokens', ...);
      it('respects role-based access', ...);
    });

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
