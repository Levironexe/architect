using OpenQA.Selenium;

namespace SeleniumChaosSuite.Pages;

public class CartPage : BasePage
{
    public CartPage(IWebDriver driver) : base(driver) { }

    public Task<string> GetCartTitle()
    {
        return GetTextByCss(".title");
    }

    public Task<int> GetCartItemCount()
    {
        var items = Driver.FindElements(By.CssSelector(".cart_item"));
        return Task.FromResult(items.Count);
    }

    public async Task<string> RemoveFirstItem()
    {
        var removeButtons = Driver.FindElements(By.CssSelector("button.cart_button"));
        if (removeButtons.Count > 0)
        {
            removeButtons[0].Click();
            Wait.Until(d => true);
        }

        return Driver.FindElement(By.CssSelector("body")).Text;
    }

    public async Task ContinueShopping()
    {
        await ClickByCss("#continue-shopping");
        await AssertUrlContains("inventory");
    }

    public async Task GoToCheckout()
    {
        await ClickByCss("#checkout");
        await AssertUrlContains("checkout-step-one");
    }

    public Task<int> ClearCartAggressively()
    {
        for (var i = 0; i < 7; i++)
        {
            var removeButtons = Driver.FindElements(By.CssSelector("button.cart_button"));
            if (removeButtons.Count == 0)
            {
                break;
            }

            removeButtons[0].Click();
            Wait.Until(d => true);
        }

        return Task.FromResult(Driver.FindElements(By.CssSelector(".shopping_cart_badge")).Count);
    }
}
