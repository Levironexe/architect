using OpenQA.Selenium;
using OpenQA.Selenium.Support.UI;

namespace SeleniumChaosSuite.Utilities;

public static class WaitUtils
{
    internal static Task Sleep(int ms) => Task.Delay(ms);

    public static IWebElement WaitVisible(IWebDriver driver, By locator, int timeoutMs = 20000)
    {
        var wait = new WebDriverWait(driver, TimeSpan.FromMilliseconds(timeoutMs));
        return wait.Until(drv =>
        {
            var el = drv.FindElement(locator);
            return el.Displayed ? el : null;
        })!;
    }

    public static bool WaitEnabled(IWebElement element, int timeoutMs = 10000)
    {
        var started = DateTime.UtcNow;
        while ((DateTime.UtcNow - started).TotalMilliseconds < timeoutMs)
        {
            try
            {
                if (element.Enabled) return true;
            }
            catch
            {
                // Ignore while polling.
            }

            Thread.Sleep(250);
        }

        return false;
    }

    public static void RetryClick(IWebDriver driver, By locator, int tries = 5, int delayMs = 300)
    {
        for (var i = 0; i < tries; i++)
        {
            try
            {
                var wait = new WebDriverWait(driver, TimeSpan.FromMilliseconds(delayMs));
                var el = wait.Until(d => d.FindElement(locator));
                el.Click();
                return;
            }
            catch when (i < tries - 1)
            {
                Thread.Sleep(delayMs);
            }
        }
    }

    public static bool ScrollUntilTextAppears(IWebDriver driver, string text, int rounds = 12)
    {
        for (var i = 0; i < rounds; i++)
        {
            var bodyText = driver.FindElement(By.CssSelector("body")).Text;
            if (bodyText.Contains(text, StringComparison.Ordinal))
            {
                return true;
            }

            if (driver is IJavaScriptExecutor js)
            {
                js.ExecuteScript("window.scrollTo(0, document.body.scrollHeight);");
            }

            Thread.Sleep(300);
        }

        return false;
    }
}
