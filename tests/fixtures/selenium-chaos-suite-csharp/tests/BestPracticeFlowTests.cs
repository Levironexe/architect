using NUnit.Framework;
using SeleniumChaosSuite.Fixtures;
using SeleniumChaosSuite.Flows;
using SeleniumChaosSuite.Models;
using SeleniumChaosSuite.Pages;

namespace SeleniumChaosSuite.Tests;

[TestFixture]
public class BestPracticeFlowTests
{
    private LoginPage _loginPage = null!;
    private CheckoutFlow _checkoutFlow = null!;

    [SetUp]
    public async Task Setup()
    {
        var driver = await DriverFactory.GetDriver();
        _loginPage = new LoginPage(driver);
        _checkoutFlow = new CheckoutFlow(driver);
    }

    [TearDown]
    public async Task Teardown() => await DriverFactory.ResetDriver();

    [Test]
    public async Task HappyPathCheckout_UsesCleanFlowArchitecture()
    {
        await _checkoutFlow.RunHappyPathCheckout();
    }

    [Test]
    public async Task LockedUser_ShowsDeterministicError()
    {
        var errText = await _loginPage.LoginAsLockedUserAndGetError();
        Assert.That(errText, Does.Contain("locked out"));
    }
}
