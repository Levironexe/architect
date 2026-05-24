---
schema_version: "2.0.0"
id: fastify-api
name: "Fastify API"
version: "1.1.0"
description: "High-performance Fastify API with plugin architecture, TypeBox schema validation, and decorator patterns."
category: stack
language: javascript
frameworks:
  - fastify
detection:
  dependencies:
    any:
      - fastify
  source_indicators:
    - "fastify()"
    - "Fastify()"
    - "fastify.register"
structure:
  required_dirs:
    - path: src/routes
      purpose: "Route definitions registered as Fastify plugins  -  one file per resource."
    - path: src/services
      purpose: "Business logic with no Fastify imports  -  receives plain data, returns plain data."
    - path: src/schemas
      purpose: "TypeBox JSON schemas for request/response validation shared between routes and types."
    - path: src/plugins
      purpose: "Fastify plugins  -  auth, DB connections, decorators, and shared utilities."
  recommended_dirs:
    - path: src/types
      purpose: "Shared TypeScript interfaces and custom error types."
    - path: src/lib
      purpose: "Client singletons such as database connections."
separation:
  rules:
    - concern: schema_validation
      belongs_in: src/schemas
      rule_text: "Define all request/response schemas using TypeBox in src/schemas/. Register them on routes using the schema option. Never skip schema validation on public endpoints."
      example: |
        // src/schemas/user.schema.ts
        import { Type } from '@sinclair/typebox';
        export const CreateUserBody = Type.Object({
          email: Type.String({ format: 'email' }),
          password: Type.String({ minLength: 8 }),
        });
      indicators:
        - "Type.Object"
        - "@sinclair/typebox"
    - concern: plugins
      belongs_in: src/plugins
      rule_text: "Encapsulate cross-cutting concerns as Fastify plugins. Register DB clients, auth decorators, and shared utilities as plugins  -  not inline in route handlers. Use fastify-plugin (fp) to avoid scope encapsulation so decorators are visible across the entire app."
      example: |
        // src/plugins/db.ts
        import fp from 'fastify-plugin';
        export default fp(async (fastify) => {
          fastify.decorate('db', drizzle(connection));
        });
      indicators:
        - "fastify-plugin"
        - "fp("
        - "fastify.decorate"
        - "fastify.register"
    - concern: services
      belongs_in: src/services
      rule_text: "Services must not import Fastify types (FastifyRequest, FastifyReply). They receive plain objects and return plain data."
      example: |
        // src/services/users.service.ts
        export async function createUser(data: CreateUserDTO) {
          return db.insert(users).values(data).returning();
        }
      anti_indicators:
        - "FastifyRequest"
        - "FastifyReply"
    - concern: security
      belongs_in: src/plugins
      rule_text: "Register authentication as a Fastify plugin using preHandler hooks or @fastify/auth. Validate all request input using Fastify's JSON Schema validation (schema property on routes) — this runs before the handler and rejects malformed input with a 400 automatically. Never read secrets from process.env inside route handlers — load them once at startup via the config plugin."
      example: |
        // src/plugins/auth.ts
        import { FastifyInstance, FastifyRequest } from 'fastify';

        export default async function authPlugin(fastify: FastifyInstance) {
          fastify.decorateRequest('userId', '');

          fastify.addHook('preHandler', async (request: FastifyRequest) => {
            const token = request.headers.authorization?.replace('Bearer ', '');
            if (!token) throw fastify.httpErrors.unauthorized('Missing token');
            const payload = await verifyJwt(token);
            request.userId = payload.sub;
          });
        }

        // src/routes/users.ts — schema validates input before handler runs
        fastify.post('/users', {
          schema: {
            body: { type: 'object', required: ['name', 'email'], properties: {
              name: { type: 'string', minLength: 1 },
              email: { type: 'string', format: 'email' },
            }},
          },
        }, async (request) => {
          return createUser(request.body);
        });
      indicators:
        - "preHandler"
        - "httpErrors.unauthorized"
        - "schema:"
    - concern: error_handling
      belongs_in: src/plugins
      rule_text: "Register a global error handler with fastify.setErrorHandler() in a dedicated plugin. Define custom error classes with statusCode and code properties. Route handlers throw these errors — the global handler serializes them into a consistent response shape. Use fastify's built-in schema validation errors for input validation failures."
      example: |
        // src/plugins/error-handler.ts
        import { FastifyInstance } from 'fastify';

        export class AppError extends Error {
          constructor(public statusCode: number, public code: string, message: string) {
            super(message);
          }
        }

        export default async function errorHandler(fastify: FastifyInstance) {
          fastify.setErrorHandler((error, request, reply) => {
            if (error instanceof AppError) {
              return reply.status(error.statusCode).send({ error: error.code, message: error.message });
            }
            if (error.validation) {
              return reply.status(400).send({ error: 'VALIDATION_ERROR', message: error.message });
            }
            request.log.error(error);
            reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Something went wrong' });
          });
        }
      indicators:
        - "setErrorHandler"
        - "AppError"
    - concern: configuration
      belongs_in: src/config
      rule_text: "Load and validate all environment variables at startup in a single config module. Use @fastify/env or manual Zod/Ajv validation. Export a typed config object that plugins and routes import — never read process.env directly in handlers. Fail fast: if a required variable is missing, the server must not start."
      example: |
        // src/config/env.ts
        import { z } from 'zod';

        const envSchema = z.object({
          PORT: z.coerce.number().default(3000),
          DATABASE_URL: z.string().url(),
          JWT_SECRET: z.string().min(32),
          NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
        });

        export const config = envSchema.parse(process.env);
        // Throws at startup if DATABASE_URL or JWT_SECRET is missing

        // Usage: import { config } from './config/env';
      indicators:
        - "config/env"
        - "envSchema"
        - ".parse(process.env)"
    - concern: testability
      belongs_in: tests
      rule_text: "Use fastify.inject() for integration testing routes without starting a real HTTP server. Unit test services in isolation by passing dependencies as constructor parameters. Organize tests mirroring src/ structure: tests/routes/, tests/services/, tests/plugins/. Use beforeAll to build the Fastify instance once per test file."
      example: |
        // tests/routes/users.test.ts
        import { describe, it, expect, beforeAll } from 'vitest';
        import { buildApp } from '../../src/app';
        import type { FastifyInstance } from 'fastify';

        let app: FastifyInstance;
        beforeAll(async () => { app = await buildApp(); });

        describe('GET /users', () => {
          it('returns 200 with user list', async () => {
            const response = await app.inject({ method: 'GET', url: '/users' });
            expect(response.statusCode).toBe(200);
            expect(response.json()).toBeInstanceOf(Array);
          });

          it('returns 401 without auth', async () => {
            const response = await app.inject({ method: 'GET', url: '/users/me' });
            expect(response.statusCode).toBe(401);
          });
        });
      indicators:
        - "app.inject"
        - "buildApp"
        - "response.statusCode"
    - concern: plugin_reuse
      belongs_in: src/plugins
      rule_text: "Extract shared logic (auth, pagination, rate limiting, request logging) into Fastify plugins that can be registered per-route or globally. Use plugin encapsulation to scope decorators and hooks. Define reusable JSON Schema refs with $ref for shared request/response shapes. If the same preHandler or schema appears in 2+ routes, extract it into a plugin."
      example: |
        // src/plugins/pagination.ts — reusable plugin
        import { FastifyInstance } from 'fastify';

        export default async function pagination(fastify: FastifyInstance) {
          fastify.decorateRequest('pagination', null);
          fastify.addHook('preHandler', async (request) => {
            const page = Math.max(1, Number(request.query.page) || 1);
            const limit = Math.min(100, Number(request.query.limit) || 20);
            request.pagination = { page, limit, offset: (page - 1) * limit };
          });
        }

        // src/routes/users.ts — register plugin for this scope
        export default async function userRoutes(fastify: FastifyInstance) {
          fastify.register(pagination);
          fastify.get('/', async (request) => {
            return getUsers(request.pagination);
          });
        }
      indicators:
        - "fastify.register"
        - "fastify.decorateRequest"
