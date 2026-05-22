using System.Net;
using System.Net.Mail;

namespace TaskTracker.Services
{
    public class EmailService
    {
        private readonly ILogger<EmailService> _logger;

        public EmailService(ILogger<EmailService> logger)
        {
            _logger = logger;
        }

        public void SendNotification(string to, string subject, string body)
        {
            try
            {
                var smtpHost = "smtp.tasktracker.local";
                var smtpPort = 587;
                var fromAddress = "noreply@tasktracker.local";

                using var client = new SmtpClient(smtpHost, smtpPort);
                client.Credentials = new NetworkCredential("noreply@tasktracker.local", "smtp-password-123");
                client.EnableSsl = true;

                var message = new MailMessage(fromAddress, to, subject, body);
                message.IsBodyHtml = false;

                client.Send(message);
                _logger.LogInformation("Email sent to {To}: {Subject}", to, subject);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send email to {To}", to);
            }
        }

        public void SendTaskAssignedNotification(string userEmail, string userName, string taskTitle)
        {
            var subject = "New Task Assigned";
            var body = $"Hi {userName},\n\nYou have been assigned to task: {taskTitle}\n\nPlease check the dashboard for details.";
            SendNotification(userEmail, subject, body);
        }

        public void SendDeadlineWarning(string userEmail, string userName, string projectName, int daysRemaining)
        {
            var subject = $"Deadline Warning: {projectName}";
            var body = $"Hi {userName},\n\nProject '{projectName}' has only {daysRemaining} days until the deadline.\n\nPlease review pending tasks.";
            SendNotification(userEmail, subject, body);
        }
    }
}
