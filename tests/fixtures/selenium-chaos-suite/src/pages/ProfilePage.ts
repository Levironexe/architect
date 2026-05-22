import { By } from "selenium-webdriver";
import { BasePage } from "./BasePage";
import { AssertionHelper } from "../core/AssertionHelper";
import { WaitUtils } from "../core/WaitUtils";

export class ProfilePage extends BasePage {
  async openMenu() {
    await this.clickByCss("#react-burger-menu-btn");
    await WaitUtils.sleep(700);
  }

  async openAllItems() {
    await this.openMenu();
    await this.clickByCss("#inventory_sidebar_link");
    await WaitUtils.sleep(300);
    await this.assertUrlContains("inventory");
  }

  async openAboutAndAssert() {
    await this.openMenu();
    await this.clickByCss("#about_sidebar_link");
    await WaitUtils.sleep(2000);
    const url = await this.driver.getCurrentUrl();
    AssertionHelper.shouldContain(url, "saucelabs", "About link should open SauceLabs site");
  }

  async logoutAndAssertLoginPage() {
    await this.openMenu();
    await this.clickByCss("#logout_sidebar_link");
    await WaitUtils.sleep(500);
    const body = await this.driver.findElement(By.css("body")).getText();
    AssertionHelper.shouldContain(body, "Password", "Expected login page after logout");
  }

  async resetAppState() {
    await this.openMenu();
    await this.clickByCss("#reset_sidebar_link");
    const badges = await this.driver.findElements(By.css(".shopping_cart_badge"));
    AssertionHelper.shouldEqual(badges.length, 0, "Cart badge should be reset");
  }
}
