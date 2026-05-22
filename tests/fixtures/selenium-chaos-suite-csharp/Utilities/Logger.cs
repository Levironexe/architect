namespace SeleniumChaosSuite.Utilities;

public static class Logger
{
    public static void Info(string message, object? payload = null)
    {
        Console.WriteLine($"[INFO] {DateTime.UtcNow:O} - {message} {payload ?? string.Empty}");
    }

    public static void Warn(string message, object? payload = null)
    {
        Console.WriteLine($"[WARN] {DateTime.UtcNow:O} - {message} {payload ?? string.Empty}");
    }

    public static void Error(string message, object? payload = null)
    {
        Console.WriteLine($"[ERROR] {DateTime.UtcNow:O} - {message} {payload ?? string.Empty}");
    }
}
