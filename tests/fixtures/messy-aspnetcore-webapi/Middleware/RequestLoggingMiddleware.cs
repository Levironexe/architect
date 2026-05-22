using Microsoft.AspNetCore.Http;
using System.Diagnostics;

namespace TaskTracker.Middleware
{
    public class RequestLoggingMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<RequestLoggingMiddleware> _logger;

        public RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task Invoke(HttpContext context)
        {
            var stopwatch = Stopwatch.StartNew();
            var requestId = Guid.NewGuid().ToString("N")[..8];

            context.Response.Headers["X-Request-Id"] = requestId;

            _logger.LogInformation(
                "[{RequestId}] {Method} {Path} started",
                requestId,
                context.Request.Method,
                context.Request.Path);

            await _next(context);

            stopwatch.Stop();

            _logger.LogInformation(
                "[{RequestId}] {Method} {Path} completed {StatusCode} in {ElapsedMs}ms",
                requestId,
                context.Request.Method,
                context.Request.Path,
                context.Response.StatusCode,
                stopwatch.ElapsedMilliseconds);

            if (stopwatch.ElapsedMilliseconds > 1000)
            {
                _logger.LogWarning(
                    "[{RequestId}] Slow request: {Method} {Path} took {ElapsedMs}ms",
                    requestId,
                    context.Request.Method,
                    context.Request.Path,
                    stopwatch.ElapsedMilliseconds);
            }
        }
    }
}
