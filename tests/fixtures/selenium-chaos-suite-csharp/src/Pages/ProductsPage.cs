using OpenQA.Selenium;

namespace SeleniumChaosSuite.Pages;

public class ProductsPage : BasePage
{
    public ProductsPage(IWebDriver driver) : base(driver) { }

    public Task<string> GetPageTitle()
    {
        return GetTextByCss(".title");
    }

    public async Task SortLowToHigh()
    {
        await ClickByCss(".product_sort_container");
        var sort = Wait.Until(d => d.FindElement(By.CssSelector(".product_sort_container")));
        sort.SendKeys("lohi");
        Wait.Until(d => d.FindElements(By.CssSelector(".inventory_item")).Count > 0);
    }

    public async Task SortHighToLow()
    {
        await ClickByCss(".product_sort_container");
        var sort = Wait.Until(d => d.FindElement(By.CssSelector(".product_sort_container")));
        sort.SendKeys("hilo");
        Wait.Until(d => d.FindElements(By.CssSelector(".inventory_item")).Count > 0);
    }

    public async Task<string> AddBackpackToCart()
    {
        await ClickByCss("#add-to-cart-sauce-labs-backpack");
        return await GetTextByCss(".shopping_cart_badge");
    }

    public async Task<string> AddBikeLightToCart()
    {
        await ClickByCss("#add-to-cart-sauce-labs-bike-light");
        return await GetTextByCss(".shopping_cart_badge");
    }

    public async Task<(string badge, int count)> AddAllItemsOneByOne()
    {
        var addButtons = Driver.FindElements(By.CssSelector("button.btn_inventory"));
        foreach (var btn in addButtons)
        {
            btn.Click();
        }

        Wait.Until(d => d.FindElement(By.CssSelector(".shopping_cart_badge")).Displayed);
        var badge = await GetTextByCss(".shopping_cart_badge");
        return (badge, addButtons.Count);
    }

    public async Task OpenFirstItem()
    {
        await ClickByCss(".inventory_item_name");
    }

    public async Task<(string name, string description, string price)> GetItemDetails()
    {
        var name = await GetTextByCss(".inventory_details_name");
        var desc = await GetTextByCss(".inventory_details_desc");
        var price = await GetTextByCss(".inventory_details_price");
        return (name, desc, price);
    }

    public async Task AddBoltShirtToCart()
    {
        await ClickByCss("#add-to-cart-sauce-labs-bolt-t-shirt");
    }

    public async Task AddJacketToCart()
    {
        await ClickByCss("#add-to-cart-sauce-labs-fleece-jacket");
    }

    public async Task AddOnesieToCart()
    {
        await ClickByCss("#add-to-cart-sauce-labs-onesie");
    }

    public async Task AddRedShirtToCart()
    {
        await ClickByCss("#add-to-cart-test.allthethings()-t-shirt-(red)");
    }

    public async Task RemoveBackpackFromCart()
    {
        await ClickByCss("#remove-sauce-labs-backpack");
    }

    public async Task RemoveBikeLightFromCart()
    {
        await ClickByCss("#remove-sauce-labs-bike-light");
    }

    public Task SortBy(string value)
    {
        var sort = Wait.Until(d => d.FindElement(By.CssSelector(".product_sort_container")));
        sort.SendKeys(value);
        Wait.Until(d => d.FindElements(By.CssSelector(".inventory_item")).Count > 0);
        return Task.CompletedTask;
    }

    public Task OpenItemByIndex(int n)
    {
        var items = Driver.FindElements(By.CssSelector(".inventory_item_name"));
        if (n >= 0 && n < items.Count)
        {
            items[n].Click();
            Wait.Until(d => d.FindElement(By.CssSelector("body")).Displayed);
        }

        return Task.CompletedTask;
    }

    public async Task GoToCartFromHeader()
    {
        await ClickByCss(".shopping_cart_link");
        await AssertUrlContains("cart");
    }

    public Task<string> StressOpenAndBack(int rounds = 6)
    {
        for (var i = 0; i < rounds; i++)
        {
            var items = Driver.FindElements(By.CssSelector(".inventory_item_name"));
            if (items.Count == 0)
            {
                break;
            }

            items[0].Click();
            Wait.Until(d => d.FindElement(By.CssSelector("body")).Displayed);
            Driver.Navigate().Back();
            Wait.Until(d => d.FindElements(By.CssSelector(".inventory_item_name")).Count > 0);
        }

        return Task.FromResult(Driver.FindElement(By.CssSelector("body")).Text);
    }
}
