using OpenQA.Selenium;

namespace SeleniumChaosSuite.Pages;

public class ProfilePage : BasePage
{
    public ProfilePage(IWebDriver driver) : base(driver) { }

    public async Task OpenMenu()
    {
        await ClickByCss("#react-burger-menu-btn");
        Wait.Until(d => d.FindElement(By.CssSelector(".bm-menu")).Displayed);
    }

    public async Task OpenAllItems()
    {
        await OpenMenu();
        await ClickByCss("#inventory_sidebar_link");
        Wait.Until(d => d.Url.Contains("inventory"));
        await AssertUrlContains("inventory");
    }

    public async Task<string> OpenAboutAndGetUrl()
    {
        await OpenMenu();
        await ClickByCss("#about_sidebar_link");
        Wait.Until(d => d.Url.Contains("saucelabs"));
        return Driver.Url;
    }

    public async Task<string> LogoutAndGetBodyText()
    {
        await OpenMenu();
        await ClickByCss("#logout_sidebar_link");
        Wait.Until(d => d.FindElements(By.CssSelector("#user-name")).Count > 0);
        return Driver.FindElement(By.CssSelector("body")).Text;
    }

    public async Task<int> ResetAppState()
    {
        await OpenMenu();
        await ClickByCss("#reset_sidebar_link");
        return Driver.FindElements(By.CssSelector(".shopping_cart_badge")).Count;
    }
}
