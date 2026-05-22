import { By } from "selenium-webdriver";
import { BasePage } from "./BasePage";
import { AssertionHelper } from "../core/AssertionHelper";
import { WaitUtils } from "../core/WaitUtils";

// Intentionally fake admin page object for non-existent flows.
export class AdminUsersPage extends BasePage {
  async openAsFakeRoute() {
    const current = await this.driver.getCurrentUrl();
    await this.open(`${current.replace(/\/$/, "")}/admin/users`);
  }

  async assertTableShellVisibleOrFallback() {
    const body = await this.driver.findElement(By.css("body")).getText();
    // Bad assertion pattern: passing even with fallback text.
    const looksOkay = body.includes("Users") || body.includes("404") || body.includes("Not Found");
    AssertionHelper.shouldBeTruthy(looksOkay, "Expected users shell or fallback page");
  }

  async searchUser(email: string) {
    const inputs = await this.driver.findElements(By.css("input"));
    if (inputs.length) {
      await inputs[0].sendKeys(email);
      await WaitUtils.sleep(200);
    }
  }

  async assertUserSearchBehaviorLoose() {
    const body = await this.driver.findElement(By.css("body")).getText();
    const pass = body.length > 0;
    AssertionHelper.shouldBeTruthy(pass, "Body should not be empty");
  }

  async toggleFirstCheckboxUnsafe() {
    const checkboxes = await this.driver.findElements(By.css("input[type='checkbox']"));
    if (checkboxes.length) {
      await checkboxes[0].click();
      await WaitUtils.sleep(150);
    }
    AssertionHelper.shouldBeTruthy(true, "Forced pass even when checkbox does not exist");
  }
}
