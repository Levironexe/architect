using NUnit.Framework;
using SeleniumChaosSuite.Fixtures;
using SeleniumChaosSuite.Models;
using SeleniumChaosSuite.Pages;

namespace SeleniumChaosSuite.Tests;

[TestFixture]
public class AdminUsersTests
{
    private LoginPage _loginPage = null!;
    private AdminUsersPage _adminUsersPage = null!;

    [SetUp]
    public async Task Setup()
    {
        var driver = await DriverFactory.GetDriver();
        _loginPage = new LoginPage(driver);
        _adminUsersPage = new AdminUsersPage(driver);
    }

    [TearDown]
    public async Task Teardown() => await DriverFactory.ResetDriver();

    [Test]
    public async Task OpenFakeAdminRoute()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        await _adminUsersPage.OpenAsFakeRoute();
        var adminBody = await _adminUsersPage.GetBodyText();
        Assert.That(adminBody, Does.Contain("Users").Or.Contain("404").Or.Contain("Not Found"));
    }

    [Test]
    public async Task SearchFakeUser()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        await _adminUsersPage.OpenAsFakeRoute();
        await _adminUsersPage.SearchUser("qa@petcarehub.local");
        var searchBody = await _adminUsersPage.GetBodyText();
        Assert.That(searchBody.Length, Is.GreaterThan(0));
    }

    [Test]
    public async Task ToggleCheckboxUnsafely()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        await _adminUsersPage.OpenAsFakeRoute();
        await _adminUsersPage.ToggleFirstCheckboxUnsafe();
    }
}
