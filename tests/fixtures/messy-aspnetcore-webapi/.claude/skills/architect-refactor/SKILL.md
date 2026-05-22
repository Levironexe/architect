---
name: architect-refactor
description: >
  Executes a refactoring plan phase by phase, moving files, updating imports, and pausing
  between phases for developer confirmation. Use this skill whenever the user wants to execute
  a refactor, apply an architect plan, move files per their architecture blueprint, or says
  "do the refactor", "execute phase 1", "start refactoring". Trigger even if the user just
  says "let's do it" after a planning session, or "go ahead with the plan".
metadata:
  version: "1.0"
  author-email: "levironforwork@gmail.com"
  last-updated: "2026-05-11"
---

# architect-refactor

You are executing a developer's refactoring plan one phase at a time. The goal is safe,
incremental restructuring  -  the developer controls the pace, you do the work precisely and
explain everything before you touch a file.

## Before you do anything: check for the plan

Look for `.architect/plan.md` in the project root.

If it does not exist, stop immediately and output:

```
❌ No refactoring plan found.

Run `/architect-plan` first to generate a plan, then invoke `/architect-refactor` to execute it.
```

Do not modify any files if the plan is missing.

## Architectural constraints you must follow

The following rules come from the **ASP.NET Core Web API** architecture blueprint. Treat them as
hard constraints  -  they are not suggestions. Every file move you make must end up satisfying
these rules.

- domain_layer -> src/{AppName}.Domain/
  Rule: Domain entities, aggregates, and value objects contain business rules and invariants as methods. They have no dependencies on EF Core, ASP.NET Core, or any framework. Domain interfaces (IRepository<T>) are declared here — implemented in Infrastructure. Domain events are raised inside entity methods.
  Example:
    // Domain/Entities/Order.cs — pure domain entity, no framework dependencies
    public class Order : BaseEntity
    {
        public OrderStatus Status { get; private set; }
        public decimal TotalAmount { get; private set; }
        private readonly List<OrderItem> _items = new();
        public IReadOnlyList<OrderItem> Items => _items.AsReadOnly();
    
        public void AddItem(Product product, int quantity)
        {
            Guard.Against.Null(product, nameof(product));
            Guard.Against.NegativeOrZero(quantity, nameof(quantity));
            _items.Add(new OrderItem(product.Id, quantity, product.Price));
            TotalAmount += product.Price * quantity;
            AddDomainEvent(new OrderItemAddedEvent(Id, product.Id));
        }
    }

- use_cases -> src/{AppName}.Application/Features/
  Rule: Each use case is a MediatR Command or Query with a corresponding Handler. Commands mutate state; Queries return data. Handlers orchestrate domain objects and repository calls — they do not contain SQL, EF Core queries, or HTTP logic. FluentValidation validators are co-located with the Command/Query class.
  Example:
    // Application/Features/Orders/Commands/CreateOrder/CreateOrderCommand.cs
    public record CreateOrderCommand(int CustomerId, List<OrderItemDto> Items) : IRequest<int>;
    
    public class CreateOrderCommandValidator : AbstractValidator<CreateOrderCommand>
    {
        public CreateOrderCommandValidator()
        {
            RuleFor(x => x.CustomerId).GreaterThan(0);
            RuleFor(x => x.Items).NotEmpty();
        }
    }
    
    // Application/Features/Orders/Commands/CreateOrder/CreateOrderCommandHandler.cs
    public class CreateOrderCommandHandler : IRequestHandler<CreateOrderCommand, int>
    {
        private readonly IOrderRepository _orderRepository;
        private readonly IProductRepository _productRepository;
    
        public CreateOrderCommandHandler(IOrderRepository orderRepository, IProductRepository productRepository)
        {
            _orderRepository = orderRepository;
            _productRepository = productRepository;
        }
    
        public async Task<int> Handle(CreateOrderCommand request, CancellationToken ct)
        {
            var order = new Order(request.CustomerId);
            foreach (var item in request.Items)
            {
                var product = await _productRepository.GetByIdAsync(item.ProductId, ct);
                order.AddItem(product, item.Quantity);
            }
            await _orderRepository.AddAsync(order, ct);
            return order.Id;
        }
    }

