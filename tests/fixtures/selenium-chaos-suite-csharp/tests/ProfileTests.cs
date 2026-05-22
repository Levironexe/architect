using NUnit.Framework;
using SeleniumChaosSuite.Fixtures;
using SeleniumChaosSuite.Models;
using SeleniumChaosSuite.Pages;

namespace SeleniumChaosSuite.Tests;

[TestFixture]
public class ProfileTests
{
    private LoginPage _loginPage = null!;
    private ProfilePage _profilePage = null!;
    private ProductsPage _productsPage = null!;

    [SetUp]
    public async Task Setup()
    {
        var driver = await DriverFactory.GetDriver();
        _loginPage = new LoginPage(driver);
        _profilePage = new ProfilePage(driver);
        _productsPage = new ProductsPage(driver);
    }

    [TearDown]
    public async Task Teardown() => await DriverFactory.ResetDriver();

    [Test]
    public async Task OpenAllItems()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        await _profilePage.OpenAllItems();
        var title = await _productsPage.GetPageTitle();
        Assert.That(title, Is.EqualTo("Products"));
    }

    [Test]
    public async Task ResetStateAndKeepBrowsing()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        var badgeCount = await _profilePage.ResetAppState();
        Assert.That(badgeCount, Is.EqualTo(0));
        var title2 = await _productsPage.GetPageTitle();
        Assert.That(title2, Is.EqualTo("Products"));
    }

    [Test]
    public async Task AboutLinkNavigation()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        var aboutUrl = await _profilePage.OpenAboutAndGetUrl();
        Assert.That(aboutUrl, Does.Contain("saucelabs"));
    }

    [Test]
    public async Task LogoutFlow()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        var logoutBody = await _profilePage.LogoutAndGetBodyText();
        Assert.That(logoutBody, Does.Contain("Password"));
    }
}
