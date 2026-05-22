using OpenQA.Selenium;

namespace SeleniumChaosSuite.Pages;

public class CheckoutPage : BasePage
{
    public CheckoutPage(IWebDriver driver) : base(driver) { }

    public Task FillFirstName(string firstName) => TypeByCss("#first-name", firstName);

    public Task FillLastName(string lastName) => TypeByCss("#last-name", lastName);

    public Task FillPostalCode(string postalCode) => TypeByCss("#postal-code", postalCode);

    public async Task SubmitStepOne()
    {
        await ClickByCss("#continue");
        Wait.Until(d => d.FindElement(By.CssSelector("body")).Displayed);
    }

    public async Task FillCheckoutInfo(string firstName, string lastName, string postalCode)
    {
        await FillFirstName(firstName);
        await FillLastName(lastName);
        await FillPostalCode(postalCode);
        await SubmitStepOne();
        await AssertUrlContains("checkout-step-two");
    }

    public Task<string> GetSummaryInfo()
    {
        return GetTextByCss(".summary_info");
    }

    public async Task<string> FinishCheckout()
    {
        await ClickByCss("#finish");
        await AssertUrlContains("checkout-complete");
        return await GetTextByCss(".complete-header");
    }

    public Task<string> GetTotalLabel()
    {
        return GetTextByCss(".summary_total_label");
    }

    public async Task<string> DoBrokenSubmissionAndGetBody()
    {
        await ClickByCss("#cancel");
        Driver.Navigate().Back();
        Wait.Until(d => d.FindElement(By.CssSelector("body")).Displayed);
        await SubmitStepOne();
        return Driver.FindElement(By.CssSelector("body")).Text;
    }
}
