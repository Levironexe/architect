using NUnit.Framework;
using SeleniumChaosSuite.Fixtures;
using SeleniumChaosSuite.Flows;
using SeleniumChaosSuite.Models;
using SeleniumChaosSuite.Pages;

namespace SeleniumChaosSuite.Tests;

[TestFixture]
public class CheckoutTests
{
    private LoginPage _loginPage = null!;
    private ProductsPage _productsPage = null!;
    private CartPage _cartPage = null!;
    private CheckoutPage _checkoutPage = null!;
    private CheckoutFlow _checkoutFlow = null!;

    [SetUp]
    public async Task Setup()
    {
        var driver = await DriverFactory.GetDriver();
        _loginPage = new LoginPage(driver);
        _productsPage = new ProductsPage(driver);
        _cartPage = new CartPage(driver);
        _checkoutPage = new CheckoutPage(driver);
        _checkoutFlow = new CheckoutFlow(driver);
    }

    [TearDown]
    public async Task Teardown() => await DriverFactory.ResetDriver();

    [Test]
    public async Task HappyPathCheckout()
    {
        await _checkoutFlow.RunHappyPathCheckout();
    }

    [Test]
    public async Task ManualCheckoutPath()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        await _productsPage.AddBackpackToCart();
        await _productsPage.GoToCartFromHeader();
        await _cartPage.GoToCheckout();
        await _checkoutPage.FillCheckoutInfo("John", "Smith", "90210");
        var summaryInfo = await _checkoutPage.GetSummaryInfo();
        Assert.That(summaryInfo, Does.Contain("Payment Information"));
        Assert.That(summaryInfo, Does.Contain("Shipping Information"));
        var totalLabel = await _checkoutPage.GetTotalLabel();
        Assert.That(totalLabel, Does.Contain("Total:"));
        Assert.That(totalLabel, Does.Contain("$"));
        var completeHeader = await _checkoutPage.FinishCheckout();
        Assert.That(completeHeader, Does.Contain("Thank you"));
    }

    [Test]
    public async Task BrokenCheckoutPath()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        await _productsPage.AddBackpackToCart();
        await _productsPage.GoToCartFromHeader();
        await _cartPage.GoToCheckout();
        var body = await _checkoutPage.DoBrokenSubmissionAndGetBody();
        Assert.That(body.ToLowerInvariant(), Does.Contain("error"));
    }
}
