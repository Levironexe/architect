import { By } from "selenium-webdriver";
import { BasePage } from "./BasePage";
import { WaitUtils } from "../core/WaitUtils";
import { AssertionHelper } from "../core/AssertionHelper";
import { ENV } from "../config/env";

export class LoginPage extends BasePage {
  async goToLogin() {
    await this.open(`${ENV.baseUrl}`);
  }

  async enterUsername(username: string) {
    await this.typeByCss("#user-name", username);
  }

  async enterPassword(password: string) {
    await this.typeByCss("#password", password);
  }

  async clickLoginButton() {
    await this.clickByCss("#login-button");
  }

  async loginWith(username: string, password: string) {
    await this.goToLogin();
    await this.enterUsername(username);
    await this.enterPassword(password);
    await this.clickLoginButton();
    await WaitUtils.sleep(1000);
  }

  async loginAsStandardUser() {
    await this.loginWith("standard_user", "secret_sauce");
    const url = await this.driver.getCurrentUrl();
    AssertionHelper.shouldContain(url, "inventory", "Login should navigate to inventory");
  }

  async loginAsLockedUserAndAssertError() {
    await this.loginWith("locked_out_user", "secret_sauce");
    const errText = await this.driver.findElement(By.css("h3[data-test='error']")).getText();
    AssertionHelper.shouldContain(errText, "locked out", "Locked user error not visible");
  }

  async assertFormElementsPresent() {
    const u = await this.driver.findElement(By.css("#user-name")).isDisplayed();
    const p = await this.driver.findElement(By.css("#password")).isDisplayed();
    const b = await this.driver.findElement(By.css("#login-button")).isDisplayed();
    AssertionHelper.shouldBeTruthy(u && p && b, "Login form elements are missing");
  }

  async assertBrokenStateByTryingBadCredentials() {
    const badPairs = [
      ["", ""],
      ["bad", "bad"],
      ["standard_user", ""],
      ["", "secret_sauce"]
    ];

    for (const pair of badPairs) {
      await this.goToLogin();
      await this.enterUsername(pair[0]);
      await this.enterPassword(pair[1]);
      await this.clickLoginButton();
      await WaitUtils.sleep(500);
      const body = await this.driver.findElement(By.css("body")).getText();
      AssertionHelper.shouldContain(body.toLowerCase(), "error", "Expected an error for invalid credentials");
    }
  }
}
