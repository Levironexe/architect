using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskTracker.Data;
using TaskTracker.Models;
using TaskTracker.Helpers;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;

namespace TaskTracker.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly PasswordHelper _passwordHelper;

        public UsersController(AppDbContext context, PasswordHelper passwordHelper)
        {
            _context = context;
            _passwordHelper = passwordHelper;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<User>>> GetUsers(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            if (page < 1) page = 1;
            if (pageSize > 100) pageSize = 100;

            var users = await _context.Users
                .OrderBy(u => u.Name)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return users;
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<User>> GetUser(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound();
            return user;
        }

        [HttpPost]
        public async Task<ActionResult<User>> CreateUser([FromBody] User user)
        {
            if (string.IsNullOrWhiteSpace(user.Name))
                return BadRequest("Name is required");

            if (string.IsNullOrWhiteSpace(user.Email))
                return BadRequest("Email is required");

            var emailExists = await _context.Users.AnyAsync(u => u.Email == user.Email);
            if (emailExists)
                return Conflict("Email already in use");

            user.Email = user.Email.Trim().ToLower();
            user.Name = user.Name.Trim();
            user.CreatedAt = DateTime.UtcNow;
            user.IsActive = true;

            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetUser), new { id = user.Id }, user);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateUser(int id, [FromBody] User user)
        {
            var existing = await _context.Users.FindAsync(id);
            if (existing == null) return NotFound();

            if (string.IsNullOrWhiteSpace(user.Name))
                return BadRequest("Name is required");

            if (user.Email != existing.Email)
            {
                var emailExists = await _context.Users.AnyAsync(u => u.Email == user.Email && u.Id != id);
                if (emailExists)
                    return Conflict("Email already in use");
            }

            existing.Name = user.Name.Trim();
            existing.Email = user.Email.Trim().ToLower();
            existing.Role = user.Role;
            existing.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound();

            var activeTasks = await _context.Tasks
                .CountAsync(t => t.AssignedToId == id && t.Status != Models.TaskStatus.Completed);

            if (activeTasks > 0)
                return BadRequest($"User has {activeTasks} active tasks. Reassign them first.");

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpGet("{id}/tasks")]
        public async Task<ActionResult<IEnumerable<TaskItem>>> GetUserTasks(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound();

            var tasks = await _context.Tasks
                .Include(t => t.Comments)
                .Where(t => t.AssignedToId == id)
                .OrderByDescending(t => t.UpdatedAt)
                .ToListAsync();

            return tasks;
        }

        [HttpGet("{id}/stats")]
        public async Task<ActionResult<object>> GetUserStats(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound();

            var totalAssigned = await _context.Tasks.CountAsync(t => t.AssignedToId == id);
            var completed = await _context.Tasks.CountAsync(t =>
                t.AssignedToId == id && t.Status == Models.TaskStatus.Completed);
            var inProgress = await _context.Tasks.CountAsync(t =>
                t.AssignedToId == id && t.Status == Models.TaskStatus.InProgress);
            var overdue = await _context.Tasks.CountAsync(t =>
                t.AssignedToId == id
                && t.DueDate.HasValue
                && t.DueDate.Value < DateTime.UtcNow
                && t.Status != Models.TaskStatus.Completed);

            return new
            {
                userId = id,
                userName = user.Name,
                totalAssigned,
                completed,
                inProgress,
                overdue,
                completionRate = totalAssigned > 0
                    ? Math.Round((double)completed / totalAssigned * 100, 1)
                    : 0
            };
        }

        [HttpPost("{id}/deactivate")]
        public async Task<IActionResult> DeactivateUser(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound();

            user.IsActive = false;
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "User deactivated" });
        }

        [HttpGet("search")]
        public async Task<ActionResult<IEnumerable<User>>> SearchUsers([FromQuery] string q)
        {
            if (string.IsNullOrWhiteSpace(q))
                return BadRequest("Search query required");

            var queryLower = q.ToLower();
            var results = await _context.Users
                .Where(u =>
                    u.Name.ToLower().Contains(queryLower) ||
                    u.Email.ToLower().Contains(queryLower))
                .OrderBy(u => u.Name)
                .Take(20)
                .ToListAsync();

            return results;
        }
    }
}
