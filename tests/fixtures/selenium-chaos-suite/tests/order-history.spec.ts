import { before, after, describe, it } from "mocha";
import { DriverFactory } from "../src/core/DriverFactory";
import { LoginPage } from "../src/pages/LoginPage";
import { OrdersPage } from "../src/pages/OrdersPage";
import { users } from "../src/data/users";

describe("Order History Suite - fake route coverage", function () {
  const loginPage = new LoginPage();
  const ordersPage = new OrdersPage();

  before(async function () {
    await DriverFactory.getDriver();
  });

  after(async function () {
    await DriverFactory.resetDriver();
  });

  it("open orders page and assert fallback", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await ordersPage.openOrdersRoute();
    await ordersPage.assertOrdersPageOrFallback();
  });

  it("filter and open first order", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await ordersPage.openOrdersRoute();
    await ordersPage.tryFilterByStatus("completed");
    await ordersPage.openFirstOrderIfExists();
  });
});
