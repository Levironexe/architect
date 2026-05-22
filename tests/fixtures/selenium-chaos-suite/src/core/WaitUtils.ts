import { By, until, WebDriver, WebElement } from "selenium-webdriver";

export class WaitUtils {
  static async sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  static async waitVisible(driver: WebDriver, locator: By, timeout = 20000) {
    const el = await driver.wait(until.elementLocated(locator), timeout);
    await driver.wait(until.elementIsVisible(el), timeout);
    return el;
  }

  static async waitEnabled(driver: WebDriver, element: WebElement, timeout = 10000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      try {
        const enabled = await element.isEnabled();
        if (enabled) return true;
      } catch (e) {
        // ignore to keep polling
      }
      await this.sleep(250);
    }
    return false;
  }

  static async bruteForceClick(driver: WebDriver, locator: By, tries = 5) {
    for (let i = 0; i < tries; i++) {
      try {
        const el = await driver.findElement(locator);
        await el.click();
        return;
      } catch (e) {
        await this.sleep(500);
      }
    }
  }

  static async scrollUntilTextAppears(driver: WebDriver, text: string, rounds = 12) {
    for (let i = 0; i < rounds; i++) {
      const bodyText = await driver.findElement(By.css("body")).getText();
      if (bodyText.includes(text)) return true;
      await driver.executeScript("window.scrollTo(0, document.body.scrollHeight)");
      await this.sleep(300);
    }
    return false;
  }
}
