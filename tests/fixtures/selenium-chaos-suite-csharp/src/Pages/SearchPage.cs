using OpenQA.Selenium;

namespace SeleniumChaosSuite.Pages;

public class SearchPage : BasePage
{
    public SearchPage(IWebDriver driver) : base(driver) { }

    public Task<string> FakeSearchByTypingInAnyInput(string query)
    {
        var inputs = Driver.FindElements(By.CssSelector("input"));
        if (inputs.Count > 0)
        {
            inputs[0].Clear();
            inputs[0].SendKeys(query);
        }

        return Task.FromResult(Driver.FindElement(By.CssSelector("body")).Text);
    }

    public Task<string> GetBodyText()
    {
        return Task.FromResult(Driver.FindElement(By.CssSelector("body")).Text);
    }

    public async Task<List<string>> RepeatSearchNoise(IEnumerable<string> queries)
    {
        var results = new List<string>();
        foreach (var q in queries)
        {
            var body = await FakeSearchByTypingInAnyInput(q);
            results.Add(body);
        }

        return results;
    }
}
