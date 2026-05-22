namespace TaskTracker.Models
{
    public class TaskItem
    {
        public int Id { get; set; }
        public string Title { get; set; }
        public string? Description { get; set; }
        public TaskStatus Status { get; set; }
        public Priority Priority { get; set; }
        public DateTime? DueDate { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public int? ProjectId { get; set; }
        public int? AssignedToId { get; set; }
        public User? AssignedTo { get; set; }
        public List<Comment> Comments { get; set; } = new();
    }
}
