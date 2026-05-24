---
schema_version: "2.0.0"
id: aspnetcore-mvc
name: "ASP.NET Core MVC"
version: "1.0.0"
description: "ASP.NET Core 8+ MVC structure with thin controllers, ViewModel separation, service injection, and Razor Pages guidance for page-centric flows."
category: stack
language: csharp
frameworks:
  - aspnetcore
  - efcore
  - razorpages
detection:
  dependencies:
    any:
      - Microsoft.AspNetCore
      - Microsoft.AspNetCore.Mvc
  files:
    - Program.cs
    - appsettings.json
    - "Views/"
    - "Pages/"
  source_indicators:
    - "builder.Services.AddControllersWithViews"
    - "builder.Services.AddRazorPages"
    - "Controller"
    - "PageModel"
    - "@model"
    - "ViewResult"
structure:
  required_dirs:
    - path: "Controllers/"
      purpose: "One controller class per feature area. Controllers are thin: validate ModelState, call an injected service, select the appropriate View with a ViewModel. No ORM calls, no business logic. Inherit from Controller for views or ControllerBase for API-only actions."
    - path: "Views/"
      purpose: "Razor view files organised per controller (Views/Home/Index.cshtml). Shared layouts, partial views, and tag helpers live in Views/Shared/. _ViewImports.cshtml declares global namespaces and tag helpers. Views receive a ViewModel — never a raw domain entity or EF model."
    - path: "Models/"
      purpose: "ViewModels shaped per view. Not domain entities. A ViewModel contains exactly the data a specific view needs — no more. Separate folders (Models/ViewModels/, Models/InputModels/) clarify purpose. Data Annotations for client-side and server-side validation live on input models."
    - path: "Services/"
      purpose: "Business logic injected into controllers via constructor DI. One interface + implementation per service (IOrderService, OrderService). Services call the Data layer and return ViewModels or domain results — not raw EF entities."
    - path: "Data/"
      purpose: "EF Core DbContext, repository implementations if used, and Migrations. DbContext is registered in Program.cs and injected into services or repositories — never into controllers directly."
    - path: "wwwroot/"
      purpose: "All static assets: CSS, JavaScript, fonts, images. Never reference files outside wwwroot for static serving. Use Tag Helpers (asp-src, asp-href) for cache-busted URLs."
  recommended_dirs:
    - path: "Areas/{AreaName}/"
      purpose: "Feature isolation for large apps. Each Area has its own Controllers/, Views/, and Models/ subdirectories. Use Areas for distinct functional sections (Admin, Customer, API) that should be developed and navigated independently."
    - path: "Pages/"
      purpose: "Razor Pages for page-centric CRUD flows. Each page is a .cshtml file + a co-located .cshtml.cs PageModel class. Routing is file-system based under Pages/. Use Razor Pages when a feature is a self-contained page without complex shared controller logic."
    - path: "Middleware/"
      purpose: "Custom ASP.NET Core middleware (exception handling, request logging, tenant resolution). Registered in Program.cs via app.UseMiddleware<T>(). Middleware handles cross-cutting concerns that apply to every request."
