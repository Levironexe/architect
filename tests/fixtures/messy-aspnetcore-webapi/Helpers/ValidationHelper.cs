using System.Text.RegularExpressions;

namespace TaskTracker.Helpers
{
    public class ValidationHelper
    {
        public bool IsValidEmail(string email)
        {
            if (string.IsNullOrWhiteSpace(email)) return false;
            var pattern = @"^[^@\s]+@[^@\s]+\.[^@\s]+$";
            return Regex.IsMatch(email, pattern);
        }

        public bool IsValidPassword(string password)
        {
            if (string.IsNullOrWhiteSpace(password)) return false;
            if (password.Length < 8) return false;
            if (!password.Any(char.IsUpper)) return false;
            if (!password.Any(char.IsDigit)) return false;
            return true;
        }

        public bool IsValidProjectName(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return false;
            if (name.Length > 100) return false;
            if (name.Length < 2) return false;
            return Regex.IsMatch(name, @"^[a-zA-Z0-9\s\-_]+$");
        }

        public bool IsValidTaskTitle(string title)
        {
            if (string.IsNullOrWhiteSpace(title)) return false;
            if (title.Length > 200) return false;
            if (title.Length < 3) return false;
            return true;
        }

        public bool IsValidDateRange(DateTime? start, DateTime? end)
        {
            if (!start.HasValue || !end.HasValue) return true;
            return end.Value >= start.Value;
        }

        public string SanitizeInput(string input)
        {
            if (string.IsNullOrEmpty(input)) return input;
            return input.Trim()
                .Replace("<", "&lt;")
                .Replace(">", "&gt;")
                .Replace("\"", "&quot;");
        }
    }
}