patterns:
  data_flow:
    direction: "Route Plugin → Service → Data Access"
    rules:
      - "Route plugins define schemas and delegate to services."
      - "Services contain business logic with no Fastify imports."
      - "Plugins manage cross-cutting concerns like auth and DB connections."
  error_handling:
    recommended: "Use Fastify's setErrorHandler for centralized error handling."
  naming:
    routes: "[resource].route.ts"
    services: "[resource].service.ts"
    schemas: "[resource].schema.ts"
anti_patterns:
  - id: no_schema
    severity: critical
    description: "Defining Fastify routes without a schema object loses type safety, automatic serialization, and OpenAPI doc generation."
    bad_example: |
      // ❌ No schema  -  no type safety or serialization
      fastify.post('/users', async (req, reply) => { ... });
    good_example: |
      // ✓ Schema-validated route
      fastify.post('/users', { schema: { body: CreateUserBody } }, handler);
  - id: business_logic_in_handler
    severity: critical
    description: "Putting business rules and DB queries directly in route handlers instead of services."
    bad_example: |
      fastify.post('/users', async (req) => {
        const hash = await bcrypt.hash(req.body.password, 10);
        return fastify.db.users.create({ ...req.body, password: hash });
      });
    good_example: |
      fastify.post('/users', { schema: { body: CreateUserBody } }, async (req) => {
        return userService.createUser(req.body);
      });
  - id: fastify_type_in_service
    severity: warning
    description: "Importing FastifyRequest or FastifyReply in service files couples business logic to the HTTP framework."
    bad_example: |
      import type { FastifyRequest } from 'fastify';
      export function handleUser(req: FastifyRequest) { ... }
    good_example: |
      export function handleUser(data: CreateUserDTO) { ... }
  - id: inline_error_responses
    severity: warning
    description: "Each route handler has its own try/catch with different error response shapes. Error formatting logic is duplicated across every route instead of centralized in setErrorHandler."
    bad_example: |
      fastify.get('/users/:id', async (request, reply) => {
        try {
          const user = await getUser(request.params.id);
          return user;
        } catch (err) {
          reply.status(500).send({ msg: err.message }); // different shape than other routes
        }
      });
    good_example: |
      // Throw and let the global error handler format consistently
      fastify.get('/users/:id', async (request) => {
        const user = await getUser(request.params.id);
        if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
        return user;
      });
  - id: manual_validation_in_handler
    severity: warning
    description: "Route handlers manually check request body fields with if/else instead of using Fastify's built-in JSON Schema validation. Schema validation is faster (compiled by Ajv), more consistent, and automatically returns structured 400 errors."
    bad_example: |
      fastify.post('/users', async (request, reply) => {
        if (!request.body.name) return reply.status(400).send({ error: 'Name required' });
        if (!request.body.email) return reply.status(400).send({ error: 'Email required' });
        // 10 more manual checks...
        return createUser(request.body);
      });
    good_example: |
      fastify.post('/users', {
        schema: { body: { type: 'object', required: ['name', 'email'], properties: {
          name: { type: 'string', minLength: 1 }, email: { type: 'string', format: 'email' }
        }}},
      }, async (request) => createUser(request.body));
      // Invalid input is rejected automatically with a structured 400 error
  - id: env_in_handlers
    severity: warning
    description: "Route handlers read process.env directly instead of importing from a validated config module. Missing variables cause runtime crashes on specific routes instead of startup failures. No type safety — all values are string | undefined."
    bad_example: |
      fastify.get('/users', async () => {
        const db = new Pool({ connectionString: process.env.DATABASE_URL }); // undefined? crash here
      });
    good_example: |
      import { config } from '../config/env'; // validated at startup
      fastify.get('/users', async () => {
        const db = new Pool({ connectionString: config.DATABASE_URL }); // guaranteed string
      });
  - id: oversized_extraction
    severity: warning
    description: "A module was extracted from a handler but is still 300+ LOC. Split into focused sub-modules by domain."
    bad_example: |
      // services/order.service.ts  -  400 LOC  -  orders, payments, inventory, notifications
    good_example: |
      // services/order.service.ts  -  100 LOC  -  order lifecycle only
      // services/payment.service.ts  -  80 LOC

---
