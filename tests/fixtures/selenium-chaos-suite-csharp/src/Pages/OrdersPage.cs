using OpenQA.Selenium;

namespace SeleniumChaosSuite.Pages;

public class OrdersPage : BasePage
{
    public OrdersPage(IWebDriver driver) : base(driver) { }

    public async Task OpenOrdersRoute()
    {
        var current = Driver.Url;
        await Open($"{current.TrimEnd('/')}/orders");
    }

    public Task<string> GetBodyText()
    {
        return Task.FromResult(Driver.FindElement(By.CssSelector("body")).Text);
    }

    public Task TryFilterByStatus(string status)
    {
        var selects = Driver.FindElements(By.CssSelector("select"));
        if (selects.Count > 0)
        {
            selects[0].SendKeys(status);
        }

        return Task.CompletedTask;
    }

    public Task<string> OpenFirstOrderIfExists()
    {
        var links = Driver.FindElements(By.CssSelector("a"));
        if (links.Count > 0)
        {
            links[0].Click();
            Wait.Until(d => d.FindElement(By.CssSelector("body")).Displayed);
        }

        return Task.FromResult(Driver.Url);
    }
}
