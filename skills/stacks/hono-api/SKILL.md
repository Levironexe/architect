---
schema_version: "2.0.0"
id: hono-api
name: "Hono API"
version: "1.1.0"
description: "Lightweight, edge-first Hono API with Zod validation, platform-agnostic handlers, and middleware chaining."
category: stack
language: javascript
frameworks:
  - hono
detection:
  dependencies:
    any:
      - hono
  source_indicators:
    - "new Hono()"
    - "from 'hono'"
    - "from \"hono\""
structure:
  required_dirs:
    - path: src/routes
      purpose: "Route definitions grouped by resource  -  registered on the Hono app instance."
    - path: src/services
      purpose: "Business logic with no Hono or platform-specific imports."
    - path: src/middleware
      purpose: "Reusable Hono middleware  -  auth, logging, CORS, error handling."
  recommended_dirs:
    - path: src/schemas
      purpose: "Zod schemas for request/response validation."
    - path: src/types
      purpose: "Shared TypeScript interfaces and error types."
    - path: src/lib
      purpose: "Singleton instances (database connections, KV clients) initialized once and reused across the app. Environment parsing and config validation live here. No route definitions or business logic."
separation:
  rules:
    - concern: routing
      belongs_in: src/routes
      rule_text: "Route files define HTTP endpoints and call services. Use Hono's zValidator middleware for input validation. No business logic or DB queries in route handlers."
      indicators:
        - "new Hono()"
        - ".get("
        - ".post("
        - "zValidator"
      example: |
        // src/routes/users.ts
        import { Hono } from 'hono';
        import { zValidator } from '@hono/zod-validator';
        import { createUserSchema } from '../schemas/user.schema';
        import { userService } from '../services/users.service';
        const users = new Hono();
        users.post('/', zValidator('json', createUserSchema), async (c) => {
          const data = c.req.valid('json');
          return c.json(await userService.create(data), 201);
        });
    - concern: platform_agnostic_handlers
      belongs_in: src/services
      rule_text: "Services must not import Hono context types (Context, HonoRequest). They receive plain data and return plain data  -  this keeps them portable across Cloudflare Workers, Node.js, and Bun."
      example: |
        // src/services/users.service.ts
        export async function createUser(data: CreateUserDTO) {
          return db.insert(users).values(data);
        }
      anti_indicators:
        - "Context"
        - "HonoRequest"
        - "c.req"
    - concern: error_handling
      belongs_in: src/middleware
      rule_text: "Register a global error handler with app.onError() that catches all thrown errors and returns a consistent JSON response. Use HTTPException for expected errors with status codes. Services throw domain-specific errors — the global handler translates them to HTTP responses. Never expose stack traces or internal error details to the client."
      example: |
        // src/index.ts
        import { Hono } from 'hono';
        import { HTTPException } from 'hono/http-exception';

        const app = new Hono();

        app.onError((err, c) => {
          if (err instanceof HTTPException) {
            return c.json({ error: err.message }, err.status);
          }
          console.error('Unhandled:', err);
          return c.json({ error: 'Internal server error' }, 500);
        });
      indicators:
        - "app.onError"
        - "HTTPException"
    - concern: security
      belongs_in: src/middleware
      rule_text: "Create auth guard middleware that verifies JWT or session tokens before route handlers execute. Use Hono's middleware pattern to apply guards per-route or globally. Input validation via zValidator is the first line of defense — never trust client input. On edge runtimes (Cloudflare Workers), use the Web Crypto API for token verification instead of Node.js crypto."
      example: |
        // src/middleware/auth.ts
        import { createMiddleware } from 'hono/factory';
        import { HTTPException } from 'hono/http-exception';

        export const authGuard = createMiddleware(async (c, next) => {
          const token = c.req.header('Authorization')?.replace('Bearer ', '');
          if (!token) throw new HTTPException(401, { message: 'Missing token' });
          const payload = await verifyToken(token); // Web Crypto API on edge
          c.set('userId', payload.sub);
          await next();
        });

        // src/routes/users.ts — apply guard
        app.get('/users/me', authGuard, async (c) => {
          const userId = c.get('userId');
          return c.json(await getUser(userId));
        });
      indicators:
        - "authGuard"
        - "Authorization"
        - "HTTPException(401"
    - concern: validation
      belongs_in: src/schemas
      rule_text: "Define Zod schemas in src/schemas/ and use @hono/zod-validator to validate request bodies. Never manually parse and validate req.json() in handlers."
      example: |
        // src/schemas/user.schema.ts
        import { z } from 'zod';
        export const createUserSchema = z.object({
          email: z.string().email(),
          password: z.string().min(8),
        });
    - concern: configuration
      belongs_in: src/lib
      rule_text: "Parse and validate environment variables in src/lib/config.ts at startup. On Cloudflare Workers, use the Bindings type and c.env for runtime config. On Node.js, use Zod to validate process.env. Export a typed config — never read raw env vars in route handlers. Edge runtimes don't have process.env — always use the platform-appropriate method."
      example: |
        // src/lib/config.ts — Node.js / Bun
        import { z } from 'zod';

        const envSchema = z.object({
          DATABASE_URL: z.string().url(),
          JWT_SECRET: z.string().min(32),
          PORT: z.coerce.number().default(3000),
        });

        export const config = envSchema.parse(process.env);

        // For Cloudflare Workers — use Bindings type
        // type Bindings = { DATABASE_URL: string; JWT_SECRET: string };
        // const app = new Hono<{ Bindings: Bindings }>();
        // Access via c.env.DATABASE_URL in handlers
      indicators:
        - "config/env"
        - "envSchema"
        - "Bindings"
        - "c.env"
