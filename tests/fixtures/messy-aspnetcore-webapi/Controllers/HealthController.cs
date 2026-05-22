using Microsoft.AspNetCore.Mvc;

namespace TaskTracker.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class HealthController : ControllerBase
    {
        [HttpGet]
        public IActionResult Get() => Ok("Healthy");
    }
}
