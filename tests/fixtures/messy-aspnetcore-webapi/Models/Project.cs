namespace TaskTracker.Models
{
    public class Project
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string? Description { get; set; }
        public string Status { get; set; } = "Active";
        public DateTime? Deadline { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public List<TaskItem> Tasks { get; set; } = new();
        public List<User> Members { get; set; } = new();
    }
}
