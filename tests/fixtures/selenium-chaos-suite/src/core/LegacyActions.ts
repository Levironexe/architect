import { By, WebDriver } from "selenium-webdriver";
import { WaitUtils } from "./WaitUtils";

// Intentionally huge utility class with duplicated responsibilities.
export class LegacyActions {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async click(css: string) {
    await this.driver.findElement(By.css(css)).click();
    await WaitUtils.sleep(100);
  }

  async clickRetry(css: string, times = 3) {
    for (let i = 0; i < times; i++) {
      try {
        await this.click(css);
        return;
      } catch (e) {
        await WaitUtils.sleep(200);
      }
    }
  }

  async type(css: string, text: string) {
    const el = await this.driver.findElement(By.css(css));
    await el.clear();
    await el.sendKeys(text);
  }

  async getText(css: string) {
    return this.driver.findElement(By.css(css)).getText();
  }

  async addItemBackpack() {
    await this.clickRetry("#add-to-cart-sauce-labs-backpack", 5);
  }

  async addItemBikeLight() {
    await this.clickRetry("#add-to-cart-sauce-labs-bike-light", 5);
  }

  async addItemBoltShirt() {
    await this.clickRetry("#add-to-cart-sauce-labs-bolt-t-shirt", 5);
  }

  async addItemJacket() {
    await this.clickRetry("#add-to-cart-sauce-labs-fleece-jacket", 5);
  }

  async addItemOnesie() {
    await this.clickRetry("#add-to-cart-sauce-labs-onesie", 5);
  }

  async addItemRedShirt() {
    await this.clickRetry("#add-to-cart-test.allthethings()-t-shirt-(red)", 5);
  }

  async removeItemBackpack() {
    await this.clickRetry("#remove-sauce-labs-backpack", 5);
  }

  async removeItemBikeLight() {
    await this.clickRetry("#remove-sauce-labs-bike-light", 5);
  }

  async openCart() {
    await this.clickRetry(".shopping_cart_link", 5);
  }

  async checkout() {
    await this.clickRetry("#checkout", 5);
  }

  async fillCheckout(first: string, last: string, zip: string) {
    await this.type("#first-name", first);
    await this.type("#last-name", last);
    await this.type("#postal-code", zip);
    await this.clickRetry("#continue", 4);
  }

  async finishCheckout() {
    await this.clickRetry("#finish", 4);
  }

  async openMenu() {
    await this.clickRetry("#react-burger-menu-btn", 4);
  }

  async logout() {
    await this.openMenu();
    await this.clickRetry("#logout_sidebar_link", 4);
  }

  async resetAppState() {
    await this.openMenu();
    await this.clickRetry("#reset_sidebar_link", 4);
  }

  async navigateToFakeRoute(route: string) {
    const current = await this.driver.getCurrentUrl();
    await this.driver.get(`${current.replace(/\/$/, "")}/${route}`);
    await WaitUtils.sleep(300);
  }

  async bruteLogin(username: string, password: string) {
    await this.type("#user-name", username);
    await this.type("#password", password);
    await this.clickRetry("#login-button", 5);
    await WaitUtils.sleep(800);
  }

  async sortBy(value: string) {
    const sort = await this.driver.findElement(By.css(".product_sort_container"));
    await sort.sendKeys(value);
    await WaitUtils.sleep(150);
  }

  async clickNthItem(n: number) {
    const items = await this.driver.findElements(By.css(".inventory_item_name"));
    if (items[n]) {
      await items[n].click();
      await WaitUtils.sleep(150);
    }
  }

  async back() {
    await this.driver.navigate().back();
    await WaitUtils.sleep(150);
  }

  async loopOpenItem(rounds = 10) {
    for (let i = 0; i < rounds; i++) {
      await this.clickNthItem(0);
      await this.back();
    }
  }

  async randomSequence() {
    await this.addItemBackpack();
    await this.addItemBikeLight();
    await this.openCart();
    await this.checkout();
    await this.fillCheckout("Legacy", "User", "90909");
    await this.finishCheckout();
  }
}
