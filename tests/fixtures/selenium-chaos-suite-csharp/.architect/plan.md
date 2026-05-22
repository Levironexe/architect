# Refactoring Plan: SeleniumChaosSuite
Generated: 2026-05-20
Stack: selenium-csharp

## Phase 1: Restructure directories to match blueprint
**Goal**: Move support code into blueprint-expected directories (Fixtures/, Utilities/, Models/) so the project layout matches the Selenium C# E2E blueprint.
**Risk**: low

### Steps
- [x] Step 1.1: Create `Fixtures/` directory and move `src/Core/DriverFactory.cs` → `Fixtures/DriverFactory.cs`
  - What: Move `DriverFactory` class. Update namespace from `SeleniumChaosSuite.Core` to `SeleniumChaosSuite.Fixtures`.
  - Why: Blueprint requires driver factory in `Fixtures/` — tests call `DriverFactory.Create()` from there.
  - Imports to update:
    - `tests/SmokeTests.cs`: change `using SeleniumChaosSuite.Core` → `using SeleniumChaosSuite.Fixtures` for `DriverFactory`
    - `tests/MegaSuiteTests.cs`: same
    - `tests/RegressionTests.cs`: same
    - `tests/MixedStyleTests.cs`: same
    - `tests/FlakyEndToEndTests.cs`: same
    - `tests/AuthTests.cs`: same
    - `tests/CartTests.cs`: same
    - `tests/CheckoutTests.cs`: same
    - `tests/ProfileTests.cs`: same
    - `tests/SearchTests.cs`: same
    - `tests/OrderHistoryTests.cs`: same
    - `tests/AdminUsersTests.cs`: same
    - `tests/BestPracticeFlowTests.cs`: same
    - `src/Core/TestContext.cs`: same (if it references DriverFactory)
  - Verify: `grep -r "SeleniumChaosSuite.Core" tests/ src/` should not reference `DriverFactory`

- [x] Step 1.2: Create `Utilities/` directory and move `src/Core/WaitUtils.cs` → `Utilities/WaitUtils.cs`
  - What: Move `WaitUtils` class. Update namespace from `SeleniumChaosSuite.Core` to `SeleniumChaosSuite.Utilities`.
  - Why: Blueprint places retry logic, wait helpers, and shared utilities in `Utilities/`.
  - Imports to update:
    - `src/Pages/BasePage.cs`: change `using SeleniumChaosSuite.Core` → add `using SeleniumChaosSuite.Utilities` for `WaitUtils`
    - `src/Core/LegacyActions.cs`: same
    - `src/Pages/LoginPage.cs`: same
    - `src/Pages/ProductsPage.cs`: same
    - Any other file referencing `WaitUtils`
  - Verify: `grep -r "SeleniumChaosSuite.Core" . --include="*.cs"` should not reference `WaitUtils`

- [x] Step 1.3: Move `src/Core/AssertionHelper.cs` → `Utilities/AssertionHelper.cs`
  - What: Move `AssertionHelper` class. Update namespace to `SeleniumChaosSuite.Utilities`.
  - Why: Custom assertion helpers belong in `Utilities/` per blueprint.
  - Imports to update:
    - `src/Pages/BasePage.cs`: add `using SeleniumChaosSuite.Utilities`
    - All POM files referencing `AssertionHelper`
  - Verify: `grep -r "using SeleniumChaosSuite.Core" . --include="*.cs"` should not reference `AssertionHelper`

- [x] Step 1.4: Move `src/Core/Logger.cs` → `Utilities/Logger.cs`
  - What: Move `Logger` class. Update namespace to `SeleniumChaosSuite.Utilities`.
  - Why: Logging is a shared utility.
  - Imports to update:
    - `src/Pages/BasePage.cs`: add `using SeleniumChaosSuite.Utilities`
  - Verify: `grep -r "SeleniumChaosSuite.Core" . --include="*.cs"` should not reference `Logger`

- [x] Step 1.5: Rename `src/Data/` → `Models/`
  - What: Move `Users.cs` and `Products.cs` to `Models/`. Update namespace from `SeleniumChaosSuite.Data` to `SeleniumChaosSuite.Models`.
  - Why: Blueprint expects test data models in `Models/`.
  - Imports to update:
    - All test files: change `using SeleniumChaosSuite.Data` → `using SeleniumChaosSuite.Models`
    - `src/Flows/CheckoutFlow.cs`: same
  - Verify: `grep -r "SeleniumChaosSuite.Data" . --include="*.cs"` should return zero results

