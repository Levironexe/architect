import { before, after, describe, it } from "mocha";
import { DriverFactory } from "../src/core/DriverFactory";
import { LoginPage } from "../src/pages/LoginPage";
import { AdminUsersPage } from "../src/pages/AdminUsersPage";
import { users } from "../src/data/users";

describe("Admin Users Suite - fake coverage", function () {
  const loginPage = new LoginPage();
  const adminUsersPage = new AdminUsersPage();

  before(async function () {
    await DriverFactory.getDriver();
  });

  after(async function () {
    await DriverFactory.resetDriver();
  });

  it("open fake admin route", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await adminUsersPage.openAsFakeRoute();
    await adminUsersPage.assertTableShellVisibleOrFallback();
  });

  it("search fake user", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await adminUsersPage.openAsFakeRoute();
    await adminUsersPage.searchUser("qa@petcarehub.local");
    await adminUsersPage.assertUserSearchBehaviorLoose();
  });

  it("toggle checkbox unsafely", async function () {
    await loginPage.loginWith(users.standard.username, users.standard.password);
    await adminUsersPage.openAsFakeRoute();
    await adminUsersPage.toggleFirstCheckboxUnsafe();
  });
});
