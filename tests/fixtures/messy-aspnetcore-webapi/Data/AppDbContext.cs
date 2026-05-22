using Microsoft.EntityFrameworkCore;
using TaskTracker.Models;

namespace TaskTracker.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<Project> Projects { get; set; }
        public DbSet<TaskItem> Tasks { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<Comment> Comments { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<TaskItem>()
                .HasOne(t => t.AssignedTo)
                .WithMany()
                .HasForeignKey(t => t.AssignedToId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<TaskItem>()
                .HasMany(t => t.Comments)
                .WithOne()
                .HasForeignKey(c => c.TaskItemId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Project>()
                .HasMany(p => p.Tasks)
                .WithOne()
                .HasForeignKey(t => t.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Project>()
                .HasMany(p => p.Members)
                .WithMany(u => u.Projects);

            modelBuilder.Entity<Project>()
                .HasIndex(p => p.Name)
                .IsUnique();

            modelBuilder.Entity<User>()
                .HasIndex(u => u.Email)
                .IsUnique();

            modelBuilder.Entity<TaskItem>()
                .HasIndex(t => t.Status);

            modelBuilder.Entity<TaskItem>()
                .HasIndex(t => t.DueDate);
        }

        public List<TaskItem> GetOverdueTasks()
        {
            return Tasks
                .Include(t => t.AssignedTo)
                .Where(t => t.DueDate.HasValue
                    && t.DueDate.Value < DateTime.Now
                    && t.Status != TaskStatus.Completed)
                .OrderBy(t => t.DueDate)
                .ToList();
        }

        public List<TaskItem> GetTasksByUser(int userId)
        {
            return Tasks
                .Include(t => t.Comments)
                .Where(t => t.AssignedToId == userId)
                .OrderByDescending(t => t.UpdatedAt)
                .ToList();
        }

        public Dictionary<string, int> GetTaskCountsByStatus()
        {
            return Tasks
                .GroupBy(t => t.Status)
                .ToDictionary(
                    g => g.Key.ToString(),
                    g => g.Count());
        }
    }
}
