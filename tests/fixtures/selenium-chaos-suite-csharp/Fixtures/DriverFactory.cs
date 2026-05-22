using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
namespace SeleniumChaosSuite.Fixtures;

public static class DriverFactory
{
    private static IWebDriver? _sharedDriver;

    public static Task<IWebDriver> GetDriver()
    {
        if (_sharedDriver is not null)
        {
            return Task.FromResult(_sharedDriver);
        }

        if (!TestConfig.BrowserName.Equals("chrome", StringComparison.OrdinalIgnoreCase))
        {
            throw new NotSupportedException($"Only Chrome is supported in this fixture. Requested: {TestConfig.BrowserName}");
        }

        var options = new ChromeOptions();
        if (TestConfig.Headless)
        {
            options.AddArgument("--headless=new");
        }

        options.AddArgument("--window-size=1440,1000");

        _sharedDriver = new ChromeDriver(options);
        _sharedDriver.Manage().Timeouts().ImplicitWait = TimeSpan.Zero;
        _sharedDriver.Manage().Timeouts().PageLoad = TimeSpan.FromSeconds(60);
        _sharedDriver.Manage().Timeouts().AsynchronousJavaScript = TimeSpan.FromSeconds(30);

        return Task.FromResult(_sharedDriver);
    }

    public static Task ResetDriver()
    {
        if (_sharedDriver is not null)
        {
            try
            {
                _sharedDriver.Quit();
            }
            catch
            {
                // Intentionally swallowed to mirror TS fixture behavior.
            }

            _sharedDriver = null;
        }

        return Task.CompletedTask;
    }

    public static IWebDriver? GetUnsafeDriverReference() => _sharedDriver;
}