- api_controllers -> src/{AppName}.Api/Controllers/
  Rule: Controllers are thin HTTP adapters. They receive the request, call _mediator.Send(command/query), and return an IActionResult. No business logic, no direct service calls, no EF Core usage. Use ProducesResponseType attributes for Swagger documentation.
  Example:
    // Api/Controllers/OrdersController.cs — correct: thin controller
    [ApiController]
    [Route("api/[controller]")]
    public class OrdersController : ControllerBase
    {
        private readonly IMediator _mediator;
        public OrdersController(IMediator mediator) => _mediator = mediator;
    
        [HttpPost]
        [ProducesResponseType(typeof(int), StatusCodes.Status201Created)]
        public async Task<IActionResult> Create(CreateOrderCommand command, CancellationToken ct)
        {
            var orderId = await _mediator.Send(command, ct);
            return CreatedAtAction(nameof(GetById), new { id = orderId }, orderId);
        }
    }

If the above block is empty, use your best judgment based on the stack and the plan itself.

## Anti-patterns to avoid

After each step, verify you have not introduced any of the following:

- logic_in_controllers [critical]
  Business logic, domain rules, or data access code is placed directly in controller action methods. This makes the logic untestable without an HTTP server, ties it to the HTTP protocol, and prevents reuse from background jobs or other entry points.
  Bad example:
    // wrong: business logic in controller
    [HttpPost]
    public async Task<IActionResult> CreateOrder(CreateOrderRequest request)
    {
        var customer = await _context.Customers.FindAsync(request.CustomerId);
        if (customer == null) return NotFound();
        if (customer.CreditLimit < request.TotalAmount) return BadRequest("Insufficient credit");
    
        var order = new Order { CustomerId = request.CustomerId, TotalAmount = request.TotalAmount };
        _context.Orders.Add(order);
        await _context.SaveChangesAsync();
        customer.CreditLimit -= request.TotalAmount;
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = order.Id }, order);
    }
  Good example:
    // correct: controller delegates to MediatR
    [HttpPost]
    public async Task<IActionResult> CreateOrder(CreateOrderCommand command, CancellationToken ct)
    {
        var orderId = await _mediator.Send(command, ct);
        return CreatedAtAction(nameof(GetById), new { id = orderId }, orderId);
    }

- entity_returned_from_controller [warning]
  EF Core entity objects are returned directly from controller actions. This exposes the full database schema (including navigation properties that cause circular references), can trigger lazy-load queries outside the request lifetime, and couples the API contract to the database structure.
  Bad example:
    // wrong: returning EF entity directly
    [HttpGet("{id}")]
    public async Task<ActionResult<Order>> GetOrder(int id)
    {
        var order = await _context.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id);
        return order ?? NotFound();  // exposes all entity fields + navigation props
    }
  Good example:
    // correct: return a DTO mapped by the query handler
    [HttpGet("{id}")]
    public async Task<ActionResult<OrderDto>> GetOrder(int id, CancellationToken ct)
    {
        var result = await _mediator.Send(new GetOrderByIdQuery(id), ct);
        return result is null ? NotFound() : Ok(result);
    }

- di_all_in_program [warning]
  All service registrations are placed directly in Program.cs instead of per-layer extension methods. As the app grows, Program.cs becomes hundreds of lines long, layers lose their encapsulation of their own dependencies, and moving a layer to a different project requires also updating Program.cs.
  Bad example:
    // wrong: all DI in Program.cs
    builder.Services.AddDbContext<AppDbContext>(opt => opt.UseSqlServer(connStr));
    builder.Services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
    builder.Services.AddScoped<IEmailService, SmtpEmailService>();
    builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(CreateOrderCommand).Assembly));
    builder.Services.AddValidatorsFromAssembly(typeof(CreateOrderCommand).Assembly);
  Good example:
    // correct: per-layer extension methods
    // Application/DependencyInjection.cs
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly()));
        services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly());
        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehaviour<,>));
        return services;
    }
    
    // Program.cs — clean composition root
    builder.Services
        .AddApplication()
        .AddInfrastructure(builder.Configuration);

- anemic_domain [warning]
  Domain entities are plain data containers with only public getters/setters and no behavior. All business logic lives in Application layer services or handlers. This removes the value of a domain model — invariants are not enforced, and logic is scattered.
  Bad example:
    // wrong: anemic entity — just a data bag
    public class Order
    {
        public int Id { get; set; }
        public decimal TotalAmount { get; set; }
        public OrderStatus Status { get; set; }
        public List<OrderItem> Items { get; set; } = new();
    }
    // Business rules enforced externally in handler — no encapsulation
  Good example:
    // correct: entity with behavior and invariants
    public class Order
    {
        public decimal TotalAmount { get; private set; }
        public OrderStatus Status { get; private set; }
        private readonly List<OrderItem> _items = new();
    
        public void AddItem(Product product, int quantity)
        {
            if (Status != OrderStatus.Draft)
                throw new OrderAlreadyConfirmedException(Id);
            _items.Add(new OrderItem(product, quantity));
            TotalAmount += product.Price * quantity;
        }
    
        public void Confirm()
        {
            if (!_items.Any())
                throw new EmptyOrderException(Id);
            Status = OrderStatus.Confirmed;
        }
    }

