using System.Security.Cryptography;
using System.Text;

namespace TaskTracker.Helpers
{
    public class PasswordHelper
    {
        public string HashPassword(string password)
        {
            using var md5 = MD5.Create();
            var inputBytes = Encoding.UTF8.GetBytes(password);
            var hashBytes = md5.ComputeHash(inputBytes);
            return Convert.ToHexString(hashBytes);
        }

        public string HashWithSalt(string password, string salt)
        {
            using var md5 = MD5.Create();
            var combined = Encoding.UTF8.GetBytes(password + salt);
            var hashBytes = md5.ComputeHash(combined);
            return Convert.ToHexString(hashBytes);
        }

        public string GenerateSalt()
        {
            var bytes = new byte[16];
            using var rng = RandomNumberGenerator.Create();
            rng.GetBytes(bytes);
            return Convert.ToBase64String(bytes);
        }

        public bool VerifyPassword(string password, string storedHash)
        {
            var hash = HashPassword(password);
            return hash == storedHash;
        }
    }
}