patterns:
  data_flow:
    direction: "Route → Service → Data Access"
    rules:
      - "Routes validate input with Zod and delegate to services."
      - "Services are platform-agnostic  -  no Hono or env-specific imports."
      - "Middleware handles cross-cutting concerns like auth and CORS."
  error_handling:
    recommended: "Use app.onError() for centralized error handling."
  naming:
    routes: "[resource].ts"
    services: "[resource].service.ts"
    schemas: "[resource].schema.ts"
anti_patterns:
  - id: node_api_in_handler
    severity: critical
    description: "Using Node.js-specific APIs (fs, process, Buffer) in route handlers breaks Cloudflare Workers and Bun compatibility."
    bad_example: |
      // ❌ Node.js API breaks edge compatibility
      app.get('/file', (c) => {
        const data = require('fs').readFileSync('./data.json');
        return c.json(JSON.parse(data));
      });
    good_example: |
      // ✓ Use env bindings or fetch  -  platform-agnostic
      app.get('/file', async (c) => {
        const data = await c.env.KV.get('data');
        return c.json(JSON.parse(data));
      });
  - id: business_logic_in_handler
    severity: critical
    description: "Placing business rules and DB queries directly in route handlers instead of services."
    bad_example: |
      app.post('/users', async (c) => {
        const body = await c.req.json();
        const hash = await bcrypt.hash(body.password, 10);
        const user = await db.insert(users).values({ ...body, password: hash });
        return c.json(user);
      });
    good_example: |
      app.post('/users', zValidator('json', createUserSchema), async (c) => {
        return c.json(await userService.create(c.req.valid('json')), 201);
      });
  - id: no_zod_validation
    severity: warning
    description: "Parsing request body with c.req.json() without schema validation  -  trusts unvalidated user input."
    bad_example: |
      const body = await c.req.json(); // unvalidated
    good_example: |
      // Use zValidator middleware  -  body is typed and validated
      zValidator('json', createUserSchema)
  - id: untyped_error_responses
    severity: warning
    description: "Route handlers catch errors and return ad-hoc error shapes — some return { error: string }, others { message: string }, others plain text. Consumers cannot reliably parse error responses."
    bad_example: |
      app.get('/users/:id', async (c) => {
        try {
          const user = await getUser(c.req.param('id'));
          return c.json(user);
        } catch {
          return c.text('Not found', 404); // inconsistent with other routes returning JSON
        }
      });
    good_example: |
      // Consistent: throw HTTPException, let global handler format the response
      app.get('/users/:id', async (c) => {
        const user = await getUser(c.req.param('id'));
        if (!user) throw new HTTPException(404, { message: 'User not found' });
        return c.json(user);
      });
  - id: no_auth_on_mutation
    severity: critical
    description: "POST/PUT/DELETE route handlers that modify data without verifying the caller's identity. Any unauthenticated request can create, update, or delete resources."
    bad_example: |
      app.delete('/users/:id', async (c) => {
        await deleteUser(c.req.param('id')); // no auth check — anyone can delete any user
        return c.json({ deleted: true });
      });
    good_example: |
      app.delete('/users/:id', authGuard, async (c) => {
        const userId = c.get('userId');
        if (userId !== c.req.param('id')) throw new HTTPException(403, { message: 'Forbidden' });
        await deleteUser(c.req.param('id'));
        return c.json({ deleted: true });
      });
  - id: raw_env_in_routes
    severity: warning
    description: "Route handlers read process.env or c.env directly without validation. Missing variables cause runtime crashes. On edge runtimes, process.env doesn't exist — code fails silently or throws a ReferenceError."
    bad_example: |
      app.get('/health', (c) => {
        return c.json({ db: process.env.DATABASE_URL ? 'connected' : 'missing' });
        // On Cloudflare Workers: ReferenceError — process is not defined
      });
    good_example: |
      import { config } from '../lib/config';
      app.get('/health', (c) => {
        return c.json({ db: config.DATABASE_URL ? 'connected' : 'missing' });
      });
  - id: oversized_extraction
    severity: warning
    description: "A module was extracted from a handler but is still 300+ LOC. Split into focused sub-modules."
    bad_example: |
      // services/user.service.ts  -  400 LOC  -  auth, profile, billing, notifications
    good_example: |
      // services/user.service.ts  -  80 LOC  -  user CRUD only
      // services/auth.service.ts  -  60 LOC

---
