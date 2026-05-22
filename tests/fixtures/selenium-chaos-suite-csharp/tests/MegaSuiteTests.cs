using NUnit.Framework;
using SeleniumChaosSuite.Fixtures;
using SeleniumChaosSuite.Models;
using SeleniumChaosSuite.Pages;

namespace SeleniumChaosSuite.Tests;

[TestFixture]
public class MegaSuiteTests
{
    private LoginPage _loginPage = null!;
    private ProductsPage _productsPage = null!;
    private CartPage _cartPage = null!;
    private CheckoutPage _checkoutPage = null!;
    private ProfilePage _profilePage = null!;
    private SearchPage _searchPage = null!;

    [SetUp]
    public async Task Setup()
    {
        var driver = await DriverFactory.GetDriver();
        _loginPage = new LoginPage(driver);
        _productsPage = new ProductsPage(driver);
        _cartPage = new CartPage(driver);
        _checkoutPage = new CheckoutPage(driver);
        _profilePage = new ProfilePage(driver);
        _searchPage = new SearchPage(driver);
    }

    [TearDown]
    public async Task Teardown() => await DriverFactory.ResetDriver();

    [Test]
    public async Task MegaRun1()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        var title = await _productsPage.GetPageTitle();
        Assert.That(title, Is.EqualTo("Products"));
        await _productsPage.SortBy("lohi");
        await _productsPage.SortBy("hilo");
        await _productsPage.AddBackpackToCart();
        await _productsPage.AddBikeLightToCart();
        await _productsPage.AddBoltShirtToCart();
        await _productsPage.GoToCartFromHeader();
        var cartCount = await _cartPage.GetCartItemCount();
        Assert.That(cartCount, Is.GreaterThan(0));
        await _cartPage.GoToCheckout();
        await _checkoutPage.FillCheckoutInfo("Mega", "One", "11111");
        var completeHeader = await _checkoutPage.FinishCheckout();
        Assert.That(completeHeader, Does.Contain("Thank you"));
        await _profilePage.OpenAllItems();
        await _searchPage.RepeatSearchNoise(new[] { "sauce", "labs", "backpack" });
        var logoutBody = await _profilePage.LogoutAndGetBodyText();
        Assert.That(logoutBody, Does.Contain("Password"));
    }

    [Test]
    public async Task MegaRun2()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        var (badge, count) = await _productsPage.AddAllItemsOneByOne();
        Assert.That(badge, Is.EqualTo(count.ToString()));
        await _productsPage.GoToCartFromHeader();
        var badgeCount = await _cartPage.ClearCartAggressively();
        Assert.That(badgeCount, Is.EqualTo(0));
        await _cartPage.ContinueShopping();
        await _productsPage.StressOpenAndBack(12);
        await _productsPage.AddBackpackToCart();
        await _productsPage.AddBikeLightToCart();
        await _productsPage.GoToCartFromHeader();
        await _cartPage.GoToCheckout();
        await _checkoutPage.FillCheckoutInfo("Legacy", "User", "90909");
        await _checkoutPage.FinishCheckout();
        var resetBadges = await _profilePage.ResetAppState();
        Assert.That(resetBadges, Is.EqualTo(0));
    }

    [Test]
    public async Task MegaRun3()
    {
        var errText = await _loginPage.LoginAsLockedUserAndGetError();
        Assert.That(errText, Does.Contain("locked out"));
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        await _productsPage.NavigateToRelativeRoute("admin/users");
        await _productsPage.NavigateToRelativeRoute("orders");
        var title3 = await _productsPage.GetPageTitle();
        Assert.That(title3, Is.EqualTo("Products"));
    }

    [Test]
    public async Task MegaRun4()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        await _productsPage.AddBackpackToCart();
        await _productsPage.RemoveBackpackFromCart();
        await _productsPage.AddBikeLightToCart();
        await _productsPage.RemoveBikeLightFromCart();
        await _productsPage.AddJacketToCart();
        await _productsPage.AddOnesieToCart();
        await _productsPage.AddRedShirtToCart();
        await _productsPage.GoToCartFromHeader();
        var cartCount4 = await _cartPage.GetCartItemCount();
        Assert.That(cartCount4, Is.GreaterThan(0));
    }

    [Test]
    public async Task MegaRun5()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        var body = await _productsPage.StressOpenAndBack(15);
        Assert.That(body, Does.Contain("Products"));
        await _profilePage.OpenAllItems();
        var resetBadges5 = await _profilePage.ResetAppState();
        Assert.That(resetBadges5, Is.EqualTo(0));
        await _searchPage.RepeatSearchNoise(new[] { "abc", "def", "ghi", "jkl", "mno", "pqr" });
    }
}
