namespace TaskTracker.DTOs
{
    public class UpdateTaskRequest
    {
        public string Title { get; set; }
        public string Description { get; set; }
        public TaskTracker.Models.TaskStatus Status { get; set; }
        public TaskTracker.Models.Priority Priority { get; set; }
        public System.DateTime DueDate { get; set; }
    }
}
