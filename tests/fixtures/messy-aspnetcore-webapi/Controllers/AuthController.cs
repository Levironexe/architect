using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using TaskTracker.Data;
using TaskTracker.Models;
using TaskTracker.Helpers;
using TaskTracker.DTOs;

namespace TaskTracker.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly PasswordHelper _passwordHelper;

        public AuthController(AppDbContext context, PasswordHelper passwordHelper)
        {
            _context = context;
            _passwordHelper = passwordHelper;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
                return BadRequest("Email and password are required");

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
            if (user == null) return Unauthorized(new { message = "Invalid credentials" });

            if (user.IsLocked)
                return Unauthorized(new { message = "Account is locked. Contact support." });

            var hash = _passwordHelper.HashPassword(request.Password);
            if (user.PasswordHash != hash)
            {
                user.FailedLoginAttempts++;
                if (user.FailedLoginAttempts >= 5)
                {
                    user.IsLocked = true;
                    user.LockedAt = DateTime.UtcNow;
                }
                await _context.SaveChangesAsync();
                return Unauthorized(new { message = "Invalid credentials" });
            }

            user.FailedLoginAttempts = 0;
            user.LastLoginAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("my-super-secret-key-12345"));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Name),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, user.Role ?? "User")
            };

            var token = new JwtSecurityToken(
                issuer: "TaskTracker",
                audience: "TaskTracker",
                claims: claims,
                expires: DateTime.UtcNow.AddHours(8),
                signingCredentials: creds);

            var tokenString = new JwtSecurityTokenHandler().WriteToken(token);

            return Ok(new
            {
                token = tokenString,
                expiresAt = token.ValidTo,
                user = new { user.Id, user.Name, user.Email, user.Role }
            });
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Email))
                return BadRequest("Email is required");

            if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8)
                return BadRequest("Password must be at least 8 characters");

            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest("Name is required");

            var emailExists = await _context.Users.AnyAsync(u => u.Email == request.Email);
            if (emailExists)
                return Conflict("Email is already registered");

            var user = new User
            {
                Name = request.Name.Trim(),
                Email = request.Email.Trim().ToLower(),
                PasswordHash = _passwordHelper.HashPassword(request.Password),
                Role = "User",
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(Login), new { user.Id, user.Name, user.Email });
        }

        [HttpPost("change-password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
        {
            var user = await _context.Users.FindAsync(request.UserId);
            if (user == null) return NotFound();

            var currentHash = _passwordHelper.HashPassword(request.CurrentPassword);
            if (user.PasswordHash != currentHash)
                return BadRequest("Current password is incorrect");

            if (request.NewPassword.Length < 8)
                return BadRequest("New password must be at least 8 characters");

            if (request.CurrentPassword == request.NewPassword)
                return BadRequest("New password must differ from current password");

            user.PasswordHash = _passwordHelper.HashPassword(request.NewPassword);
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Password changed" });
        }

        [HttpPost("unlock/{userId}")]
        public async Task<IActionResult> UnlockAccount(int userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            user.IsLocked = false;
            user.FailedLoginAttempts = 0;
            user.LockedAt = null;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Account unlocked" });
        }
    }

    public class RegisterRequest
    {
        public string Name { get; set; }
        public string Email { get; set; }
        public string Password { get; set; }
    }

    public class ChangePasswordRequest
    {
        public int UserId { get; set; }
        public string CurrentPassword { get; set; }
        public string NewPassword { get; set; }
    }
}
