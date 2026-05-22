using NUnit.Framework;
using SeleniumChaosSuite.Fixtures;
using SeleniumChaosSuite.Models;
using SeleniumChaosSuite.Pages;

namespace SeleniumChaosSuite.Tests;

[TestFixture]
public class FlakyEndToEndTests
{
    private LoginPage _loginPage = null!;
    private ProductsPage _productsPage = null!;
    private CartPage _cartPage = null!;
    private CheckoutPage _checkoutPage = null!;
    private ProfilePage _profilePage = null!;
    private SearchPage _searchPage = null!;
    private AdminUsersPage _adminUsersPage = null!;

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
        _adminUsersPage = new AdminUsersPage(driver);
    }

    [TearDown]
    public async Task Teardown() => await DriverFactory.ResetDriver();

    [Test]
    public async Task DoManyUnrelatedStepsInOneTest()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        var title = await _productsPage.GetPageTitle();
        Assert.That(title, Is.EqualTo("Products"));
        var badge1 = await _productsPage.AddBackpackToCart();
        Assert.That(badge1, Is.EqualTo("1"));
        var badge2 = await _productsPage.AddBikeLightToCart();
        Assert.That(badge2, Does.Contain("2"));
        await _productsPage.OpenFirstItem();
        var details = await _productsPage.GetItemDetails();
        Assert.That(details.name.ToLowerInvariant(), Does.Contain("sauce"));
        Assert.That(details.description.Length, Is.GreaterThan(10));
        Assert.That(details.price, Does.Contain("$"));
        await _productsPage.GoToCartFromHeader();
        var cartCount = await _cartPage.GetCartItemCount();
        Assert.That(cartCount, Is.GreaterThan(0));
        await _cartPage.GoToCheckout();
        await _checkoutPage.FillCheckoutInfo("Mega", "Flow", "55555");
        var totalLabel = await _checkoutPage.GetTotalLabel();
        Assert.That(totalLabel, Does.Contain("Total:"));
        Assert.That(totalLabel, Does.Contain("$"));
        var completeHeader = await _checkoutPage.FinishCheckout();
        Assert.That(completeHeader, Does.Contain("Thank you"));

        await _profilePage.OpenAllItems();
        await _searchPage.RepeatSearchNoise(new[] { "Sauce", "Backpack", "Bad Search" });

        await _adminUsersPage.OpenAsFakeRoute();
        var adminBody = await _adminUsersPage.GetBodyText();
        Assert.That(adminBody, Does.Contain("Users").Or.Contain("404").Or.Contain("Not Found"));
        await _adminUsersPage.ToggleFirstCheckboxUnsafe();

        var logoutBody = await _profilePage.LogoutAndGetBodyText();
        Assert.That(logoutBody, Does.Contain("Password"));
    }
}
