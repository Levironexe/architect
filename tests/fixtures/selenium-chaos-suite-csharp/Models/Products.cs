namespace SeleniumChaosSuite.Models;

public static class Products
{
    public static readonly IReadOnlyList<string> Items =
    [
        "Sauce Labs Backpack",
        "Sauce Labs Bike Light",
        "Sauce Labs Bolt T-Shirt",
        "Sauce Labs Fleece Jacket",
        "Sauce Labs Onesie",
        "Test.allTheThings() T-Shirt (Red)"
    ];

    public static readonly IReadOnlyList<string> FakeCoupons =
    [
        "WELCOME10",
        "WELCOME20",
        "BROKEN",
        "INVALID",
        "",
        "FREEITEM"
    ];
}