If the above block is empty, at minimum: do not put business logic in route handlers, do not
hardcode secrets, do not create circular imports.

## How to execute the plan

### 1. Read the plan and check progress

Read `.architect/plan.md` in full.

If `.architect/state.json` exists, use it to determine where to resume:
- Parse the JSON and find the first phase with status `"pending"` or `"in_progress"`
- If a phase is `"in_progress"`, resume from its first unchecked step (`- [ ]`) in plan.md
- If all phases are `"completed"`, output "✅ All phases complete." and stop
- Set the found phase as your current target

If `.architect/state.json` does not exist, fall back to the checkbox method: look for the first
phase that still has unchecked steps (`- [ ]`). If all steps in a phase are already checked
(`- [x]`), skip to the next phase.

### 2. Execute the current phase, step by step

For each unchecked step in the current phase:

**Before touching the file**, state in the chat:
> "Step N.M: Moving `<source>` → `<target>`. Reason: <why from the plan>. Updating imports in: <files>."

Then:
1. Create the target directory if it doesn't exist
2. Move or create the file as specified
3. Update all imports listed in the step's "Imports to update" field, using the exact
   old-path → new-path substitutions specified (not just the file list)
4. If the step has a "Verify:" line, run the grep command it specifies. If it returns results,
   fix the remaining references before proceeding  -  do not mark the step done with known
   orphaned imports
5. Verify the project still makes sense (no obviously broken imports left behind)
6. Mark the step as done in `.architect/plan.md` by changing `- [ ]` to `- [x]`

If a step would create a circular dependency, skip it, explain why in the chat, and continue
with the next step.

### 3. After completing all steps in the phase, verify and update state

Run verification:
```
npx @levironexe/architect verify . --phase N
```
(Replace N with the current phase number.)

If the command is not available, fall back to:
```
npx @levironexe/architect scan .
```

**If verification FAILS** (exit code 1, or tsc errors / broken imports reported):
- Stop immediately
- Show the verification output to the developer
- Do not proceed to the next phase
- Output: "Phase N verification failed. Fix the issues above and run `/architect-refactor` to retry."

**If verification PASSES:**

Update `.architect/state.json` (if it exists):
- Set the current phase's `status` to `"completed"` and add `"completed_at": "<ISO timestamp>"`
- If a next phase exists, set its `status` to `"in_progress"` and `"started_at": "<ISO timestamp>"`
- Update `current_phase` to N+1
- Read the health score from `.architect/scans/phase-N.json` and set `latest_health` to that value

Then output exactly this (replacing the placeholders):

```
✅ Phase N complete: <phase name>
Verification: PASSED (0 tsc errors, 0 broken imports)
Health: <baseline_health> → <latest_health> (+<delta>)

Steps executed:
- [x] Step N.1: <description>
- [x] Step N.2: <description>
...

Proceed to Phase N+1 (<next phase name>)? **yes / no**
```

Then stop. Wait for the developer to respond before touching Phase N+1.

If there is no next phase, output:

```
✅ All phases complete.

The refactoring is done. Run `npx @levironexe/architect diff .` to see the full before/after comparison.
```

### 4. On developer confirmation

If the developer says yes (or "continue", "proceed", "go ahead"), execute the next phase
following the same step-by-step process.

If the developer says no (or "stop", "wait", "pause"), stop and confirm:
> "Paused after Phase N. The plan in `.architect/plan.md` is up to date  -  all completed steps
> are checked. Run `/architect-refactor` again when you're ready to continue."

## Important: what NOT to do

- Do not skip the pre-flight plan check  -  refactoring without a plan risks breaking the codebase
- Do not execute more than one phase per invocation unless the developer explicitly asks for all phases
- Do not modify files outside the scope of the current step
- Do not change business logic while moving files  -  the goal is structural change only
- Do not proceed to Phase N+1 automatically  -  always wait for the developer's yes/no
