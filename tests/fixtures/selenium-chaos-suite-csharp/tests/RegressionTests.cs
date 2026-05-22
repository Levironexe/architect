using NUnit.Framework;
using SeleniumChaosSuite.Fixtures;
using SeleniumChaosSuite.Flows;
using SeleniumChaosSuite.Models;
using SeleniumChaosSuite.Pages;

namespace SeleniumChaosSuite.Tests;

[TestFixture]
public class RegressionTests
{
    private LoginPage _loginPage = null!;
    private ProductsPage _productsPage = null!;
    private CartPage _cartPage = null!;
    private CheckoutPage _checkoutPage = null!;
    private ProfilePage _profilePage = null!;
    private AdminUsersPage _adminUsersPage = null!;
    private CheckoutFlow _checkoutFlow = null!;

    [SetUp]
    public async Task Setup()
    {
        var driver = await DriverFactory.GetDriver();
        _loginPage = new LoginPage(driver);
        _productsPage = new ProductsPage(driver);
        _cartPage = new CartPage(driver);
        _checkoutPage = new CheckoutPage(driver);
        _profilePage = new ProfilePage(driver);
        _adminUsersPage = new AdminUsersPage(driver);
        _checkoutFlow = new CheckoutFlow(driver);
    }

    [TearDown]
    public async Task Teardown() => await DriverFactory.ResetDriver();

    [Test]
    public async Task RegressionAuthSmoke()
    {
        var present = await _loginPage.AreFormElementsPresent();
        Assert.That(present, Is.True);
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        var title = await _productsPage.GetPageTitle();
        Assert.That(title, Is.EqualTo("Products"));
    }

    [Test]
    public async Task RegressionProductSortingAndStressBackNav()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        await _productsPage.SortLowToHigh();
        await _productsPage.SortHighToLow();
        var body = await _productsPage.StressOpenAndBack(8);
        Assert.That(body, Does.Contain("Products"));
    }

    [Test]
    public async Task RegressionCartClearAndRefill()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        var (badge, count) = await _productsPage.AddAllItemsOneByOne();
        Assert.That(badge, Is.EqualTo(count.ToString()));
        await _productsPage.GoToCartFromHeader();
        var badgeCount = await _cartPage.ClearCartAggressively();
        Assert.That(badgeCount, Is.EqualTo(0));
        await _cartPage.ContinueShopping();
        await _productsPage.AddBackpackToCart();
        await _productsPage.GoToCartFromHeader();
        var cartCount = await _cartPage.GetCartItemCount();
        Assert.That(cartCount, Is.GreaterThan(0));
    }

    [Test]
    public async Task RegressionCheckoutHappyPathWithFlow()
    {
        await _checkoutFlow.RunHappyPathCheckout();
    }

    [Test]
    public async Task RegressionCheckoutAltPathWithFlow()
    {
        await _checkoutFlow.RunAddRemoveReaddCheckout();
    }

    [Test]
    public async Task RegressionProfileActions()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        await _profilePage.OpenAllItems();
        var resetBadges = await _profilePage.ResetAppState();
        Assert.That(resetBadges, Is.EqualTo(0));
        var logoutBody = await _profilePage.LogoutAndGetBodyText();
        Assert.That(logoutBody, Does.Contain("Password"));
    }

    [Test]
    public async Task RegressionFakeAdminPageChecks()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        await _adminUsersPage.OpenAsFakeRoute();
        var adminBody = await _adminUsersPage.GetBodyText();
        Assert.That(adminBody, Does.Contain("Users").Or.Contain("404").Or.Contain("Not Found"));
        await _adminUsersPage.SearchUser("someone@example.com");
        var searchBody = await _adminUsersPage.GetBodyText();
        Assert.That(searchBody.Length, Is.GreaterThan(0));
        await _adminUsersPage.ToggleFirstCheckboxUnsafe();
    }

    [Test]
    public async Task RegressionCheckoutBadSubmit()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        await _productsPage.AddBackpackToCart();
        await _productsPage.GoToCartFromHeader();
        await _cartPage.GoToCheckout();
        var brokenBody = await _checkoutPage.DoBrokenSubmissionAndGetBody();
        Assert.That(brokenBody.ToLowerInvariant(), Does.Contain("error"));
    }
}
