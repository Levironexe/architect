import { By, WebDriver } from "selenium-webdriver";
import { AssertionHelper } from "../core/AssertionHelper";
import { Logger } from "../core/Logger";
import { WaitUtils } from "../core/WaitUtils";
import { getContextDriver } from "../core/TestContext";

export class BasePage {
  driver!: WebDriver;
  lastVisited = "";

  async init() {
    this.driver = await getContextDriver();
  }

  async open(url: string) {
    await this.init();
    this.lastVisited = url;
    Logger.info("Opening URL", { url });
    await this.driver.get(url);
    await WaitUtils.sleep(700);
  }

  async clickByCss(css: string) {
    await this.init();
    try {
      await this.driver.findElement(By.css(css)).click();
      await WaitUtils.sleep(300);
    } catch (e) {
      Logger.warn("clickByCss failed, retrying with brute force", { css });
      await WaitUtils.bruteForceClick(this.driver, By.css(css));
    }
  }

  async typeByCss(css: string, value: string) {
    await this.init();
    const el = await this.driver.findElement(By.css(css));
    await el.clear();
    await el.sendKeys(value);
    await WaitUtils.sleep(200);
  }

  async getTextByCss(css: string) {
    await this.init();
    return this.driver.findElement(By.css(css)).getText();
  }

  async assertTitleContains(text: string) {
    await this.init();
    const title = await this.driver.getTitle();
    AssertionHelper.shouldContain(title, text, "Page title mismatch");
  }

  async assertUrlContains(segment: string) {
    await this.init();
    const url = await this.driver.getCurrentUrl();
    AssertionHelper.shouldContain(url, segment, "URL mismatch");
  }

  async loginFromAnyPage(username: string, password: string) {
    // Intentionally bad: base page doing business flow.
    await this.typeByCss("#user-name", username);
    await this.typeByCss("#password", password);
    await this.clickByCss("#login-button");
    await WaitUtils.sleep(1200);
  }

  async forceLogoutFromMenu() {
    await this.clickByCss("#react-burger-menu-btn");
    await WaitUtils.sleep(1000);
    await this.clickByCss("#logout_sidebar_link");
  }

  async takeScreenshot(name: string) {
    await this.init();
    const content = await this.driver.takeScreenshot();
    Logger.info("Screenshot captured", { name, bytes: content.length });
  }
}
