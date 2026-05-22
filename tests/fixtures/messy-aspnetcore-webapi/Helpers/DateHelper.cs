namespace TaskTracker.Helpers
{
    public class DateHelper
    {
        public bool IsWeekend(DateTime date)
        {
            return date.DayOfWeek == DayOfWeek.Saturday || date.DayOfWeek == DayOfWeek.Sunday;
        }

        public int GetBusinessDaysBetween(DateTime start, DateTime end)
        {
            if (end < start) return 0;
            var count = 0;
            var current = start.Date;
            while (current <= end.Date)
            {
                if (!IsWeekend(current)) count++;
                current = current.AddDays(1);
            }
            return count;
        }

        public DateTime GetNextBusinessDay(DateTime date)
        {
            var next = date.AddDays(1);
            while (IsWeekend(next))
            {
                next = next.AddDays(1);
            }
            return next;
        }

        public string FormatRelativeDate(DateTime date)
        {
            var diff = DateTime.UtcNow - date;
            if (diff.TotalMinutes < 1) return "just now";
            if (diff.TotalMinutes < 60) return $"{(int)diff.TotalMinutes}m ago";
            if (diff.TotalHours < 24) return $"{(int)diff.TotalHours}h ago";
            if (diff.TotalDays < 7) return $"{(int)diff.TotalDays}d ago";
            if (diff.TotalDays < 30) return $"{(int)(diff.TotalDays / 7)}w ago";
            return date.ToString("MMM d, yyyy");
        }

        public bool IsOverdue(DateTime? dueDate)
        {
            if (!dueDate.HasValue) return false;
            return dueDate.Value < DateTime.UtcNow;
        }
    }
}
