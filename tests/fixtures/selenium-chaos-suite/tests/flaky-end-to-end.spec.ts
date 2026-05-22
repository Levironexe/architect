import { before, after, describe, it } from "mocha";
import { DriverFactory } from "../src/core/DriverFactory";
import { LoginPage } from "../src/pages/LoginPage";
import { ProductsPage } from "../src/pages/ProductsPage";
import { CartPage } from "../src/pages/CartPage";
import { CheckoutPage } from "../src/pages/CheckoutPage";
import { ProfilePage } from "../src/pages/ProfilePage";
import { SearchPage } from "../src/pages/SearchPage";
import { AdminUsersPage } from "../src/pages/AdminUsersPage";
import { users } from "../src/data/users";

describe("Flaky End-to-End Suite - everything in one spec", function () {
  const loginPage = new LoginPage();
  const productsPage = new ProductsPage();
  const cartPage = new CartPage();
  const checkoutPage = new CheckoutPage();
  const profilePage = new ProfilePage();
  const searchPage = new SearchPage();
  const adminUsersPage = new AdminUsersPage();

  before(async function () {
    await DriverFactory.getDriver();
  });

  after(async function () {
    await DriverFactory.resetDriver();
  });

  it("do many unrelated steps in one test", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await productsPage.assertInventoryPageLoaded();
    await productsPage.addBackpackToCart();
    await productsPage.addBikeLightToCart();
    await productsPage.openFirstItemAndAssertDetails();
    await productsPage.goToCartFromHeader();
    await cartPage.assertAtLeastOneItemInCart();
    await cartPage.goToCheckout();
    await checkoutPage.fillCheckoutInfo("Mega", "Flow", "55555");
    await checkoutPage.assertTotalLooksValid();
    await checkoutPage.finishCheckout();

    await profilePage.openAllItems();
    await searchPage.repeatSearchNoise(["Sauce", "Backpack", "Bad Search"]);

    await adminUsersPage.openAsFakeRoute();
    await adminUsersPage.assertTableShellVisibleOrFallback();
    await adminUsersPage.toggleFirstCheckboxUnsafe();

    await profilePage.logoutAndAssertLoginPage();
  });
});