- [x] Step 1.6: Move `src/Config/Env.cs` → `Fixtures/TestConfig.cs`
  - What: Rename class from `Env` to `TestConfig` and move to `Fixtures/`. Update namespace to `SeleniumChaosSuite.Fixtures`.
  - Why: Blueprint places test configuration in `Fixtures/TestConfig.cs`.
  - Imports to update:
    - `src/Core/DriverFactory.cs` (now `Fixtures/DriverFactory.cs`): change `using SeleniumChaosSuite.Config` → local namespace
    - `src/Pages/LoginPage.cs`: change `using SeleniumChaosSuite.Config` → `using SeleniumChaosSuite.Fixtures`
    - All references from `Env.X` → `TestConfig.X`
  - Verify: `grep -r "SeleniumChaosSuite.Config" . --include="*.cs"` should return zero results

## Phase 2: Fix BasePage to use constructor-injected driver and explicit waits
**Goal**: Eliminate the anti-pattern where BasePage uses `async Init()` to lazily fetch a shared static driver, and replace `Sleep()` calls with explicit waits. Align with the blueprint's BasePage pattern.
**Risk**: medium

### Steps
- [x] Step 2.1: Rewrite `src/Pages/BasePage.cs` to accept `IWebDriver` via constructor
  - What: Remove `Init()` method and the `Driver = null!` field. Add a constructor `BasePage(IWebDriver driver)` that sets `Driver`. Add a `WebDriverWait Wait` property. Replace all `await Init()` calls (lines 12, 18, 26, 42, 49, 56, 61, 67, 84) with direct `Driver` usage. Replace `WaitUtils.Sleep()` calls with explicit waits using `Wait.Until()`.
  - Why: Blueprint requires constructor-injected driver; `Init()` pattern couples POMs to static driver factory (violates "driver lifecycle managed in SetUp/TearDown").

- [x] Step 2.2: Remove login/logout methods from BasePage
  - What: Remove `LoginFromAnyPage()` (line 67) and `ForceLogoutFromMenu()` (line 75) — these belong in `LoginPage` and `ProfilePage` respectively.
  - Why: BasePage should only have generic helpers (click, type, wait). Auth actions are page-specific concerns.

- [x] Step 2.3: Update all POM subclasses to pass `IWebDriver` to BasePage constructor
  - What: Update `LoginPage`, `ProductsPage`, `CartPage`, `CheckoutPage`, `ProfilePage`, `SearchPage`, `OrdersPage`, `AdminUsersPage` — each must accept `IWebDriver driver` in constructor and call `base(driver)`.
  - Why: Required by new BasePage signature.

- [x] Step 2.4: Update all test classes to instantiate POMs with driver from SetUp
  - What: In every test file, change POM instantiation from `new LoginPage()` → `new LoginPage(driver)` in SetUp, after getting driver from `DriverFactory.GetDriver()`. Affects all 13 test files.
  - Why: POMs now require driver injection.

- [x] Step 2.5: Update `Flows/CheckoutFlow.cs` to accept `IWebDriver` and pass to POMs
  - What: Add `IWebDriver` constructor parameter. Pass it to all POM constructors (`_loginPage`, `_productsPage`, `_cartPage`, `_checkoutPage`).
  - Why: Flow classes compose POMs — they need the driver to pass through.

## Phase 3: Remove hardcoded credentials and fix LoginPage
**Goal**: Eliminate hardcoded usernames/passwords in POMs. All test data should come from `Models/Users` or `Fixtures/TestConfig`.
**Risk**: low

### Steps
- [x] Step 3.1: Remove hardcoded credentials from `LoginPage.LoginAsStandardUser()` (line 28)
  - What: Replace `"standard_user", "secret_sauce"` with `Users.Standard.Username, Users.Standard.Password`. Add `using SeleniumChaosSuite.Models`.
  - Why: Blueprint anti-pattern "hardcoded-urls" — credentials must come from config/data.

- [x] Step 3.2: Remove hardcoded credentials from `LoginPage.LoginAsLockedUserAndAssertError()` (line 34)
  - What: Replace `"locked_out_user", "secret_sauce"` with `Users.Locked.Username, Users.Locked.Password`.
  - Why: Same — no hardcoded credentials in POMs.

- [x] Step 3.3: Remove hardcoded credentials from `LoginPage.AssertBrokenStateByTryingBadCredentials()` (lines 52-55)
  - What: The bad-pairs array uses `"standard_user"` and `"secret_sauce"` — replace with `Users.Standard.Username` / `Users.Standard.Password` for the partial-valid pairs.
  - Why: Consistency — all credential references should go through the data layer.

