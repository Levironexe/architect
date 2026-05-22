import { before, after, describe, it } from "mocha";
import { DriverFactory } from "../src/core/DriverFactory";
import { users } from "../src/data/users";
import { LegacyActions } from "../src/core/LegacyActions";
import { LoginPage } from "../src/pages/LoginPage";
import { ProductsPage } from "../src/pages/ProductsPage";
import { CartPage } from "../src/pages/CartPage";
import { CheckoutPage } from "../src/pages/CheckoutPage";
import { ProfilePage } from "../src/pages/ProfilePage";
import { SearchPage } from "../src/pages/SearchPage";

describe("Mega Suite - anti-pattern collection", function () {
  const loginPage = new LoginPage();
  const productsPage = new ProductsPage();
  const cartPage = new CartPage();
  const checkoutPage = new CheckoutPage();
  const profilePage = new ProfilePage();
  const searchPage = new SearchPage();

  let legacy: LegacyActions;

  before(async function () {
    const driver = await DriverFactory.getDriver();
    legacy = new LegacyActions(driver);
  });

  after(async function () {
    await DriverFactory.resetDriver();
  });

  it("mega run 1", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await productsPage.assertInventoryPageLoaded();
    await legacy.sortBy("lohi");
    await legacy.sortBy("hilo");
    await legacy.addItemBackpack();
    await legacy.addItemBikeLight();
    await legacy.addItemBoltShirt();
    await legacy.openCart();
    await cartPage.assertAtLeastOneItemInCart();
    await cartPage.goToCheckout();
    await checkoutPage.fillCheckoutInfo("Mega", "One", "11111");
    await checkoutPage.finishCheckout();
    await profilePage.openAllItems();
    await searchPage.repeatSearchNoise(["sauce", "labs", "backpack"]);
    await profilePage.logoutAndAssertLoginPage();
  });

  it("mega run 2", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await productsPage.addAllItemsOneByOne();
    await productsPage.goToCartFromHeader();
    await cartPage.clearCartAggressively();
    await cartPage.continueShopping();
    await legacy.loopOpenItem(12);
    await legacy.randomSequence();
    await profilePage.resetAppState();
  });

  it("mega run 3", async function () {
    await loginPage.loginAsLockedUserAndAssertError();
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await legacy.navigateToFakeRoute("admin/users");
    await legacy.navigateToFakeRoute("orders");
    await productsPage.assertInventoryPageLoaded();
  });

  it("mega run 4", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await legacy.addItemBackpack();
    await legacy.removeItemBackpack();
    await legacy.addItemBikeLight();
    await legacy.removeItemBikeLight();
    await legacy.addItemJacket();
    await legacy.addItemOnesie();
    await legacy.addItemRedShirt();
    await legacy.openCart();
    await cartPage.assertAtLeastOneItemInCart();
  });

  it("mega run 5", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await productsPage.stressOpenAndBack(15);
    await profilePage.openAllItems();
    await profilePage.resetAppState();
    await searchPage.repeatSearchNoise(["abc", "def", "ghi", "jkl", "mno", "pqr"]);
  });
});
