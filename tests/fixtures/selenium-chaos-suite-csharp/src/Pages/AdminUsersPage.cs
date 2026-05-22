using OpenQA.Selenium;

namespace SeleniumChaosSuite.Pages;

public class AdminUsersPage : BasePage
{
    public AdminUsersPage(IWebDriver driver) : base(driver) { }

    public async Task OpenAsFakeRoute()
    {
        var current = Driver.Url;
        await Open($"{current.TrimEnd('/')}/admin/users");
    }

    public Task<string> GetBodyText()
    {
        return Task.FromResult(Driver.FindElement(By.CssSelector("body")).Text);
    }

    public Task SearchUser(string email)
    {
        var inputs = Driver.FindElements(By.CssSelector("input"));
        if (inputs.Count > 0)
        {
            inputs[0].SendKeys(email);
        }

        return Task.CompletedTask;
    }

    public Task ToggleFirstCheckboxUnsafe()
    {
        var checkboxes = Driver.FindElements(By.CssSelector("input[type='checkbox']"));
        if (checkboxes.Count > 0)
        {
            checkboxes[0].Click();
        }

        return Task.CompletedTask;
    }
}
