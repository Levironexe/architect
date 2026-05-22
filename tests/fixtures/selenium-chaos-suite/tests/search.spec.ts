import { before, after, describe, it } from "mocha";
import { DriverFactory } from "../src/core/DriverFactory";
import { LoginPage } from "../src/pages/LoginPage";
import { SearchPage } from "../src/pages/SearchPage";
import { users } from "../src/data/users";
import { products } from "../src/data/products";

describe("Search Suite - fake and noisy", function () {
  const loginPage = new LoginPage();
  const searchPage = new SearchPage();

  before(async function () {
    await DriverFactory.getDriver();
  });

  after(async function () {
    await DriverFactory.resetDriver();
  });

  it("search with product names", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await searchPage.repeatSearchNoise(products.slice(0, 4));
  });

  it("search with random text", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await searchPage.repeatSearchNoise(["abc", "xyz", "sauce", "whatever"]);
  });
});
