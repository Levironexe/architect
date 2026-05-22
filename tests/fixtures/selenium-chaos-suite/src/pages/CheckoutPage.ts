import { By } from "selenium-webdriver";
import { BasePage } from "./BasePage";
import { AssertionHelper } from "../core/AssertionHelper";
import { WaitUtils } from "../core/WaitUtils";

export class CheckoutPage extends BasePage {
  async fillFirstName(firstName: string) {
    await this.typeByCss("#first-name", firstName);
  }

  async fillLastName(lastName: string) {
    await this.typeByCss("#last-name", lastName);
  }

  async fillPostalCode(postalCode: string) {
    await this.typeByCss("#postal-code", postalCode);
  }

  async submitStepOne() {
    await this.clickByCss("#continue");
    await WaitUtils.sleep(300);
  }

  async fillCheckoutInfo(firstName: string, lastName: string, postalCode: string) {
    await this.fillFirstName(firstName);
    await this.fillLastName(lastName);
    await this.fillPostalCode(postalCode);
    await this.submitStepOne();
    await this.assertUrlContains("checkout-step-two");
  }

  async assertSummaryContainsPayment() {
    const info = await this.getTextByCss(".summary_info");
    AssertionHelper.shouldContain(info, "Payment Information", "Missing payment info");
    AssertionHelper.shouldContain(info, "Shipping Information", "Missing shipping info");
  }

  async finishCheckout() {
    await this.clickByCss("#finish");
    await this.assertUrlContains("checkout-complete");
    const complete = await this.getTextByCss(".complete-header");
    AssertionHelper.shouldContain(complete, "Thank you", "Completion header mismatch");
  }

  async assertTotalLooksValid() {
    const totalLine = await this.getTextByCss(".summary_total_label");
    AssertionHelper.shouldContain(totalLine, "Total:", "Total label not visible");
    AssertionHelper.shouldContain(totalLine, "$", "Total amount missing currency");
  }

  async doBrokenSubmissionAndAssertErrors() {
    await this.clickByCss("#cancel");
    await this.driver.navigate().back();
    await this.submitStepOne();
    const body = await this.driver.findElement(By.css("body")).getText();
    AssertionHelper.shouldContain(body.toLowerCase(), "error", "Expected error when fields are empty");
  }
}
