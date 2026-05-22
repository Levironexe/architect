import { before, after, describe, it } from "mocha";
import { DriverFactory } from "../src/core/DriverFactory";
import { LoginPage } from "../src/pages/LoginPage";
import { ProductsPage } from "../src/pages/ProductsPage";
import { CartPage } from "../src/pages/CartPage";
import { users } from "../src/data/users";

describe("Cart Suite - repetitive and stateful", function () {
  const loginPage = new LoginPage();
  const productsPage = new ProductsPage();
  const cartPage = new CartPage();

  before(async function () {
    await DriverFactory.getDriver();
  });

  after(async function () {
    await DriverFactory.resetDriver();
  });

  it("add two items and assert cart", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await productsPage.addBackpackToCart();
    await productsPage.addBikeLightToCart();
    await productsPage.goToCartFromHeader();
    await cartPage.assertCartPageLoaded();
    await cartPage.assertAtLeastOneItemInCart();
  });

  it("remove one item", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await productsPage.addBackpackToCart();
    await productsPage.goToCartFromHeader();
    await cartPage.removeFirstItem();
  });

  it("clear all cart items", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await productsPage.addAllItemsOneByOne();
    await productsPage.goToCartFromHeader();
    await cartPage.clearCartAggressively();
  });

  it("continue shopping from cart", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await productsPage.addBackpackToCart();
    await productsPage.goToCartFromHeader();
    await cartPage.continueShopping();
    await productsPage.assertInventoryPageLoaded();
  });
});
