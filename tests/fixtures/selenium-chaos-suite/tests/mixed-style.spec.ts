import { describe, it, before, after } from "mocha";
import { DriverFactory } from "../src/core/DriverFactory";
import { LoginPage } from "../src/pages/LoginPage";
import { ProductsPage } from "../src/pages/ProductsPage";
import { CartPage } from "../src/pages/CartPage";
import { users } from "../src/data/users";

describe("Mixed Style Suite - inconsistent conventions", function () {
  const loginPage = new LoginPage();
  const productsPage = new ProductsPage();
  const cartPage = new CartPage();

  before(async function () {
    await DriverFactory.getDriver();
  });

  after(async function () {
    await DriverFactory.resetDriver();
  });

  it("test a", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await productsPage.addBackpackToCart();
    await productsPage.goToCartFromHeader();
    await cartPage.assertAtLeastOneItemInCart();
  });

  it("test b", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await productsPage.addBikeLightToCart();
    await productsPage.goToCartFromHeader();
    await cartPage.assertAtLeastOneItemInCart();
  });

  it("test c", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await productsPage.sortLowToHigh();
    await productsPage.sortHighToLow();
    await productsPage.openFirstItemAndAssertDetails();
  });
});
