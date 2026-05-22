namespace SeleniumChaosSuite.Models;

public sealed class User
{
    public required string Username { get; init; }
    public required string Password { get; init; }
    public required string Role { get; init; }
    public required string FirstName { get; init; }
    public required string LastName { get; init; }
    public required string Zip { get; init; }
}

public static class Users
{
    public static readonly User Standard = new()
    {
        Username = "standard_user",
        Password = "secret_sauce",
        Role = "user",
        FirstName = "Standard",
        LastName = "User",
        Zip = "10001"
    };

    public static readonly User Locked = new()
    {
        Username = "locked_out_user",
        Password = "secret_sauce",
        Role = "user",
        FirstName = "Locked",
        LastName = "Out",
        Zip = "20002"
    };

    public static readonly User Problem = new()
    {
        Username = "problem_user",
        Password = "secret_sauce",
        Role = "user",
        FirstName = "Problem",
        LastName = "User",
        Zip = "30003"
    };

    public static readonly User Admin = new()
    {
        Username = "admin_user_does_not_exist",
        Password = "secret_sauce",
        Role = "admin",
        FirstName = "Admin",
        LastName = "Fake",
        Zip = "40004"
    };
}
