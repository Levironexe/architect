using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskTracker.Data;
using TaskTracker.Models;
using TaskTracker.DTOs;
using TaskTracker.Helpers;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;

namespace TaskTracker.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TasksController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly EmailService _emailService;

        public TasksController(AppDbContext context, EmailService emailService)
        {
            _context = context;
            _emailService = emailService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<TaskItem>>> GetTasks(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            if (page < 1) page = 1;
            if (pageSize < 1) pageSize = 20;
            if (pageSize > 100) pageSize = 100;

            var tasks = await _context.Tasks
                .Include(t => t.Comments)
                .Include(t => t.AssignedTo)
                .OrderByDescending(t => t.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var totalCount = await _context.Tasks.CountAsync();
            Response.Headers["X-Total-Count"] = totalCount.ToString();
            Response.Headers["X-Page"] = page.ToString();
            Response.Headers["X-Page-Size"] = pageSize.ToString();

            return tasks;
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<TaskItem>> GetTask(int id)
        {
            var task = await _context.Tasks
                .Include(t => t.Comments)
                .Include(t => t.AssignedTo)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (task == null) return NotFound();
            return task;
        }

        [HttpPost]
        public async Task<ActionResult<TaskItem>> CreateTask([FromBody] CreateTaskRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Title))
                return BadRequest("Title is required");

            if (request.Title.Length > 200)
                return BadRequest("Title must be 200 characters or less");

            if (request.Description != null && request.Description.Length > 5000)
                return BadRequest("Description must be 5000 characters or less");

            if (request.DueDate.HasValue && request.DueDate.Value < DateTime.UtcNow)
                return BadRequest("Due date cannot be in the past");

            if (request.ProjectId.HasValue)
            {
                var projectExists = await _context.Projects.AnyAsync(p => p.Id == request.ProjectId.Value);
                if (!projectExists)
                    return BadRequest("Project does not exist");
            }

            var task = new TaskItem
            {
                Title = request.Title.Trim(),
                Description = request.Description?.Trim(),
                Status = Models.TaskStatus.New,
                Priority = request.Priority,
                DueDate = request.DueDate,
                ProjectId = request.ProjectId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Tasks.Add(task);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetTask), new { id = task.Id }, task);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTask(int id, [FromBody] UpdateTaskRequest request)
        {
            var task = await _context.Tasks.FindAsync(id);
            if (task == null) return NotFound();

            if (string.IsNullOrWhiteSpace(request.Title))
                return BadRequest("Title is required");

            if (request.Title.Length > 200)
                return BadRequest("Title must be 200 characters or less");

            var oldStatus = task.Status;
            task.Title = request.Title.Trim();
            task.Description = request.Description?.Trim();
            task.Status = request.Status;
            task.Priority = request.Priority;
            task.DueDate = request.DueDate;
            task.UpdatedAt = DateTime.UtcNow;

            if (oldStatus != request.Status && request.Status == Models.TaskStatus.Completed)
            {
                task.CompletedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTask(int id)
        {
            var task = await _context.Tasks
                .Include(t => t.Comments)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (task == null) return NotFound();

            _context.Comments.RemoveRange(task.Comments);
            _context.Tasks.Remove(task);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpPost("{id}/assign")]
        public async Task<IActionResult> AssignTask(int id, [FromBody] int userId)
        {
            var task = await _context.Tasks.FindAsync(id);
            if (task == null) return NotFound("Task not found");

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("User not found");

            if (task.Status == Models.TaskStatus.Completed)
                return BadRequest("Cannot assign a completed task");

            var existingAssignments = await _context.Tasks
                .Where(t => t.AssignedToId == userId && t.Status != Models.TaskStatus.Completed)
                .CountAsync();

            if (existingAssignments >= 10)
                return BadRequest("User already has 10 active tasks assigned");

            task.AssignedTo = user;
            task.AssignedToId = userId;
            task.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _emailService.SendNotification(
                user.Email,
                "Task Assigned",
                $"You have been assigned to task: {task.Title}");

            return Ok(new { message = "Task assigned", taskId = id, userId });
        }

        [HttpPost("{id}/unassign")]
        public async Task<IActionResult> UnassignTask(int id)
        {
            var task = await _context.Tasks.FindAsync(id);
            if (task == null) return NotFound();

            task.AssignedTo = null;
            task.AssignedToId = null;
            task.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Task unassigned" });
        }

        [HttpPost("{id}/comments")]
        public async Task<IActionResult> AddComment(int id, [FromBody] string content)
        {
            if (string.IsNullOrWhiteSpace(content))
                return BadRequest("Comment content is required");

            if (content.Length > 2000)
                return BadRequest("Comment must be 2000 characters or less");

            var task = await _context.Tasks
                .Include(t => t.Comments)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (task == null) return NotFound();

            var comment = new Comment
            {
                Content = content.Trim(),
                TaskItemId = id,
                CreatedAt = DateTime.UtcNow,
                AuthorName = "System"
            };

            task.Comments.Add(comment);
            task.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { commentId = comment.Id, content = comment.Content });
        }

        [HttpGet("{id}/comments")]
        public async Task<ActionResult<IEnumerable<Comment>>> GetComments(int id)
        {
            var task = await _context.Tasks
                .Include(t => t.Comments)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (task == null) return NotFound();

            return task.Comments.OrderByDescending(c => c.CreatedAt).ToList();
        }

        [HttpDelete("{taskId}/comments/{commentId}")]
        public async Task<IActionResult> DeleteComment(int taskId, int commentId)
        {
            var comment = await _context.Comments
                .FirstOrDefaultAsync(c => c.Id == commentId && c.TaskItemId == taskId);

            if (comment == null) return NotFound();

            _context.Comments.Remove(comment);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpPost("{id}/status")]
        public async Task<IActionResult> ChangeStatus(int id, [FromBody] Models.TaskStatus newStatus)
        {
            var task = await _context.Tasks
                .Include(t => t.AssignedTo)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (task == null) return NotFound();

            var currentStatus = task.Status;

            if (currentStatus == Models.TaskStatus.Completed && newStatus != Models.TaskStatus.Reopened)
                return BadRequest("Completed tasks can only be reopened");

            if (newStatus == Models.TaskStatus.InProgress && task.AssignedTo == null)
                return BadRequest("Task must be assigned before moving to in-progress");

            if (newStatus == Models.TaskStatus.InReview && currentStatus != Models.TaskStatus.InProgress)
                return BadRequest("Only in-progress tasks can be moved to review");

            if (newStatus == Models.TaskStatus.Completed && currentStatus != Models.TaskStatus.InReview)
                return BadRequest("Only reviewed tasks can be completed");

            task.Status = newStatus;
            task.UpdatedAt = DateTime.UtcNow;

            if (newStatus == Models.TaskStatus.Completed)
                task.CompletedAt = DateTime.UtcNow;

            if (newStatus == Models.TaskStatus.Reopened)
            {
                task.CompletedAt = null;
                task.Status = Models.TaskStatus.New;
            }

            await _context.SaveChangesAsync();

            if (task.AssignedTo != null)
            {
                _emailService.SendNotification(
                    task.AssignedTo.Email,
                    "Task Status Changed",
                    $"Task '{task.Title}' status changed from {currentStatus} to {newStatus}");
            }

            return Ok(new { taskId = id, oldStatus = currentStatus.ToString(), newStatusValue = task.Status.ToString() });
        }

        [HttpGet("filter")]
        public async Task<ActionResult<IEnumerable<TaskItem>>> FilterTasks(
            [FromQuery] Models.TaskStatus? status,
            [FromQuery] Priority? priority,
            [FromQuery] int? assignedToId,
            [FromQuery] int? projectId,
            [FromQuery] DateTime? dueBefore,
            [FromQuery] DateTime? dueAfter,
            [FromQuery] string? search)
        {
            var query = _context.Tasks
                .Include(t => t.AssignedTo)
                .Include(t => t.Comments)
                .AsQueryable();

            if (status.HasValue)
                query = query.Where(t => t.Status == status.Value);

            if (priority.HasValue)
                query = query.Where(t => t.Priority == priority.Value);

            if (assignedToId.HasValue)
                query = query.Where(t => t.AssignedToId == assignedToId.Value);

            if (projectId.HasValue)
                query = query.Where(t => t.ProjectId == projectId.Value);

            if (dueBefore.HasValue)
                query = query.Where(t => t.DueDate.HasValue && t.DueDate.Value <= dueBefore.Value);

            if (dueAfter.HasValue)
                query = query.Where(t => t.DueDate.HasValue && t.DueDate.Value >= dueAfter.Value);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var searchLower = search.ToLower();
                query = query.Where(t =>
                    t.Title.ToLower().Contains(searchLower) ||
                    (t.Description != null && t.Description.ToLower().Contains(searchLower)));
            }

            return await query.OrderByDescending(t => t.UpdatedAt).ToListAsync();
        }

        [HttpGet("sort")]
        public async Task<ActionResult<IEnumerable<TaskItem>>> SortTasks(
            [FromQuery] string by = "id",
            [FromQuery] string direction = "asc")
        {
            var query = _context.Tasks
                .Include(t => t.AssignedTo)
                .AsQueryable();

            var isDesc = direction.ToLower() == "desc";

            query = by.ToLower() switch
            {
                "due" => isDesc ? query.OrderByDescending(t => t.DueDate) : query.OrderBy(t => t.DueDate),
                "priority" => isDesc ? query.OrderByDescending(t => t.Priority) : query.OrderBy(t => t.Priority),
                "status" => isDesc ? query.OrderByDescending(t => t.Status) : query.OrderBy(t => t.Status),
                "title" => isDesc ? query.OrderByDescending(t => t.Title) : query.OrderBy(t => t.Title),
                "created" => isDesc ? query.OrderByDescending(t => t.CreatedAt) : query.OrderBy(t => t.CreatedAt),
                "updated" => isDesc ? query.OrderByDescending(t => t.UpdatedAt) : query.OrderBy(t => t.UpdatedAt),
                _ => isDesc ? query.OrderByDescending(t => t.Id) : query.OrderBy(t => t.Id)
            };

            return await query.ToListAsync();
        }

        [HttpGet("overdue")]
        public async Task<ActionResult<IEnumerable<TaskItem>>> GetOverdueTasks()
        {
            var now = DateTime.UtcNow;
            var overdue = await _context.Tasks
                .Include(t => t.AssignedTo)
                .Where(t => t.DueDate.HasValue
                    && t.DueDate.Value < now
                    && t.Status != Models.TaskStatus.Completed)
                .OrderBy(t => t.DueDate)
                .ToListAsync();

            return overdue;
        }

        [HttpGet("stats")]
        public async Task<ActionResult<object>> GetTaskStats()
        {
            var total = await _context.Tasks.CountAsync();
            var byStatus = await _context.Tasks
                .GroupBy(t => t.Status)
                .Select(g => new { Status = g.Key.ToString(), Count = g.Count() })
                .ToListAsync();

            var byPriority = await _context.Tasks
                .GroupBy(t => t.Priority)
                .Select(g => new { Priority = g.Key.ToString(), Count = g.Count() })
                .ToListAsync();

            var overdue = await _context.Tasks
                .CountAsync(t => t.DueDate.HasValue
                    && t.DueDate.Value < DateTime.UtcNow
                    && t.Status != Models.TaskStatus.Completed);

            var unassigned = await _context.Tasks
                .CountAsync(t => t.AssignedToId == null && t.Status != Models.TaskStatus.Completed);

            var avgCompletionDays = await _context.Tasks
                .Where(t => t.CompletedAt.HasValue && t.CreatedAt != default)
                .Select(t => EF.Functions.DateDiffDay(t.CreatedAt, t.CompletedAt.Value))
                .DefaultIfEmpty(0)
                .AverageAsync();

            return new
            {
                total,
                byStatus,
                byPriority,
                overdue,
                unassigned,
                avgCompletionDays = Math.Round(avgCompletionDays, 1)
            };
        }

        [HttpPost("bulk-assign")]
        public async Task<IActionResult> BulkAssign([FromBody] BulkAssignRequest request)
        {
            if (request.TaskIds == null || request.TaskIds.Count == 0)
                return BadRequest("No tasks specified");

            var user = await _context.Users.FindAsync(request.UserId);
            if (user == null) return NotFound("User not found");

            var tasks = await _context.Tasks
                .Where(t => request.TaskIds.Contains(t.Id))
                .ToListAsync();

            if (tasks.Count != request.TaskIds.Count)
                return BadRequest("Some tasks were not found");

            foreach (var task in tasks)
            {
                if (task.Status == Models.TaskStatus.Completed)
                    continue;

                task.AssignedToId = request.UserId;
                task.AssignedTo = user;
                task.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            return Ok(new { assigned = tasks.Count(t => t.AssignedToId == request.UserId) });
        }

        [HttpPost("bulk-status")]
        public async Task<IActionResult> BulkStatusChange(
            [FromBody] List<int> taskIds,
            [FromQuery] Models.TaskStatus newStatus)
        {
            if (taskIds == null || taskIds.Count == 0)
                return BadRequest("No tasks specified");

            var tasks = await _context.Tasks
                .Where(t => taskIds.Contains(t.Id))
                .ToListAsync();

            var updated = 0;
            foreach (var task in tasks)
            {
                task.Status = newStatus;
                task.UpdatedAt = DateTime.UtcNow;
                if (newStatus == Models.TaskStatus.Completed)
                    task.CompletedAt = DateTime.UtcNow;
                updated++;
            }

            await _context.SaveChangesAsync();

            return Ok(new { updated });
        }

        [HttpGet("search")]
        public async Task<ActionResult<IEnumerable<TaskItem>>> SearchTasks([FromQuery] string q)
        {
            if (string.IsNullOrWhiteSpace(q))
                return BadRequest("Search query is required");

            var queryLower = q.ToLower();

            var results = await _context.Tasks
                .Include(t => t.Comments)
                .Include(t => t.AssignedTo)
                .Where(t =>
                    t.Title.ToLower().Contains(queryLower) ||
                    (t.Description != null && t.Description.ToLower().Contains(queryLower)) ||
                    t.Comments.Any(c => c.Content.ToLower().Contains(queryLower)))
                .OrderByDescending(t => t.UpdatedAt)
                .Take(50)
                .ToListAsync();

            return results;
        }

        [HttpPost("{id}/duplicate")]
        public async Task<ActionResult<TaskItem>> DuplicateTask(int id)
        {
            var original = await _context.Tasks
                .Include(t => t.Comments)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (original == null) return NotFound();

            var duplicate = new TaskItem
            {
                Title = $"Copy of {original.Title}",
                Description = original.Description,
                Status = Models.TaskStatus.New,
                Priority = original.Priority,
                DueDate = original.DueDate,
                ProjectId = original.ProjectId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Tasks.Add(duplicate);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetTask), new { id = duplicate.Id }, duplicate);
        }
    }

    public class BulkAssignRequest
    {
        public List<int> TaskIds { get; set; }
        public int UserId { get; set; }
    }
}
