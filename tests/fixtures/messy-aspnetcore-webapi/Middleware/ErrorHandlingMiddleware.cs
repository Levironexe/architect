using Microsoft.AspNetCore.Http;
using System.Net;
using System.Text.Json;

namespace TaskTracker.Middleware
{
    public class ErrorHandlingMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<ErrorHandlingMiddleware> _logger;

        public ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task Invoke(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (KeyNotFoundException ex)
            {
                _logger.LogWarning(ex, "Resource not found: {Path}", context.Request.Path);
                await WriteErrorResponse(context, HttpStatusCode.NotFound, "Resource not found");
            }
            catch (UnauthorizedAccessException ex)
            {
                _logger.LogWarning(ex, "Unauthorized access: {Path}", context.Request.Path);
                await WriteErrorResponse(context, HttpStatusCode.Unauthorized, "Unauthorized");
            }
            catch (ArgumentException ex)
            {
                _logger.LogWarning(ex, "Bad request: {Path}", context.Request.Path);
                await WriteErrorResponse(context, HttpStatusCode.BadRequest, ex.Message);
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogWarning(ex, "Conflict: {Path}", context.Request.Path);
                await WriteErrorResponse(context, HttpStatusCode.Conflict, ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unhandled exception: {Path}", context.Request.Path);
                await WriteErrorResponse(context, HttpStatusCode.InternalServerError, "An unexpected error occurred");
            }
        }

        private static async Task WriteErrorResponse(HttpContext context, HttpStatusCode statusCode, string message)
        {
            context.Response.ContentType = "application/json";
            context.Response.StatusCode = (int)statusCode;

            var response = new
            {
                status = (int)statusCode,
                error = statusCode.ToString(),
                message,
                timestamp = DateTime.UtcNow,
                path = context.Request.Path.ToString()
            };

            var json = JsonSerializer.Serialize(response, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            await context.Response.WriteAsync(json);
        }
    }
}
