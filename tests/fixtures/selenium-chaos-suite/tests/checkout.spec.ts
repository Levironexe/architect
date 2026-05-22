import { before, after, describe, it } from "mocha";
import { DriverFactory } from "../src/core/DriverFactory";
import { LoginPage } from "../src/pages/LoginPage";
import { ProductsPage } from "../src/pages/ProductsPage";
import { CartPage } from "../src/pages/CartPage";
import { CheckoutPage } from "../src/pages/CheckoutPage";
import { CheckoutFlow } from "../src/flows/CheckoutFlow";
import { users } from "../src/data/users";

describe("Checkout Suite - over-coupled", function () {
  const loginPage = new LoginPage();
  const productsPage = new ProductsPage();
  const cartPage = new CartPage();
  const checkoutPage = new CheckoutPage();
  const checkoutFlow = new CheckoutFlow();

  before(async function () {
    await DriverFactory.getDriver();
  });

  after(async function () {
    await DriverFactory.resetDriver();
  });

  it("happy path checkout", async function () {
    await checkoutFlow.runHappyPathCheckout();
  });

  it("manual checkout path", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await productsPage.addBackpackToCart();
    await productsPage.goToCartFromHeader();
    await cartPage.goToCheckout();
    await checkoutPage.fillCheckoutInfo("John", "Smith", "90210");
    await checkoutPage.assertSummaryContainsPayment();
    await checkoutPage.assertTotalLooksValid();
    await checkoutPage.finishCheckout();
  });

  it("broken checkout path", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await productsPage.addBackpackToCart();
    await productsPage.goToCartFromHeader();
    await cartPage.goToCheckout();
    await checkoutPage.doBrokenSubmissionAndAssertErrors();
  });
});
