import { before, after, describe, it } from "mocha";
import { DriverFactory } from "../src/core/DriverFactory";
import { LoginPage } from "../src/pages/LoginPage";
import { ProductsPage } from "../src/pages/ProductsPage";
import { CartPage } from "../src/pages/CartPage";
import { CheckoutPage } from "../src/pages/CheckoutPage";
import { users } from "../src/data/users";

describe("Smoke Suite - very coupled tests", function () {
  const loginPage = new LoginPage();
  const productsPage = new ProductsPage();
  const cartPage = new CartPage();
  const checkoutPage = new CheckoutPage();

  before(async function () {
    await DriverFactory.getDriver();
  });

  after(async function () {
    await DriverFactory.resetDriver();
  });

  it("should login and navigate around", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await productsPage.assertInventoryPageLoaded();
    await productsPage.sortLowToHigh();
    await productsPage.sortHighToLow();
    await productsPage.openFirstItemAndAssertDetails();
    await productsPage.assertUrlContains("inventory-item");
  });

  it("should add cart items and checkout", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await productsPage.addBackpackToCart();
    await productsPage.addBikeLightToCart();
    await productsPage.goToCartFromHeader();
    await cartPage.assertCartPageLoaded();
    await cartPage.assertAtLeastOneItemInCart();
    await cartPage.goToCheckout();
    await checkoutPage.fillCheckoutInfo(users.standard.firstName, users.standard.lastName, users.standard.zip);
    await checkoutPage.assertSummaryContainsPayment();
    await checkoutPage.finishCheckout();
  });

  it("should show locked user errors", async function () {
    await loginPage.loginAsLockedUserAndAssertError();
    await loginPage.assertBrokenStateByTryingBadCredentials();
  });
});
