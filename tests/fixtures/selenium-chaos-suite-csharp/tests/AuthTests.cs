using NUnit.Framework;
using SeleniumChaosSuite.Fixtures;
using SeleniumChaosSuite.Models;
using SeleniumChaosSuite.Pages;

namespace SeleniumChaosSuite.Tests;

[TestFixture]
public class AuthTests
{
    private LoginPage _loginPage = null!;
    private ProductsPage _productsPage = null!;

    [SetUp]
    public async Task Setup()
    {
        var driver = await DriverFactory.GetDriver();
        _loginPage = new LoginPage(driver);
        _productsPage = new ProductsPage(driver);
    }

    [TearDown]
    public async Task Teardown() => await DriverFactory.ResetDriver();

    [Test]
    public async Task ValidLoginStandardUser()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        var title = await _productsPage.GetPageTitle();
        Assert.That(title, Is.EqualTo("Products"));
    }

    [Test]
    public async Task LockedUserShouldFail()
    {
        var errText = await _loginPage.LoginAsLockedUserAndGetError();
        Assert.That(errText, Does.Contain("locked out"));
    }

    [Test]
    public async Task MultipleInvalidAuthAttempts()
    {
        var bodies = await _loginPage.TryBadCredentials();
        foreach (var body in bodies)
            Assert.That(body.ToLowerInvariant(), Does.Contain("error"));
    }

    [Test]
    public async Task FormFieldsVisible()
    {
        await _loginPage.GoToLogin();
        var present = await _loginPage.AreFormElementsPresent();
        Assert.That(present, Is.True);
    }
}
