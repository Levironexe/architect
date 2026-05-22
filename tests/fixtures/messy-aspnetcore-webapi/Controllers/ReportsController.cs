using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskTracker.Data;
using TaskTracker.Models;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;

namespace TaskTracker.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ReportsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ReportsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("projects")]
        public async Task<ActionResult<IEnumerable<Project>>> GetProjectReport()
        {
            return await _context.Projects
                .Include(p => p.Tasks)
                .Include(p => p.Members)
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();
        }

        [HttpGet("users")]
        public async Task<ActionResult<IEnumerable<User>>> GetUserReport()
        {
            return await _context.Users
                .OrderBy(u => u.Name)
                .ToListAsync();
        }

        [HttpGet("overdue")]
        public async Task<ActionResult<IEnumerable<TaskItem>>> GetOverdueReport()
        {
            return await _context.Tasks
                .Include(t => t.AssignedTo)
                .Where(t => t.DueDate.HasValue
                    && t.DueDate.Value < DateTime.UtcNow
                    && t.Status != Models.TaskStatus.Completed)
                .OrderBy(t => t.DueDate)
                .ToListAsync();
        }

        [HttpGet("summary")]
        public async Task<ActionResult<object>> GetSummaryReport()
        {
            var totalProjects = await _context.Projects.CountAsync();
            var activeProjects = await _context.Projects.CountAsync(p => p.Status == "Active");
            var totalTasks = await _context.Tasks.CountAsync();
            var completedTasks = await _context.Tasks.CountAsync(t => t.Status == Models.TaskStatus.Completed);
            var overdueTasks = await _context.Tasks.CountAsync(t =>
                t.DueDate.HasValue
                && t.DueDate.Value < DateTime.UtcNow
                && t.Status != Models.TaskStatus.Completed);
            var totalUsers = await _context.Users.CountAsync();
            var activeUsers = await _context.Users.CountAsync(u => u.IsActive);

            var recentActivity = await _context.Tasks
                .OrderByDescending(t => t.UpdatedAt)
                .Take(10)
                .Select(t => new
                {
                    t.Id,
                    t.Title,
                    Status = t.Status.ToString(),
                    t.UpdatedAt
                })
                .ToListAsync();

            return new
            {
                projects = new { total = totalProjects, active = activeProjects },
                tasks = new
                {
                    total = totalTasks,
                    completed = completedTasks,
                    overdue = overdueTasks,
                    completionRate = totalTasks > 0
                        ? Math.Round((double)completedTasks / totalTasks * 100, 1)
                        : 0
                },
                users = new { total = totalUsers, active = activeUsers },
                recentActivity
            };
        }

        [HttpGet("workload")]
        public async Task<ActionResult<IEnumerable<object>>> GetWorkloadReport()
        {
            var users = await _context.Users
                .Where(u => u.IsActive)
                .ToListAsync();

            var report = new List<object>();
            foreach (var user in users)
            {
                var activeTasks = await _context.Tasks
                    .CountAsync(t => t.AssignedToId == user.Id && t.Status != Models.TaskStatus.Completed);
                var completedThisWeek = await _context.Tasks
                    .CountAsync(t => t.AssignedToId == user.Id
                        && t.Status == Models.TaskStatus.Completed
                        && t.CompletedAt.HasValue
                        && t.CompletedAt.Value >= DateTime.UtcNow.AddDays(-7));

                report.Add(new
                {
                    userId = user.Id,
                    userName = user.Name,
                    activeTasks,
                    completedThisWeek,
                    workloadLevel = activeTasks > 8 ? "overloaded"
                        : activeTasks > 5 ? "heavy"
                        : activeTasks > 2 ? "moderate"
                        : "light"
                });
            }

            return report.OrderByDescending(r => ((dynamic)r).activeTasks).ToList();
        }
    }
}