- [x] Step 3.4: Audit `Env.cs` (now `TestConfig.cs`) for hardcoded fallback secrets
  - What: `AdminPassword` fallback is `"admin123"` (line 26), `DefaultPassword` fallback is `"Password123!"` (line 27). These are fixture demo credentials, not real secrets, but the fallback should be empty string with a guard that throws if not set in CI.
  - Why: Defense-in-depth — prevent accidental use of demo credentials in real environments.

## Phase 4: Extract assertions out of Page Objects
**Goal**: POMs should return data/state; assertions belong in tests only. This is the "assertions-in-pom" anti-pattern from the blueprint.
**Risk**: medium

### Steps
- [x] Step 4.1: Refactor `ProductsPage` to return values instead of asserting
  - What: Convert these methods from void-with-assertion to return-value:
    - `AssertInventoryPageLoaded()` (line 8): return `string` (title text), move assertion to callers
    - `AddBackpackToCart()` (line 28): return `string` (badge text), move assertion to callers
    - `AddBikeLightToCart()` (line 36): return `string` (badge text), move assertion to callers
    - `AddAllItemsOneByOne()` (line 42): return `(string badge, int count)`, move assertion to callers
    - `OpenFirstItemAndAssertDetails()` (line 56): split into `OpenFirstItem()` and `GetItemDetails()` returning a DTO
    - `StressOpenAndBack()` (line 74): return `string` (body text), move assertion to callers
  - Why: Blueprint rule "assertions-in-pom" — POMs return data, tests assert.

- [x] Step 4.2: Refactor `LoginPage` assertion methods
  - What: Convert:
    - `LoginAsStandardUser()` (line 26): return `string` (current URL), move assertion to caller
    - `LoginAsLockedUserAndAssertError()` (line 32): return `string` (error text), move assertion to caller
    - `AssertFormElementsPresent()` (line 39): return `bool`, move assertion to caller
    - `AssertBrokenStateByTryingBadCredentials()` (lines 48-67): return `List<string>` (body texts per attempt)
  - Why: Same anti-pattern — assertions belong in tests.

- [x] Step 4.3: Refactor `CartPage`, `CheckoutPage`, `ProfilePage`, `AdminUsersPage`, `SearchPage`, `OrdersPage` — move all assertion calls to test classes
  - What: Audit each POM for `AssertionHelper.Should*` calls. Convert each to a return-value method. Update all test callers to perform assertions directly.
  - Why: Complete the assertions-in-pom cleanup across all POMs.

- [x] Step 4.4: Update all test files to add assertions that were previously in POMs
  - What: Every test that calls a refactored POM method must now include the assertion inline. E.g., `await _productsPage.AssertInventoryPageLoaded()` → `var title = await _productsPage.GetPageTitle(); Assert.That(title, Is.EqualTo("Products"));`
  - Why: Tests own assertions — this completes the separation.

## Phase 5: Eliminate LegacyActions and migrate callers to POMs
**Goal**: `LegacyActions.cs` (139 LOC) is a god class that bypasses the POM pattern entirely — raw CSS selectors, `Sleep()`-based waits, direct `IWebDriver` calls. All its functionality must be absorbed into proper POMs.
**Risk**: high

### Steps
- [x] Step 5.1: Map each `LegacyActions` method to its target POM
  - What: Migration map:
    - `Click(css)`, `ClickRetry(css)`, `Type(css)`, `GetText(css)` → already in `BasePage` as `ClickByCss`, `TypeByCss`, `GetTextByCss` — no migration needed, just remove
    - `AddItemBackpack()`, `AddItemBikeLight()`, `AddItemBoltShirt()`, `AddItemJacket()`, `AddItemOnesie()`, `AddItemRedShirt()` → `ProductsPage.AddXToCart()` methods
    - `RemoveItemBackpack()`, `RemoveItemBikeLight()` → `CartPage.RemoveX()` methods
    - `OpenCart()` → `ProductsPage.GoToCartFromHeader()` (already exists)
    - `Checkout()` → `CartPage.GoToCheckout()` (already exists)
    - `FillCheckout()` → `CheckoutPage.FillCheckoutInfo()` (already exists)
    - `FinishCheckout()` → `CheckoutPage.FinishCheckout()` (already exists)
    - `OpenMenu()` → `ProfilePage.OpenSidebarMenu()` (new)
    - `Logout()` → `ProfilePage.LogoutFromMenu()` (may exist)
    - `ResetAppState()` → `ProfilePage.ResetAppState()` (may exist)
    - `NavigateToFakeRoute()` → `BasePage.NavigateTo()` or keep as utility
    - `BruteLogin()` → `LoginPage.LoginWith()` (already exists)
    - `SortBy()` → `ProductsPage.SortBy(string value)` (new)
    - `ClickNthItem()` → `ProductsPage.OpenItemByIndex(int n)` (new)
    - `Back()` → `BasePage.GoBack()` (new)
    - `LoopOpenItem()` → `ProductsPage.StressOpenAndBack()` (already exists)
    - `RandomSequence()` → delete (test-specific orchestration belongs in test or flow)
  - Why: Every line in LegacyActions duplicates POM functionality or belongs in a POM.

