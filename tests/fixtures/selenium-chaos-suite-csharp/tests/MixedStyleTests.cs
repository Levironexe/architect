using NUnit.Framework;
using SeleniumChaosSuite.Fixtures;
using SeleniumChaosSuite.Models;
using SeleniumChaosSuite.Pages;

namespace SeleniumChaosSuite.Tests;

[TestFixture]
public class MixedStyleTests
{
    private LoginPage _loginPage = null!;
    private ProductsPage _productsPage = null!;
    private CartPage _cartPage = null!;

    [SetUp]
    public async Task Setup()
    {
        var driver = await DriverFactory.GetDriver();
        _loginPage = new LoginPage(driver);
        _productsPage = new ProductsPage(driver);
        _cartPage = new CartPage(driver);
    }

    [TearDown]
    public async Task Teardown() => await DriverFactory.ResetDriver();

    [Test]
    public async Task TestA()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        var badge1 = await _productsPage.AddBackpackToCart();
        Assert.That(badge1, Is.EqualTo("1"));
        await _productsPage.GoToCartFromHeader();
        var cartCount = await _cartPage.GetCartItemCount();
        Assert.That(cartCount, Is.GreaterThan(0));
    }

    [Test]
    public async Task TestB()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        await _productsPage.AddBikeLightToCart();
        await _productsPage.GoToCartFromHeader();
        var cartCount = await _cartPage.GetCartItemCount();
        Assert.That(cartCount, Is.GreaterThan(0));
    }

    [Test]
    public async Task TestC()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        await _productsPage.SortLowToHigh();
        await _productsPage.SortHighToLow();
        await _productsPage.OpenFirstItem();
        var details = await _productsPage.GetItemDetails();
        Assert.That(details.name.ToLowerInvariant(), Does.Contain("sauce"));
        Assert.That(details.description.Length, Is.GreaterThan(10));
        Assert.That(details.price, Does.Contain("$"));
    }
}
