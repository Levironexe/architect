using NUnit.Framework;
using SeleniumChaosSuite.Fixtures;
using SeleniumChaosSuite.Models;
using SeleniumChaosSuite.Pages;

namespace SeleniumChaosSuite.Tests;

[TestFixture]
public class SmokeTests
{
    private LoginPage _loginPage = null!;
    private ProductsPage _productsPage = null!;
    private CartPage _cartPage = null!;
    private CheckoutPage _checkoutPage = null!;

    [SetUp]
    public async Task Setup()
    {
        var driver = await DriverFactory.GetDriver();
        _loginPage = new LoginPage(driver);
        _productsPage = new ProductsPage(driver);
        _cartPage = new CartPage(driver);
        _checkoutPage = new CheckoutPage(driver);
    }

    [TearDown]
    public async Task Teardown() => await DriverFactory.ResetDriver();

    [Test]
    public async Task ShouldLoginAndNavigateAround()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        var title = await _productsPage.GetPageTitle();
        Assert.That(title, Is.EqualTo("Products"));
        await _productsPage.SortLowToHigh();
        await _productsPage.SortHighToLow();
        await _productsPage.OpenFirstItem();
        var details = await _productsPage.GetItemDetails();
        Assert.That(details.name.ToLowerInvariant(), Does.Contain("sauce"));
        Assert.That(details.description.Length, Is.GreaterThan(10));
        Assert.That(details.price, Does.Contain("$"));
        await _productsPage.AssertUrlContains("inventory-item");
    }

    [Test]
    public async Task ShouldAddCartItemsAndCheckout()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        var badge1 = await _productsPage.AddBackpackToCart();
        Assert.That(badge1, Is.EqualTo("1"));
        var badge2 = await _productsPage.AddBikeLightToCart();
        Assert.That(badge2, Does.Contain("2"));
        await _productsPage.GoToCartFromHeader();
        var cartTitle = await _cartPage.GetCartTitle();
        Assert.That(cartTitle, Is.EqualTo("Your Cart"));
        var cartCount = await _cartPage.GetCartItemCount();
        Assert.That(cartCount, Is.GreaterThan(0));
        await _cartPage.GoToCheckout();
        await _checkoutPage.FillCheckoutInfo(Users.Standard.FirstName, Users.Standard.LastName, Users.Standard.Zip);
        var summaryInfo = await _checkoutPage.GetSummaryInfo();
        Assert.That(summaryInfo, Does.Contain("Payment Information"));
        Assert.That(summaryInfo, Does.Contain("Shipping Information"));
        var completeHeader = await _checkoutPage.FinishCheckout();
        Assert.That(completeHeader, Does.Contain("Thank you"));
    }

    [Test]
    public async Task ShouldShowLockedUserErrors()
    {
        var errText = await _loginPage.LoginAsLockedUserAndGetError();
        Assert.That(errText, Does.Contain("locked out"));
        var bodies = await _loginPage.TryBadCredentials();
        foreach (var body in bodies)
            Assert.That(body.ToLowerInvariant(), Does.Contain("error"));
    }
}
