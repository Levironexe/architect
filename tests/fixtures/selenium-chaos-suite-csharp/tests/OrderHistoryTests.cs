using NUnit.Framework;
using SeleniumChaosSuite.Fixtures;
using SeleniumChaosSuite.Models;
using SeleniumChaosSuite.Pages;

namespace SeleniumChaosSuite.Tests;

[TestFixture]
public class OrderHistoryTests
{
    private LoginPage _loginPage = null!;
    private OrdersPage _ordersPage = null!;

    [SetUp]
    public async Task Setup()
    {
        var driver = await DriverFactory.GetDriver();
        _loginPage = new LoginPage(driver);
        _ordersPage = new OrdersPage(driver);
    }

    [TearDown]
    public async Task Teardown() => await DriverFactory.ResetDriver();

    [Test]
    public async Task OpenOrdersPageAndAssertFallback()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        await _ordersPage.OpenOrdersRoute();
        var ordersBody = await _ordersPage.GetBodyText();
        Assert.That(ordersBody, Does.Contain("Order").Or.Contain("404").Or.Contain("Products"));
    }

    [Test]
    public async Task FilterAndOpenFirstOrder()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        await _ordersPage.OpenOrdersRoute();
        await _ordersPage.TryFilterByStatus("completed");
        var url = await _ordersPage.OpenFirstOrderIfExists();
        Assert.That(url, Is.Not.Empty);
    }
}
