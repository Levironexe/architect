namespace TaskTracker.Models
{
    public class Comment
    {
        public int Id { get; set; }
        public string Content { get; set; }
        public int TaskItemId { get; set; }
        public string? AuthorName { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
