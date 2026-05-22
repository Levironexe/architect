using NUnit.Framework;
using SeleniumChaosSuite.Fixtures;
using SeleniumChaosSuite.Models;
using SeleniumChaosSuite.Pages;

namespace SeleniumChaosSuite.Tests;

[TestFixture]
public class CartTests
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
    public async Task AddTwoItemsAndAssertCart()
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
    }

    [Test]
    public async Task RemoveOneItem()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        await _productsPage.AddBackpackToCart();
        await _productsPage.GoToCartFromHeader();
        var bodyAfterRemove = await _cartPage.RemoveFirstItem();
        Assert.That(bodyAfterRemove, Does.Contain("Your Cart"));
    }

    [Test]
    public async Task ClearAllCartItems()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        var (badge, count) = await _productsPage.AddAllItemsOneByOne();
        Assert.That(badge, Is.EqualTo(count.ToString()));
        await _productsPage.GoToCartFromHeader();
        var badgeCount = await _cartPage.ClearCartAggressively();
        Assert.That(badgeCount, Is.EqualTo(0));
    }

    [Test]
    public async Task ContinueShoppingFromCart()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        await _productsPage.AddBackpackToCart();
        await _productsPage.GoToCartFromHeader();
        await _cartPage.ContinueShopping();
        var title = await _productsPage.GetPageTitle();
        Assert.That(title, Is.EqualTo("Products"));
    }
}
