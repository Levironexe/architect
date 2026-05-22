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
    public class ProjectsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly EmailService _emailService;

        public ProjectsController(AppDbContext context, EmailService emailService)
        {
            _context = context;
            _emailService = emailService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Project>>> GetProjects(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            if (page < 1) page = 1;
            if (pageSize < 1) pageSize = 20;
            if (pageSize > 100) pageSize = 100;

            var projects = await _context.Projects
                .Include(p => p.Tasks)
                .Include(p => p.Members)
                .OrderByDescending(p => p.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var totalCount = await _context.Projects.CountAsync();
            Response.Headers["X-Total-Count"] = totalCount.ToString();

            return projects;
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Project>> GetProject(int id)
        {
            var project = await _context.Projects
                .Include(p => p.Tasks)
                    .ThenInclude(t => t.AssignedTo)
                .Include(p => p.Tasks)
                    .ThenInclude(t => t.Comments)
                .Include(p => p.Members)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (project == null) return NotFound();
            return project;
        }

        [HttpPost]
        public async Task<ActionResult<Project>> CreateProject([FromBody] CreateProjectRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest("Name is required");

            if (request.Name.Length > 100)
                return BadRequest("Name must be 100 characters or less");

            var nameExists = await _context.Projects.AnyAsync(p => p.Name == request.Name);
            if (nameExists)
                return Conflict("A project with this name already exists");

            if (request.Deadline.HasValue && request.Deadline.Value < DateTime.UtcNow)
                return BadRequest("Deadline cannot be in the past");

            var project = new Project
            {
                Name = request.Name.Trim(),
                Description = request.Description?.Trim(),
                Deadline = request.Deadline,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                Status = "Active"
            };

            _context.Projects.Add(project);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetProject), new { id = project.Id }, project);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateProject(int id, [FromBody] CreateProjectRequest request)
        {
            var project = await _context.Projects.FindAsync(id);
            if (project == null) return NotFound();

            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest("Name is required");

            var nameExists = await _context.Projects
                .AnyAsync(p => p.Name == request.Name && p.Id != id);
            if (nameExists)
                return Conflict("A project with this name already exists");

            project.Name = request.Name.Trim();
            project.Description = request.Description?.Trim();
            project.Deadline = request.Deadline;
            project.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteProject(int id)
        {
            var project = await _context.Projects
                .Include(p => p.Tasks)
                    .ThenInclude(t => t.Comments)
                .Include(p => p.Members)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (project == null) return NotFound();

            if (project.Tasks.Any(t => t.Status == Models.TaskStatus.InProgress))
                return BadRequest("Cannot delete a project with in-progress tasks");

            foreach (var task in project.Tasks)
            {
                _context.Comments.RemoveRange(task.Comments);
            }
            _context.Tasks.RemoveRange(project.Tasks);
            _context.Projects.Remove(project);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpPost("{id}/members")]
        public async Task<IActionResult> AddMember(int id, [FromBody] int userId)
        {
            var project = await _context.Projects
                .Include(p => p.Members)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (project == null) return NotFound("Project not found");

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("User not found");

            if (project.Members.Any(m => m.Id == userId))
                return Conflict("User is already a member");

            project.Members.Add(user);
            project.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _emailService.SendNotification(
                user.Email,
                "Added to Project",
                $"You have been added to project: {project.Name}");

            return Ok(new { message = "Member added", projectId = id, userId });
        }

        [HttpDelete("{id}/members/{userId}")]
        public async Task<IActionResult> RemoveMember(int id, int userId)
        {
            var project = await _context.Projects
                .Include(p => p.Members)
                .Include(p => p.Tasks)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (project == null) return NotFound("Project not found");

            var member = project.Members.FirstOrDefault(m => m.Id == userId);
            if (member == null) return NotFound("User is not a member");

            var assignedTasks = project.Tasks
                .Where(t => t.AssignedToId == userId && t.Status != Models.TaskStatus.Completed)
                .ToList();

            if (assignedTasks.Any())
            {
                foreach (var task in assignedTasks)
                {
                    task.AssignedToId = null;
                    task.AssignedTo = null;
                    task.UpdatedAt = DateTime.UtcNow;
                }
            }

            project.Members.Remove(member);
            project.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Member removed", unassignedTasks = assignedTasks.Count });
        }

        [HttpGet("{id}/stats")]
        public async Task<ActionResult<object>> GetProjectStats(int id)
        {
            var project = await _context.Projects
                .Include(p => p.Tasks)
                .Include(p => p.Members)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (project == null) return NotFound();

            var totalTasks = project.Tasks.Count;
            var completedTasks = project.Tasks.Count(t => t.Status == Models.TaskStatus.Completed);
            var inProgressTasks = project.Tasks.Count(t => t.Status == Models.TaskStatus.InProgress);
            var overdueTasks = project.Tasks.Count(t =>
                t.DueDate.HasValue
                && t.DueDate.Value < DateTime.UtcNow
                && t.Status != Models.TaskStatus.Completed);
            var unassignedTasks = project.Tasks.Count(t => t.AssignedToId == null);

            var completionPercentage = totalTasks > 0
                ? Math.Round((double)completedTasks / totalTasks * 100, 1)
                : 0;

            var daysUntilDeadline = project.Deadline.HasValue
                ? (project.Deadline.Value - DateTime.UtcNow).Days
                : (int?)null;

            var tasksByPriority = project.Tasks
                .GroupBy(t => t.Priority)
                .Select(g => new { Priority = g.Key.ToString(), Count = g.Count() })
                .ToList();

            var memberWorkload = project.Members.Select(m => new
            {
                UserId = m.Id,
                UserName = m.Name,
                ActiveTasks = project.Tasks.Count(t =>
                    t.AssignedToId == m.Id && t.Status != Models.TaskStatus.Completed),
                CompletedTasks = project.Tasks.Count(t =>
                    t.AssignedToId == m.Id && t.Status == Models.TaskStatus.Completed)
            }).ToList();

            return new
            {
                projectId = id,
                projectName = project.Name,
                totalTasks,
                completedTasks,
                inProgressTasks,
                overdueTasks,
                unassignedTasks,
                completionPercentage,
                daysUntilDeadline,
                memberCount = project.Members.Count,
                tasksByPriority,
                memberWorkload
            };
        }

        [HttpGet("{id}/deadline-check")]
        public async Task<ActionResult<object>> CheckDeadline(int id)
        {
            var project = await _context.Projects
                .Include(p => p.Tasks)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (project == null) return NotFound();

            if (!project.Deadline.HasValue)
                return Ok(new { hasDeadline = false });

            var daysRemaining = (project.Deadline.Value - DateTime.UtcNow).Days;
            var incompleteTasks = project.Tasks.Count(t => t.Status != Models.TaskStatus.Completed);
            var isAtRisk = daysRemaining < 7 && incompleteTasks > 0;
            var isOverdue = daysRemaining < 0;

            return Ok(new
            {
                hasDeadline = true,
                deadline = project.Deadline.Value,
                daysRemaining,
                incompleteTasks,
                isAtRisk,
                isOverdue,
                recommendation = isOverdue
                    ? "Project is past deadline. Consider extending or reducing scope."
                    : isAtRisk
                        ? $"Only {daysRemaining} days left with {incompleteTasks} incomplete tasks."
                        : "On track"
            });
        }

        [HttpPost("{id}/archive")]
        public async Task<IActionResult> ArchiveProject(int id)
        {
            var project = await _context.Projects
                .Include(p => p.Tasks)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (project == null) return NotFound();

            if (project.Tasks.Any(t => t.Status == Models.TaskStatus.InProgress || t.Status == Models.TaskStatus.InReview))
                return BadRequest("Cannot archive a project with active tasks");

            project.Status = "Archived";
            project.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Project archived", projectId = id });
        }

        [HttpGet("search")]
        public async Task<ActionResult<IEnumerable<Project>>> SearchProjects([FromQuery] string q)
        {
            if (string.IsNullOrWhiteSpace(q))
                return BadRequest("Search query is required");

            var queryLower = q.ToLower();

            var results = await _context.Projects
                .Include(p => p.Tasks)
                .Where(p =>
                    p.Name.ToLower().Contains(queryLower) ||
                    (p.Description != null && p.Description.ToLower().Contains(queryLower)))
                .OrderByDescending(p => p.UpdatedAt)
                .Take(20)
                .ToListAsync();

            return results;
        }

        [HttpGet("active")]
        public async Task<ActionResult<IEnumerable<Project>>> GetActiveProjects()
        {
            return await _context.Projects
                .Include(p => p.Tasks)
                .Include(p => p.Members)
                .Where(p => p.Status == "Active")
                .OrderByDescending(p => p.UpdatedAt)
                .ToListAsync();
        }

        [HttpGet("{id}/timeline")]
        public async Task<ActionResult<IEnumerable<object>>> GetProjectTimeline(int id)
        {
            var project = await _context.Projects
                .Include(p => p.Tasks)
                    .ThenInclude(t => t.Comments)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (project == null) return NotFound();

            var events = new List<object>();

            events.Add(new
            {
                type = "project_created",
                date = project.CreatedAt,
                description = $"Project '{project.Name}' was created"
            });

            foreach (var task in project.Tasks.OrderBy(t => t.CreatedAt))
            {
                events.Add(new
                {
                    type = "task_created",
                    date = task.CreatedAt,
                    description = $"Task '{task.Title}' was created",
                    taskId = task.Id
                });

                if (task.CompletedAt.HasValue)
                {
                    events.Add(new
                    {
                        type = "task_completed",
                        date = task.CompletedAt.Value,
                        description = $"Task '{task.Title}' was completed",
                        taskId = task.Id
                    });
                }

                foreach (var comment in task.Comments.OrderBy(c => c.CreatedAt))
                {
                    events.Add(new
                    {
                        type = "comment_added",
                        date = comment.CreatedAt,
                        description = $"Comment added on '{task.Title}' by {comment.AuthorName ?? "Unknown"}",
                        taskId = task.Id,
                        commentId = comment.Id
                    });
                }
            }

            return events.OrderByDescending(e => ((dynamic)e).date).ToList();
        }

        [HttpPost("{id}/duplicate")]
        public async Task<ActionResult<Project>> DuplicateProject(int id)
        {
            var original = await _context.Projects
                .Include(p => p.Tasks)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (original == null) return NotFound();

            var duplicate = new Project
            {
                Name = $"Copy of {original.Name}",
                Description = original.Description,
                Deadline = original.Deadline,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                Status = "Active"
            };

            _context.Projects.Add(duplicate);
            await _context.SaveChangesAsync();

            foreach (var task in original.Tasks)
            {
                var taskCopy = new TaskItem
                {
                    Title = task.Title,
                    Description = task.Description,
                    Status = Models.TaskStatus.New,
                    Priority = task.Priority,
                    ProjectId = duplicate.Id,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.Tasks.Add(taskCopy);
            }

            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetProject), new { id = duplicate.Id }, duplicate);
        }
    }
}
