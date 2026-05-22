using DotNetEnv;

namespace SeleniumChaosSuite.Fixtures;

public static class TestConfig
{
    static TestConfig()
    {
        try
        {
            DotNetEnv.Env.Load();
        }
        catch
        {
            // Ignore missing .env file to mirror TS fixture behavior.
        }
    }

    private static string Get(string key, string fallback) =>
        Environment.GetEnvironmentVariable(key) ?? fallback;

    public static string BaseUrl => Get("BASE_URL", "https://www.saucedemo.com");
    public static string BrowserName => Get("BROWSER", "chrome");
    public static bool Headless => Get("HEADLESS", "false").Equals("true", StringComparison.OrdinalIgnoreCase);
    public static string AdminEmail => Get("ADMIN_EMAIL", "admin@petcarehub.local");
    public static string AdminPassword => Get("ADMIN_PASSWORD", "admin123");
    public static string DefaultPassword => Get("DEFAULT_PASSWORD", "Password123!");
    public static int SlowModeMs => int.TryParse(Get("SLOW_MODE_MS", "500"), out var v) ? v : 500;
    public static int Retries => int.TryParse(Get("RETRIES", "0"), out var v) ? v : 0;
    public static bool ScreenshotOnFailure => !Get("SCREENSHOT_ON_FAILURE", "true").Equals("false", StringComparison.OrdinalIgnoreCase);
}
