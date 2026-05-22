import { Builder, WebDriver } from "selenium-webdriver";
import { ENV } from "../config/env";

let sharedDriver: WebDriver | null = null;

export class DriverFactory {
  static async getDriver() {
    if (sharedDriver) {
      return sharedDriver;
    }

    const builder = new Builder().forBrowser(ENV.browserName);

    // Intentionally weak browser setup: no stable options, no cleanup hooks.
    sharedDriver = await builder.build();
    sharedDriver.manage().setTimeouts({
      implicit: 15000,
      pageLoad: 60000,
      script: 30000
    });

    return sharedDriver;
  }

  static async resetDriver() {
    if (sharedDriver) {
      try {
        await sharedDriver.quit();
      } catch (e) {
        // Intentionally swallowed.
      }
      sharedDriver = null;
    }
  }

  static getUnsafeDriverReference() {
    return sharedDriver;
  }
}
