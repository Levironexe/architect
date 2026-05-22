using OpenQA.Selenium;
using SeleniumChaosSuite.Fixtures;
using SeleniumChaosSuite.Models;

namespace SeleniumChaosSuite.Pages;

public class LoginPage : BasePage
{
    public LoginPage(IWebDriver driver) : base(driver) { }

    public Task GoToLogin() => Open(TestConfig.BaseUrl);

    public Task EnterUsername(string username) => TypeByCss("#user-name", username);

    public Task EnterPassword(string password) => TypeByCss("#password", password);

    public Task ClickLoginButton() => ClickByCss("#login-button");

    public async Task LoginWith(string username, string password)
    {
        await GoToLogin();
        await EnterUsername(username);
        await EnterPassword(password);
        await ClickLoginButton();
        Wait.Until(d => d.Url.Contains("inventory") || d.FindElements(By.CssSelector("h3[data-test='error']")).Count > 0);
    }

    public async Task<string> LoginAsStandardUser()
    {
        await LoginWith(Users.Standard.Username, Users.Standard.Password);
        return Driver.Url;
    }

    public async Task<string> LoginAsLockedUserAndGetError()
    {
        await LoginWith(Users.Locked.Username, Users.Locked.Password);
        var el = Wait.Until(d => d.FindElement(By.CssSelector("h3[data-test='error']")));
        return el.Text;
    }

    public Task<bool> AreFormElementsPresent()
    {
        var u = Wait.Until(d => d.FindElement(By.CssSelector("#user-name"))).Displayed;
        var p = Wait.Until(d => d.FindElement(By.CssSelector("#password"))).Displayed;
        var b = Wait.Until(d => d.FindElement(By.CssSelector("#login-button"))).Displayed;
        return Task.FromResult(u && p && b);
    }

    public async Task<List<string>> TryBadCredentials()
    {
        var badPairs = new (string U, string P)[]
        {
            ("", ""),
            ("bad", "bad"),
            (Users.Standard.Username, ""),
            ("", Users.Standard.Password)
        };

        var results = new List<string>();
        foreach (var pair in badPairs)
        {
            await GoToLogin();
            await EnterUsername(pair.U);
            await EnterPassword(pair.P);
            await ClickLoginButton();
            Wait.Until(d => d.FindElements(By.CssSelector("h3[data-test='error']")).Count > 0);
            var body = Driver.FindElement(By.CssSelector("body")).Text;
            results.Add(body);
        }

        return results;
    }
}
