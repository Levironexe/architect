using TaskTracker.Models;
using TaskTracker.Helpers;

namespace TaskTracker.Data
{
    public static class SeedData
    {
        public static void Initialize(AppDbContext context)
        {
            if (context.Users.Any()) return;

            var passwordHelper = new PasswordHelper();

            var admin = new User
            {
                Name = "Admin User",
                Email = "admin@tasktracker.local",
                PasswordHash = passwordHelper.HashPassword("admin123"),
                Role = "Admin",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            var dev1 = new User
            {
                Name = "Alice Developer",
                Email = "alice@tasktracker.local",
                PasswordHash = passwordHelper.HashPassword("password123"),
                Role = "Developer",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            var dev2 = new User
            {
                Name = "Bob Engineer",
                Email = "bob@tasktracker.local",
                PasswordHash = passwordHelper.HashPassword("password123"),
                Role = "Developer",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            context.Users.AddRange(admin, dev1, dev2);
            context.SaveChanges();

            var projectAlpha = new Project
            {
                Name = "Project Alpha",
                Description = "Main product backend API",
                Deadline = DateTime.UtcNow.AddDays(30),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                Members = new List<User> { admin, dev1 }
            };

            var projectBeta = new Project
            {
                Name = "Project Beta",
                Description = "Internal dashboard",
                Deadline = DateTime.UtcNow.AddDays(60),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                Members = new List<User> { dev1, dev2 }
            };

            context.Projects.AddRange(projectAlpha, projectBeta);
            context.SaveChanges();

            var tasks = new[]
            {
                new TaskItem
                {
                    Title = "Set up project structure",
                    Description = "Create folder structure and base configuration",
                    Status = Models.TaskStatus.Completed,
                    Priority = Priority.High,
                    ProjectId = projectAlpha.Id,
                    AssignedToId = dev1.Id,
                    CreatedAt = DateTime.UtcNow.AddDays(-14),
                    UpdatedAt = DateTime.UtcNow.AddDays(-10),
                    CompletedAt = DateTime.UtcNow.AddDays(-10)
                },
                new TaskItem
                {
                    Title = "Implement authentication",
                    Description = "Add JWT-based authentication with login and register endpoints",
                    Status = Models.TaskStatus.InProgress,
                    Priority = Priority.Critical,
                    ProjectId = projectAlpha.Id,
                    AssignedToId = dev1.Id,
                    CreatedAt = DateTime.UtcNow.AddDays(-7),
                    UpdatedAt = DateTime.UtcNow.AddDays(-1)
                },
                new TaskItem
                {
                    Title = "Add task filtering",
                    Description = "Support filtering tasks by status, priority, assignee, and date range",
                    Status = Models.TaskStatus.New,
                    Priority = Priority.Medium,
                    ProjectId = projectAlpha.Id,
                    DueDate = DateTime.UtcNow.AddDays(5),
                    CreatedAt = DateTime.UtcNow.AddDays(-3),
                    UpdatedAt = DateTime.UtcNow.AddDays(-3)
                },
                new TaskItem
                {
                    Title = "Design dashboard layout",
                    Description = "Create wireframes for the internal dashboard",
                    Status = Models.TaskStatus.New,
                    Priority = Priority.High,
                    ProjectId = projectBeta.Id,
                    AssignedToId = dev2.Id,
                    DueDate = DateTime.UtcNow.AddDays(-2),
                    CreatedAt = DateTime.UtcNow.AddDays(-10),
                    UpdatedAt = DateTime.UtcNow.AddDays(-10)
                }
            };

            context.Tasks.AddRange(tasks);
            context.SaveChanges();
        }
    }
}