- [x] Step 5.2: Add missing POM methods identified in Step 5.1
  - What: Add to `ProductsPage`: `AddBoltShirtToCart()`, `AddJacketToCart()`, `AddOnesieToCart()`, `AddRedShirtToCart()`, `SortBy(string value)`, `OpenItemByIndex(int n)`. Add to `BasePage`: `GoBack()`. Add to `ProfilePage`: `OpenSidebarMenu()` (if not exists).
  - Why: These methods currently only exist in LegacyActions.

- [x] Step 5.3: Migrate `MegaSuiteTests.cs` off LegacyActions
  - What: Replace all `_legacy.X()` calls with equivalent POM calls. Remove `LegacyActions _legacy` field and its initialization in SetUp. Specific replacements:
    - `MegaRun1` (line 32): `_legacy.SortBy("lohi")` → `_productsPage.SortBy("lohi")`, `_legacy.AddItemBackpack()` → `_productsPage.AddBackpackToCart()`, etc.
    - `MegaRun2` (line 50): `_legacy.LoopOpenItem(12)` → `_productsPage.StressOpenAndBack(12)`, `_legacy.RandomSequence()` → inline the checkout flow or use `CheckoutFlow`
    - `MegaRun3` (line 64): `_legacy.NavigateToFakeRoute()` → `_adminUsersPage.OpenAsFakeRoute()` / new BasePage utility
    - `MegaRun4` (line 74): all add/remove item calls → POM equivalents
    - `MegaRun5` (line 88): already uses POMs, just remove leftover legacy if any
  - Why: MegaSuiteTests is the primary consumer of LegacyActions.

- [x] Step 5.4: Verify no remaining references to `LegacyActions`
  - What: `grep -r "LegacyActions" . --include="*.cs"` should return zero results after migration.
  - Why: Ensures complete migration before deletion in cleanup phase.

## Phase 6: Replace Sleep-based waits with explicit waits
**Goal**: Eliminate the `WaitUtils.Sleep()` anti-pattern across all POMs and utilities. Use `WebDriverWait` / explicit waits instead.
**Risk**: medium

### Steps
- [x] Step 6.1: Replace `Sleep()` calls in `BasePage.cs`
  - What: `Open()` line 22: `Sleep(700)` → wait for page load. `ClickByCss()` line 31: `Sleep(300)` → remove (click is synchronous). `TypeByCss()` line 45: `Sleep(200)` → remove. `LoginFromAnyPage()` line 72: `Sleep(1200)` → wait for URL change. `ForceLogoutFromMenu()` line 78: `Sleep(1000)` → wait for menu animation.
  - Why: "thread-sleep" is a critical anti-pattern per blueprint.

- [x] Step 6.2: Replace `Sleep()` calls in `LoginPage.cs`
  - What: `LoginWith()` line 23: `Sleep(1000)` → explicit wait for inventory URL. `AssertBrokenStateByTryingBadCredentials()` line 64: `Sleep(500)` → wait for error element.
  - Why: Same anti-pattern.

- [x] Step 6.3: Replace `Sleep()` calls in `ProductsPage.cs`
  - What: `SortLowToHigh()` line 19: `Sleep(500)` → wait for sort to apply. `SortHighToLow()` line 25: same. `AddAllItemsOneByOne()` line 49: `Sleep(100)` → remove (click is synchronous). `StressOpenAndBack()` lines 85-86: `Sleep(200)` → wait for navigation.
  - Why: Same anti-pattern.

- [x] Step 6.4: Audit and fix remaining POM files for `Sleep()` usage
  - What: `grep -rn "Sleep" src/Pages/ --include="*.cs"` — fix every hit. Expected in: `CartPage.cs`, `CheckoutPage.cs`, `ProfilePage.cs`, `SearchPage.cs`, `OrdersPage.cs`, `AdminUsersPage.cs`.
  - Why: Complete elimination of sleep-based waits.

