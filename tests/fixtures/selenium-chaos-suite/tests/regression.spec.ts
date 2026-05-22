import { describe, it, before, after } from "mocha";
import { DriverFactory } from "../src/core/DriverFactory";
import { LoginPage } from "../src/pages/LoginPage";
import { ProductsPage } from "../src/pages/ProductsPage";
import { CartPage } from "../src/pages/CartPage";
import { CheckoutPage } from "../src/pages/CheckoutPage";
import { ProfilePage } from "../src/pages/ProfilePage";
import { AdminUsersPage } from "../src/pages/AdminUsersPage";
import { CheckoutFlow } from "../src/flows/CheckoutFlow";
import { users } from "../src/data/users";

describe("Regression Suite - flaky by design", function () {
  const loginPage = new LoginPage();
  const productsPage = new ProductsPage();
  const cartPage = new CartPage();
  const checkoutPage = new CheckoutPage();
  const profilePage = new ProfilePage();
  const adminUsersPage = new AdminUsersPage();
  const checkoutFlow = new CheckoutFlow();

  before(async function () {
    await DriverFactory.getDriver();
  });

  after(async function () {
    await DriverFactory.resetDriver();
  });

  it("regression auth smoke", async function () {
    await loginPage.assertFormElementsPresent();
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await productsPage.assertInventoryPageLoaded();
  });

  it("regression product sorting and stress back nav", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await productsPage.sortLowToHigh();
    await productsPage.sortHighToLow();
    await productsPage.stressOpenAndBack(8);
  });

  it("regression cart clear and refill", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await productsPage.addAllItemsOneByOne();
    await productsPage.goToCartFromHeader();
    await cartPage.clearCartAggressively();
    await cartPage.continueShopping();
    await productsPage.addBackpackToCart();
    await productsPage.goToCartFromHeader();
    await cartPage.assertAtLeastOneItemInCart();
  });

  it("regression checkout happy path with flow", async function () {
    await checkoutFlow.runHappyPathCheckout();
  });

  it("regression checkout alt path with flow", async function () {
    await checkoutFlow.runAddRemoveReaddCheckout();
  });

  it("regression profile actions", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await profilePage.openAllItems();
    await profilePage.resetAppState();
    await profilePage.logoutAndAssertLoginPage();
  });

  it("regression fake admin page checks", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await adminUsersPage.openAsFakeRoute();
    await adminUsersPage.assertTableShellVisibleOrFallback();
    await adminUsersPage.searchUser("someone@example.com");
    await adminUsersPage.assertUserSearchBehaviorLoose();
    await adminUsersPage.toggleFirstCheckboxUnsafe();
  });

  it("regression checkout bad submit", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await productsPage.addBackpackToCart();
    await productsPage.goToCartFromHeader();
    await cartPage.goToCheckout();
    await checkoutPage.doBrokenSubmissionAndAssertErrors();
  });
});
