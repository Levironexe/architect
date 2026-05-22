using NUnit.Framework;
using SeleniumChaosSuite.Fixtures;
using SeleniumChaosSuite.Models;
using SeleniumChaosSuite.Pages;

namespace SeleniumChaosSuite.Tests;

[TestFixture]
public class SearchTests
{
    private LoginPage _loginPage = null!;
    private SearchPage _searchPage = null!;

    [SetUp]
    public async Task Setup()
    {
        var driver = await DriverFactory.GetDriver();
        _loginPage = new LoginPage(driver);
        _searchPage = new SearchPage(driver);
    }

    [TearDown]
    public async Task Teardown() => await DriverFactory.ResetDriver();

    [Test]
    public async Task SearchWithProductNames()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        await _searchPage.RepeatSearchNoise(Products.Items.Take(4));
    }

    [Test]
    public async Task SearchWithRandomText()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        await _searchPage.RepeatSearchNoise(new[] { "abc", "xyz", "sauce", "whatever" });
    }
}
