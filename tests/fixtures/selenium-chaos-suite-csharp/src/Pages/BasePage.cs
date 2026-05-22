using OpenQA.Selenium;
using OpenQA.Selenium.Support.UI;
using SeleniumChaosSuite.Utilities;

namespace SeleniumChaosSuite.Pages;

public class BasePage
{
    protected readonly IWebDriver Driver;
    protected readonly WebDriverWait Wait;
    public string LastVisited { get; private set; } = string.Empty;

    protected BasePage(IWebDriver driver, int timeoutSeconds = 10)
    {
        Driver = driver;
        Wait = new WebDriverWait(driver, TimeSpan.FromSeconds(timeoutSeconds));
        Wait.IgnoreExceptionTypes(typeof(NoSuchElementException), typeof(StaleElementReferenceException));
    }

    public Task Open(string url)
    {
        LastVisited = url;
        Logger.Info("Opening URL", new { url });
        Driver.Navigate().GoToUrl(url);
        Wait.Until(d => d.FindElement(By.CssSelector("body")).Displayed);
        return Task.CompletedTask;
    }

    public Task ClickByCss(string css)
    {
        try
        {
            var element = Wait.Until(d => d.FindElement(By.CssSelector(css)));
            element.Click();
        }
        catch
        {
            Logger.Warn("clickByCss failed, retrying with brute force", new { css });
            WaitUtils.RetryClick(Driver, By.CssSelector(css));
        }

        return Task.CompletedTask;
    }

    public Task TypeByCss(string css, string value)
    {
        var el = Wait.Until(d => d.FindElement(By.CssSelector(css)));
        el.Clear();
        el.SendKeys(value);
        return Task.CompletedTask;
    }

    public Task<string> GetTextByCss(string css)
    {
        var el = Wait.Until(d => d.FindElement(By.CssSelector(css)));
        return Task.FromResult(el.Text);
    }

    public Task AssertTitleContains(string text)
    {
        AssertionHelper.ShouldContain(Driver.Title, text, "Page title mismatch");
        return Task.CompletedTask;
    }

    public Task AssertUrlContains(string segment)
    {
        AssertionHelper.ShouldContain(Driver.Url, segment, "URL mismatch");
        return Task.CompletedTask;
    }

    public Task GoBack()
    {
        Driver.Navigate().Back();
        Wait.Until(d => d.FindElement(By.CssSelector("body")).Displayed);
        return Task.CompletedTask;
    }

    public Task NavigateToRelativeRoute(string route)
    {
        var current = Driver.Url;
        Driver.Navigate().GoToUrl($"{current.TrimEnd('/')}/{route}");
        Wait.Until(d => d.FindElement(By.CssSelector("body")).Displayed);
        return Task.CompletedTask;
    }

    public Task TakeScreenshot(string name)
    {
        if (Driver is ITakesScreenshot screenshotDriver)
        {
            var screenshot = screenshotDriver.GetScreenshot().AsBase64EncodedString;
            Logger.Info("Screenshot captured", new { name, bytes = screenshot.Length });
        }

        return Task.CompletedTask;
    }
}
