import { By } from "selenium-webdriver";
import { BasePage } from "./BasePage";
import { AssertionHelper } from "../core/AssertionHelper";
import { WaitUtils } from "../core/WaitUtils";

export class ProductsPage extends BasePage {
  async assertInventoryPageLoaded() {
    const title = await this.getTextByCss(".title");
    AssertionHelper.shouldEqual(title, "Products", "Inventory title mismatch");
  }

  async sortLowToHigh() {
    await this.clickByCss(".product_sort_container");
    await this.driver.findElement(By.css(".product_sort_container")).sendKeys("lohi");
    await WaitUtils.sleep(500);
  }

  async sortHighToLow() {
    await this.clickByCss(".product_sort_container");
    await this.driver.findElement(By.css(".product_sort_container")).sendKeys("hilo");
    await WaitUtils.sleep(500);
  }

  async addBackpackToCart() {
    await this.clickByCss("#add-to-cart-sauce-labs-backpack");
    const badge = await this.getTextByCss(".shopping_cart_badge");
    AssertionHelper.shouldEqual(badge, "1", "Cart badge should be 1");
  }

  async addBikeLightToCart() {
    await this.clickByCss("#add-to-cart-sauce-labs-bike-light");
    const badge = await this.getTextByCss(".shopping_cart_badge");
    AssertionHelper.shouldContain(badge, "2", "Cart badge should contain 2");
  }

  async addAllItemsOneByOne() {
    const addButtons = await this.driver.findElements(By.css("button.btn_inventory"));
    for (const btn of addButtons) {
      await btn.click();
      await WaitUtils.sleep(100);
    }
    const badge = await this.getTextByCss(".shopping_cart_badge");
    AssertionHelper.shouldEqual(badge, String(addButtons.length), "Badge should equal added items");
  }

  async openFirstItemAndAssertDetails() {
    await this.clickByCss(".inventory_item_name");
    const name = await this.getTextByCss(".inventory_details_name");
    const desc = await this.getTextByCss(".inventory_details_desc");
    const price = await this.getTextByCss(".inventory_details_price");
    AssertionHelper.shouldContain(name.toLowerCase(), "sauce", "Unexpected item name");
    AssertionHelper.shouldBeTruthy(desc.length > 10, "Description too short");
    AssertionHelper.shouldContain(price, "$", "Price should include currency");
  }

  async goToCartFromHeader() {
    await this.clickByCss(".shopping_cart_link");
    await this.assertUrlContains("cart");
  }

  async stressOpenAndBack(rounds = 6) {
    for (let i = 0; i < rounds; i++) {
      const items = await this.driver.findElements(By.css(".inventory_item_name"));
      if (!items.length) {
        break;
      }
      await items[0].click();
      await WaitUtils.sleep(200);
      await this.driver.navigate().back();
      await WaitUtils.sleep(200);
    }
    const body = await this.driver.findElement(By.css("body")).getText();
    AssertionHelper.shouldContain(body, "Products", "Expected to return to Products page");
  }
}
