import { before, after, describe, it } from "mocha";
import { DriverFactory } from "../src/core/DriverFactory";
import { LoginPage } from "../src/pages/LoginPage";
import { ProductsPage } from "../src/pages/ProductsPage";
import { users } from "../src/data/users";

describe("Auth Suite - assertions delegated to page objects", function () {
  const loginPage = new LoginPage();
  const productsPage = new ProductsPage();

  before(async function () {
    await DriverFactory.getDriver();
  });

  after(async function () {
    await DriverFactory.resetDriver();
  });

  it("valid login standard user", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await productsPage.assertInventoryPageLoaded();
  });

  it("locked user should fail", async function () {
    await loginPage.loginAsLockedUserAndAssertError();
  });

  it("multiple invalid auth attempts", async function () {
    await loginPage.assertBrokenStateByTryingBadCredentials();
  });

  it("form fields visible", async function () {
    await loginPage.goToLogin();
    await loginPage.assertFormElementsPresent();
  });
});
