using NUnit.Framework;

namespace SeleniumChaosSuite.Utilities;

public static class AssertionHelper
{
    public static void ShouldContain(string actual, string expected, string note = "")
    {
        Assert.That(actual, Does.Contain(expected), note);
    }

    public static void ShouldEqual(object? actual, object? expected, string note = "")
    {
        Assert.That(actual, Is.EqualTo(expected), note);
    }

    public static void ShouldBeGreaterThan(double actual, double expected, string note = "")
    {
        Assert.That(actual, Is.GreaterThan(expected), note);
    }

    public static void ShouldBeTruthy(bool actual, string note = "")
    {
        Assert.That(actual, Is.True, note);
    }
}