- [x] Step 6.5: Simplify `WaitUtils.cs` — remove `Sleep()` as public API
  - What: Make `Sleep()` private or remove entirely. Keep `WaitVisible()`, `WaitEnabled()`, `BruteForceClick()`, `ScrollUntilTextAppears()` but refactor `BruteForceClick` to use explicit waits instead of sleep-retry loop.
  - Why: Removing the easy `Sleep()` API prevents future backsliding.

## Phase 7: Integrate or remove BestPractices/ reference code
**Goal**: `src/BestPractices/` contains a parallel implementation showing the ideal pattern (constructor-injected driver, explicit waits, `IAsyncDisposable`). After Phases 2-6, main code should match this pattern. Decide: merge useful pieces or delete the reference.
**Risk**: low

### Steps
- [x] Step 7.1: Compare `BestPractices/Core/WebDriverSession.cs` with refactored `DriverFactory`
  - What: If `DriverFactory` now uses `IAsyncDisposable` and proper cleanup (from Phase 2), `WebDriverSession.cs` is redundant. If not, adopt the `IAsyncDisposable` pattern from `WebDriverSession` into `DriverFactory`.
  - Why: Avoid two competing driver lifecycle implementations.

- [x] Step 7.2: Compare `BestPractices/Pages/BasePage.cs` with refactored `Pages/BasePage.cs`
  - What: Verify refactored BasePage matches BestPractices pattern (constructor injection, `UiWait` integration). If BestPractices version has features the main one lacks, port them.
  - Why: Ensure main code meets the quality bar shown in the reference.

- [x] Step 7.3: Compare `BestPractices/Core/UiWait.cs` with `Utilities/WaitUtils.cs`
  - What: Determine if `UiWait` offers better wait abstractions than `WaitUtils`. Merge the better API into the single `Utilities/WaitUtils.cs`.
  - Why: One wait utility, not two.

- [x] Step 7.4: Compare remaining BestPractices POM files with their main counterparts
  - What: `BestPractices/Pages/CartPage.cs`, `CheckoutPage.cs`, `LoginPage.cs`, `ProductsPage.cs`, `BestPractices/Flows/CheckoutFlow.cs` — port any missing patterns.
  - Why: Complete quality alignment.

## Phase 8: Cleanup — Remove dead code and legacy artifacts
**Goal**: Delete code that is now unreachable or superseded after all prior phases.
**Risk**: low

### Steps
- [x] Step 8.1: Delete `src/Core/LegacyActions.cs`
  - What: Entire file (139 LOC). All callers migrated in Phase 5.
  - Why: Fully replaced by POM methods.

- [x] Step 8.2: Delete `src/BestPractices/` directory
  - What: Entire directory tree — `Core/UiWait.cs`, `Core/WebDriverSession.cs`, `Pages/BasePage.cs`, `Pages/CartPage.cs`, `Pages/CheckoutPage.cs`, `Pages/LoginPage.cs`, `Pages/ProductsPage.cs`, `Flows/CheckoutFlow.cs`. All useful patterns merged in Phase 7.
  - Why: Reference code absorbed into main codebase.

- [x] Step 8.3: Delete `src/Core/TestContext.cs`
  - What: `TestContext` was the static-driver-fetching intermediary used by `BasePage.Init()`. After Phase 2, BasePage gets the driver via constructor — `TestContext` has no callers.
  - Why: Dead code after driver injection refactor.

- [x] Step 8.4: Delete empty `src/Core/` directory (if empty after moves)
  - What: After moving DriverFactory → Fixtures/, WaitUtils/AssertionHelper/Logger → Utilities/, LegacyActions deleted, TestContext deleted — `src/Core/` should be empty.
  - Why: Empty directories are noise.

- [x] Step 8.5: Delete empty `src/Config/` directory
  - What: After moving `Env.cs` → `Fixtures/TestConfig.cs`, directory is empty.
  - Why: Same — no empty dirs.

- [x] Step 8.6: Delete empty `src/Data/` directory
  - What: After moving to `Models/`, directory is empty.
  - Why: Same.

- [x] Step 8.7: Verify final structure matches blueprint
  - What: Run `find . -name "*.cs" -not -path "*/obj/*" -not -path "*/bin/*" | sort` and confirm directories are: `Fixtures/`, `Models/`, `Pages/`, `Flows/`, `Utilities/`, `Tests/` (or `tests/`).
  - Verify: `grep -r "SeleniumChaosSuite.Core" . --include="*.cs"` returns zero. `grep -r "LegacyActions" . --include="*.cs"` returns zero. `grep -r "SeleniumChaosSuite.Data" . --include="*.cs"` returns zero. `grep -r "SeleniumChaosSuite.Config" . --include="*.cs"` returns zero.