separation:
  rules:
    - concern: controllers
      belongs_in: "Controllers/"
      rule_text: "Controller actions do exactly three things: check ModelState.IsValid, call one service method, and return a View with a ViewModel or redirect. No ORM queries, no business rules, no HttpClient calls. Use [Authorize] and [ValidateAntiForgeryToken] attributes for security — never implement security inline."
      example: |
        // Controllers/OrdersController.cs — correct: thin controller
        public class OrdersController : Controller
        {
            private readonly IOrderService _orderService;
            public OrdersController(IOrderService orderService) => _orderService = orderService;

            [HttpGet]
            public async Task<IActionResult> Index()
            {
                var viewModel = await _orderService.GetOrderListViewModelAsync(User.GetUserId());
                return View(viewModel);
            }

            [HttpPost, ValidateAntiForgeryToken]
            public async Task<IActionResult> Create(CreateOrderInputModel input)
            {
                if (!ModelState.IsValid)
                    return View(input);

                await _orderService.CreateOrderAsync(input, User.GetUserId());
                return RedirectToAction(nameof(Index));
            }
        }
      anti_indicators:
        - "DbContext"
        - "_context."
        - "new SqlConnection"
    - concern: views
      belongs_in: "Views/"
      rule_text: "Views contain only display logic (if/else for showing/hiding elements, foreach for lists). All business decisions are made before the view is called. @model is always a dedicated ViewModel — never an EF entity. Use partial views for repeated UI fragments."
      example: |
        @* Views/Orders/Index.cshtml — correct: ViewModel, display logic only *@
        @model OrderListViewModel

        <h1>Orders (@Model.TotalCount)</h1>

        @foreach (var order in Model.Orders)
        {
            <div class="order-card">
                <span>@order.OrderNumber</span>
                <span>@order.TotalAmount.ToString("C")</span>
                @if (order.CanBeCancelled)
                {
                    <a asp-action="Cancel" asp-route-id="@order.Id">Cancel</a>
                }
            </div>
        }
      anti_indicators:
        - "@inject"
        - "new DbContext"
        - ".SaveChanges()"
    - concern: viewmodels
      belongs_in: "Models/"
      rule_text: "Every view that displays or collects data has a dedicated ViewModel. Input ViewModels (forms) carry Data Annotations for validation. Output ViewModels carry only the data the view needs — never navigation properties from EF entities. Map between domain objects and ViewModels in the service layer, not in the controller."
      example: |
        // Models/ViewModels/OrderListViewModel.cs
        public class OrderListViewModel
        {
            public IEnumerable<OrderSummaryViewModel> Orders { get; init; } = [];
            public int TotalCount { get; init; }
            public int CurrentPage { get; init; }
        }

        public class OrderSummaryViewModel
        {
            public int Id { get; init; }
            public string OrderNumber { get; init; } = string.Empty;
            public decimal TotalAmount { get; init; }
            public bool CanBeCancelled { get; init; }
        }

        // Models/InputModels/CreateOrderInputModel.cs
        public class CreateOrderInputModel
        {
            [Required]
            [Range(1, int.MaxValue, ErrorMessage = "Select a product")]
            public int ProductId { get; set; }

            [Required, Range(1, 100)]
            public int Quantity { get; set; }
        }
    - concern: testability
      belongs_in: tests
      rule_text: "Use WebApplicationFactory<Program> for integration testing controllers with a real HTTP pipeline. Unit test services by injecting mock dependencies via constructor injection. Use xUnit or NUnit with the Arrange-Act-Assert pattern. Test projects mirror the src/ structure: Tests.Unit/ for services, Tests.Integration/ for controllers."
      example: |
        // Tests.Integration/Controllers/UsersControllerTests.cs
        public class UsersControllerTests : IClassFixture<WebApplicationFactory<Program>>
        {
            private readonly HttpClient _client;

            public UsersControllerTests(WebApplicationFactory<Program> factory)
            {
                _client = factory.CreateClient();
            }

            [Fact]
            public async Task GetUsers_ReturnsOk()
            {
                var response = await _client.GetAsync("/api/users");
                response.EnsureSuccessStatusCode();
            }
        }

        // Tests.Unit/Services/UserServiceTests.cs
        [Fact]
        public async Task CreateUser_ValidInput_ReturnsUser()
        {
            var mockRepo = new Mock<IUserRepository>();
            var service = new UserService(mockRepo.Object);
            var result = await service.CreateUser(new CreateUserDto { Name = "Alice" });
            Assert.Equal("Alice", result.Name);
        }
      indicators:
        - "WebApplicationFactory"
        - "IClassFixture"
        - "Mock<"
patterns:
  data_flow:
    direction: "HTTP Request → Controller (ModelState check) → Service (business logic + ViewModel mapping) → EF Core / Repository (Data layer) → ViewModel → View → HTML Response"
    rules:
      - "Razor Pages flow: HTTP Request → PageModel.OnGet/OnPost (ModelState check) → Service (business logic) → PageModel properties → .cshtml template → Response."
      - "Use Areas to isolate large feature sections. Register Area routes before conventional routes in Program.cs."
      - "Register services as Scoped by default (new instance per request). Use Singleton only for truly stateless services. Transient for lightweight, stateless utilities."
      - "Use asp-* Tag Helpers for all form inputs, anchor links, and script/style URLs. Never construct action URLs or static file paths as raw strings."
      - "Keep _Layout.cshtml minimal. Use @RenderSection() for page-specific scripts and styles rather than loading everything in the layout."
  naming:
    controllers: "PascalCase with Controller suffix (OrdersController, AccountController). URL convention maps to lowercase plural (Orders → /orders)."
    views: "Match the action name exactly (Index.cshtml for Index(), Create.cshtml for Create()). Shared partials start with underscore (_OrderCard.cshtml)."
    viewmodels: "Suffix with ViewModel for output models (OrderListViewModel), InputModel for form submissions (CreateOrderInputModel)."
