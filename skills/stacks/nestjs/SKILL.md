---
schema_version: "2.0.0"
id: nestjs
name: "NestJS"
version: "1.1.0"
description: "Enterprise-grade NestJS with module-per-feature structure, dependency injection, guards, and pipes."
category: stack
language: javascript
frameworks:
  - nestjs
detection:
  dependencies:
    any:
      - "@nestjs/core"
  source_indicators:
    - "@Module("
    - "@Controller("
    - "@Injectable("
    - "@nestjs/common"
structure:
  required_dirs:
    - path: src/modules
      purpose: "Feature modules  -  one directory per domain (users/, orders/, etc.) containing controller, service, and module file."
    - path: src/common
      purpose: "Cross-cutting NestJS primitives shared across all feature modules: guards (auth, roles), pipes (validation, transformation), interceptors (logging, caching), decorators, and exception filters. Nothing business-domain specific lives here."
    - path: src/config
      purpose: "Configuration module and environment validation."
  recommended_dirs:
    - path: src/database
      purpose: "Database module, entity definitions, and repository setup. TypeORM entities, Prisma schema, or Drizzle table definitions live here  -  not in feature modules. Feature modules import the database module via DI."
    - path: src/shared
      purpose: "Shared DTOs, TypeScript interfaces, and pure utility functions used across feature modules. Unlike src/common (NestJS primitives), src/shared contains plain TypeScript  -  no NestJS decorators."
separation:
  rules:
    - concern: module_structure
      belongs_in: src/modules
      rule_text: "Each feature module contains its own controller, service, and module file co-located in one directory. Do NOT put all controllers in one folder and all services in another  -  group by feature, not by type."
      example: |
        // src/modules/users/users.module.ts
        @Module({ controllers: [UsersController], providers: [UsersService] })
        export class UsersModule {}

        // src/modules/users/users.controller.ts
        @Controller('users')
        export class UsersController {
          constructor(private readonly usersService: UsersService) {}
        }
      indicators:
        - "@Module("
        - "src/modules"
    - concern: dependency_injection
      belongs_in: src/modules
      rule_text: "Inject all dependencies via constructor  -  never instantiate services or repositories with `new`. This enables testing and module substitution."
      example: |
        // ✓ Injected via constructor
        @Controller('users')
        export class UsersController {
          constructor(private readonly usersService: UsersService) {}
          @Get() findAll() { return this.usersService.findAll(); }
        }
      anti_indicators:
        - "new UsersService"
        - "new Repository"
    - concern: guards_and_pipes
      belongs_in: src/common
      rule_text: "Auth guards, validation pipes, and response interceptors live in src/common. Apply them globally via APP_GUARD/APP_PIPE in AppModule, or per-controller/route with decorators."
      example: |
        // src/common/guards/jwt-auth.guard.ts
        @Injectable()
        export class JwtAuthGuard extends AuthGuard('jwt') {}

        // Apply globally in app.module.ts
        providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }]
      indicators:
        - "@UseGuards"
        - "@UsePipes"
        - "APP_GUARD"
        - "APP_PIPE"
    - concern: configuration
      belongs_in: src/config
      rule_text: "Use @nestjs/config ConfigModule.forRoot() with a validation schema (Joi or Zod). Load config in app.module.ts and inject ConfigService into any module that needs env values. Never read process.env directly in services or controllers. Define environment-specific config files for dev/test/prod if needed."
      example: |
        // src/config/env.validation.ts
        import * as Joi from 'joi';

        export const envValidationSchema = Joi.object({
          DATABASE_URL: Joi.string().uri().required(),
          JWT_SECRET: Joi.string().min(32).required(),
          PORT: Joi.number().default(3000),
          NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        });

        // app.module.ts
        @Module({
          imports: [
            ConfigModule.forRoot({
              isGlobal: true,
              validationSchema: envValidationSchema,
            }),
          ],
        })
        export class AppModule {}

        // Usage in any service:
        constructor(private config: ConfigService) {
          this.dbUrl = config.getOrThrow<string>('DATABASE_URL');
        }
      indicators:
        - "ConfigModule"
        - "ConfigService"
        - "getOrThrow"
        - "envValidationSchema"
patterns:
  data_flow:
    direction: "Controller → Service → Repository/ORM"
    rules:
      - "Controllers receive HTTP input and delegate to services."
      - "Services contain business logic and call repositories."
      - "Repositories handle all database interactions."
  error_handling:
    recommended: "Use NestJS exception filters and built-in HttpException classes."
  naming:
    modules: "[resource].module.ts"
    controllers: "[resource].controller.ts"
    services: "[resource].service.ts"
anti_patterns:
  - id: direct_instantiation
    severity: critical
    description: "Creating service or repository instances manually with `new` instead of using NestJS dependency injection  -  untestable and bypasses the DI container."
    bad_example: |
      // ❌ Bypasses DI  -  untestable and breaks module scoping
      @Controller('users')
      export class UsersController {
        private service = new UsersService();
      }
    good_example: |
      // ✓ Injected via constructor  -  testable and scoped correctly
      constructor(private readonly usersService: UsersService) {}
  - id: flat_file_structure
    severity: warning
    description: "Organizing all controllers in one folder and all services in another instead of grouping by feature module."
    bad_example: |
      // ❌ Flat structure  -  breaks NestJS module boundaries
      src/controllers/users.controller.ts
      src/services/users.service.ts
    good_example: |
      // ✓ Feature module structure
      src/modules/users/users.controller.ts
      src/modules/users/users.service.ts
      src/modules/users/users.module.ts
  - id: business_logic_in_controller
    severity: critical
    description: "Placing business rules, validation logic, or DB queries directly in controllers instead of services."
    bad_example: |
      @Post()
      async create(@Body() dto: CreateUserDto) {
        const existing = await this.db.findOne({ email: dto.email });
        if (existing) throw new ConflictException();
        dto.password = await bcrypt.hash(dto.password, 10);
        return this.db.save(dto);
      }
    good_example: |
      @Post()
      create(@Body() dto: CreateUserDto) {
        return this.usersService.create(dto);
      }
  - id: process_env_in_services
    severity: warning
    description: "Services read process.env directly instead of injecting ConfigService. This bypasses validation, is untestable (can't mock env vars easily), and scatters config reads across the codebase."
    bad_example: |
      @Injectable()
      export class AuthService {
        private secret = process.env.JWT_SECRET!; // untestable, unvalidated
      }
    good_example: |
      @Injectable()
      export class AuthService {
        constructor(private config: ConfigService) {}
        private get secret() { return this.config.getOrThrow<string>('JWT_SECRET'); }
      }
  - id: oversized_extraction
    severity: warning
    description: "A service or controller was extracted but is still 300+ LOC. NestJS services should focus on a single domain. Use dependency injection to compose smaller services."
    bad_example: |
      @Injectable()
      export class AppService {
        // 500 LOC handling users, orders, payments, notifications
      }
    good_example: |
      @Injectable()
      export class OrderService {
        constructor(private payment: PaymentService, private notify: NotificationService) {}
        // 100 LOC  -  order lifecycle only
      }

---
