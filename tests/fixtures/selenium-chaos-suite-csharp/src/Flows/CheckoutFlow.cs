using OpenQA.Selenium;
using SeleniumChaosSuite.Models;
using SeleniumChaosSuite.Pages;

namespace SeleniumChaosSuite.Flows;

public class CheckoutFlow
{
    private readonly LoginPage _loginPage;
    private readonly ProductsPage _productsPage;
    private readonly CartPage _cartPage;
    private readonly CheckoutPage _checkoutPage;

    public CheckoutFlow(IWebDriver driver)
    {
        _loginPage = new LoginPage(driver);
        _productsPage = new ProductsPage(driver);
        _cartPage = new CartPage(driver);
        _checkoutPage = new CheckoutPage(driver);
    }

    public async Task RunHappyPathCheckout()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        await _productsPage.GetPageTitle();
        await _productsPage.AddBackpackToCart();
        await _productsPage.AddBikeLightToCart();
        await _productsPage.GoToCartFromHeader();
        await _cartPage.GetCartTitle();
        await _cartPage.GoToCheckout();
        await _checkoutPage.FillCheckoutInfo(Users.Standard.FirstName, Users.Standard.LastName, Users.Standard.Zip);
        await _checkoutPage.GetSummaryInfo();
        await _checkoutPage.GetTotalLabel();
        await _checkoutPage.FinishCheckout();
    }

    public async Task RunAddRemoveReaddCheckout()
    {
        await _loginPage.LoginWith(Users.Standard.Username, Users.Standard.Password);
        await _productsPage.AddBackpackToCart();
        await _productsPage.GoToCartFromHeader();
        await _cartPage.RemoveFirstItem();
        await _cartPage.ContinueShopping();
        await _productsPage.AddAllItemsOneByOne();
        await _productsPage.GoToCartFromHeader();
        await _cartPage.GoToCheckout();
        await _checkoutPage.FillCheckoutInfo("A", "B", "00000");
        await _checkoutPage.FinishCheckout();
    }
}