anti_patterns:
  - id: fat_controller
    severity: critical
    description: "Controller actions contain database queries, business logic, and HTTP calls directly. This makes actions untestable without spinning up the full web server, couples domain rules to HTTP concerns, and makes actions grow to dozens or hundreds of lines."
    bad_example: |
      // wrong: fat controller action
      public async Task<IActionResult> Create(CreateOrderViewModel model)
      {
          if (!ModelState.IsValid) return View(model);

          var product = await _context.Products.FindAsync(model.ProductId);
          if (product == null || product.Stock < model.Quantity)
              return View(model); // domain rule in controller

          var order = new Order
          {
              UserId = User.FindFirstValue(ClaimTypes.NameIdentifier),
              ProductId = model.ProductId,
              Quantity = model.Quantity,
              TotalAmount = product.Price * model.Quantity
          };
          _context.Orders.Add(order);
          product.Stock -= model.Quantity;
          await _context.SaveChangesAsync();

          await _emailService.SendOrderConfirmation(order);
          return RedirectToAction(nameof(Index));
      }
    good_example: |
      // correct: thin controller, service owns the work
      public async Task<IActionResult> Create(CreateOrderInputModel input)
      {
          if (!ModelState.IsValid) return View(input);
          await _orderService.CreateOrderAsync(input, User.GetUserId());
          return RedirectToAction(nameof(Index));
      }
  - id: entity_as_viewmodel
    severity: warning
    description: "EF Core entity objects are passed directly as the @model to Razor views or as action method parameters (for model binding). This exposes database columns to the view, creates over-posting vulnerabilities where users can submit values for protected fields, and causes serialization errors from circular navigation properties."
    bad_example: |
      // wrong: EF entity used as view model
      public async Task<IActionResult> Edit(int id)
      {
          var order = await _context.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id);
          return View(order);  // @model Order — exposes all entity fields
      }

      // wrong: entity used for model binding — over-posting risk
      [HttpPost]
      public async Task<IActionResult> Edit(Order order)
      {
          _context.Update(order);  // attacker can modify UserId, CreatedAt, etc.
          await _context.SaveChangesAsync();
      }
    good_example: |
      // correct: dedicated input model with only editable fields
      [HttpPost, ValidateAntiForgeryToken]
      public async Task<IActionResult> Edit(int id, EditOrderInputModel input)
      {
          if (!ModelState.IsValid) return View(input);
          await _orderService.UpdateOrderAsync(id, input, User.GetUserId());
          return RedirectToAction(nameof(Index));
      }
  - id: business_logic_in_razor_view
    severity: warning
    description: "Razor views contain business decisions such as calculating totals, calling services via @inject, or conditional logic based on domain rules. Views should only display data already prepared by the controller/service. Business logic in views cannot be unit tested and breaks separation of concerns."
    bad_example: |
      @* wrong: business logic in Razor view *@
      @inject IOrderService OrderService
      @{
          var total = 0m;
          foreach (var item in Model.Items)
          {
              if (item.IsDiscounted && DateTime.Now.DayOfWeek == DayOfWeek.Friday)
                  total += item.Price * 0.9m;  // business rule in view
              else
                  total += item.Price;
          }
      }
      <p>Total: @total.ToString("C")</p>
    good_example: |
      @* correct: ViewModel already has the computed total *@
      @model OrderDetailViewModel
      <p>Total: @Model.DisplayTotal</p>
      @* DisplayTotal was calculated in the service layer *@
  - id: oversized_extraction
    severity: warning
    description: "A service or controller was extracted but is still 300+ LOC. Split by domain responsibility. Use dependency injection to compose focused services."
    bad_example: |
      // Services/AppService.cs  -  500 LOC  -  users, orders, payments, notifications
    good_example: |
      // Services/OrderService.cs  -  120 LOC  -  order lifecycle only
      // Services/PaymentService.cs  -  80 LOC  -  payment processing only

---
