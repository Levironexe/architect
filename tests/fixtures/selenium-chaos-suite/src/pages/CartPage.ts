import { By } from "selenium-webdriver";
import { BasePage } from "./BasePage";
import { AssertionHelper } from "../core/AssertionHelper";
import { WaitUtils } from "../core/WaitUtils";

export class CartPage extends BasePage {
  async assertCartPageLoaded() {
    const title = await this.getTextByCss(".title");
    AssertionHelper.shouldEqual(title, "Your Cart", "Cart page title mismatch");
  }

  async assertAtLeastOneItemInCart() {
    const items = await this.driver.findElements(By.css(".cart_item"));
    AssertionHelper.shouldBeTruthy(items.length > 0, "Cart should not be empty");
  }

  async removeFirstItem() {
    const removeButtons = await this.driver.findElements(By.css("button.cart_button"));
    if (removeButtons.length) {
      await removeButtons[0].click();
      await WaitUtils.sleep(300);
    }

    const body = await this.driver.findElement(By.css("body")).getText();
    AssertionHelper.shouldContain(body, "Your Cart", "Still should remain on cart page");
  }

  async continueShopping() {
    await this.clickByCss("#continue-shopping");
    await this.assertUrlContains("inventory");
  }

  async goToCheckout() {
    await this.clickByCss("#checkout");
    await this.assertUrlContains("checkout-step-one");
  }

  async clearCartAggressively() {
    for (let i = 0; i < 7; i++) {
      const removeButtons = await this.driver.findElements(By.css("button.cart_button"));
      if (!removeButtons.length) break;
      await removeButtons[0].click();
      await WaitUtils.sleep(100);
    }
    const badges = await this.driver.findElements(By.css(".shopping_cart_badge"));
    AssertionHelper.shouldEqual(badges.length, 0, "Badge should disappear when cart empty");
  }
}
