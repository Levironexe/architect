import { before, after, describe, it } from "mocha";
import { DriverFactory } from "../src/core/DriverFactory";
import { LoginPage } from "../src/pages/LoginPage";
import { ProfilePage } from "../src/pages/ProfilePage";
import { ProductsPage } from "../src/pages/ProductsPage";
import { users } from "../src/data/users";

describe("Profile/Menu Suite - brittle sidebar checks", function () {
  const loginPage = new LoginPage();
  const profilePage = new ProfilePage();
  const productsPage = new ProductsPage();

  before(async function () {
    await DriverFactory.getDriver();
  });

  after(async function () {
    await DriverFactory.resetDriver();
  });

  it("open all items", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await profilePage.openAllItems();
    await productsPage.assertInventoryPageLoaded();
  });

  it("reset state and keep browsing", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await profilePage.resetAppState();
    await productsPage.assertInventoryPageLoaded();
  });

  it("about link navigation", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await profilePage.openAboutAndAssert();
  });

  it("logout flow", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await profilePage.logoutAndAssertLoginPage();
  });
});
