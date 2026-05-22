namespace TaskTracker.Models
{
    public class User
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }
        public string PasswordHash { get; set; }
        public string? Role { get; set; }
        public bool IsActive { get; set; } = true;
        public bool IsLocked { get; set; }
        public int FailedLoginAttempts { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public DateTime? LastLoginAt { get; set; }
        public DateTime? LockedAt { get; set; }
        public List<Project> Projects { get; set; } = new();
    }
}
