---
schema_version: "2.0.0"
id: prisma
name: "Prisma ORM"
version: "2.0.0"
description: "Schema-first Prisma ORM with singleton client, repository/model pattern, migration-only schema changes, error handling for known request errors, and N+1 prevention via include/select."
category: pattern
language: javascript
frameworks:
  - prisma
dependencies:
  none:
    - drizzle-orm
    - mongoose
    - sequelize
detection:
  dependencies:
    any:
      - prisma
      - "@prisma/client"
  source_indicators:
    - "PrismaClient"
    - "prisma.$"
    - "from '@prisma/client'"
    - "prisma.user."
    - "prisma.post."
structure:
  required_dirs:
    - path: prisma
      purpose: "Prisma schema file (schema.prisma) and migration history. The only place where the database schema is defined  -  all table structure, relations, and enums live here. Any schema change must go through `npx prisma migrate dev` to generate a migration file and update the generated Prisma Client."
    - path: prisma/migrations
      purpose: "Auto-generated migration SQL files created by `npx prisma migrate dev`. Never edit these files manually  -  Prisma tracks their checksums and will refuse to apply migrations if they are modified after generation."
    - path: src/lib
      purpose: "Prisma Client singleton in db.ts  -  the one and only place that calls `new PrismaClient()`. All repositories and services import the prisma instance from here. Prevents connection pool exhaustion in serverless environments where each cold start could otherwise create a new pool."
  recommended_dirs:
    - path: src/repositories
      purpose: "Data access layer  -  one file per Prisma model (e.g., user.repository.ts). All prisma.user.*(), prisma.post.*() calls belong here. Services call repository functions; they never import prisma directly. This makes the data layer mockable in unit tests."
    - path: src/services
      purpose: "Business logic layer  -  orchestrates calls to one or more repositories, validates input, applies rules, and returns domain objects. Never calls prisma directly."
separation:
  rules:
    - concern: singleton_client
      belongs_in: src/lib
      rule_text: "Create exactly one PrismaClient instance using the global singleton pattern in src/lib/db.ts. In serverless/Next.js environments, Hot Module Replacement recreates modules on every file save  -  without the global pattern, each save creates a new PrismaClient and a new connection pool until connections are exhausted."
      example: |
        // src/lib/db.ts  -  the only file that calls new PrismaClient()
        import { PrismaClient } from '@prisma/client';

        const globalForPrisma = globalThis as unknown as {
          prisma: PrismaClient | undefined;
        };

        export const prisma =
          globalForPrisma.prisma ??
          new PrismaClient({
            log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
          });

        if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
      anti_indicators:
        - "new PrismaClient()"
    - concern: migrations
      belongs_in: prisma/migrations
      rule_text: "All schema changes must go through the Prisma migration system. Use `npx prisma migrate dev --name description` in development and `npx prisma migrate deploy` in production CI/CD. Never run raw `ALTER TABLE` or `CREATE TABLE` SQL manually  -  it breaks migration history and Prisma Client type generation."
      example: |
        # Development: creates migration file + applies it + regenerates Prisma Client
        npx prisma migrate dev --name add-phone-to-users

        # Production CI/CD: applies pending migrations without interactive prompts
        npx prisma migrate deploy

        # After pulling schema changes: regenerate Prisma Client types locally
        npx prisma generate
      indicators:
        - "prisma migrate dev"
        - "prisma migrate deploy"
        - "prisma generate"
    - concern: data_access
      belongs_in: src/repositories
      rule_text: "Prisma queries live in src/repositories/ or src/models/. Services and API routes call repository functions  -  they never import prisma directly. Repository functions own the select/include shape of queries, handle errors, and return typed domain objects."
      example: |
        // src/repositories/user.repository.ts
        import { prisma } from '@/lib/db';
        import type { Prisma } from '@prisma/client';

        export async function findUserById(id: string) {
          return prisma.user.findUnique({
            where: { id },
            select: { id: true, email: true, name: true, createdAt: true },
            // Exclude: password hash, internal fields
          });
        }

        export async function createUser(data: Prisma.UserCreateInput) {
          return prisma.user.create({ data });
        }

        export async function listUsersWithPosts(limit = 20) {
          return prisma.user.findMany({
            take: limit,
            include: { posts: { take: 5, orderBy: { createdAt: 'desc' } } },
            orderBy: { createdAt: 'desc' },
          });
        }
      indicators:
        - "prisma.user."
        - "prisma.post."
        - ".findMany("
        - ".findUnique("
        - "from '@/lib/db'"
    - concern: transactions
      belongs_in: src/repositories
      rule_text: "Use prisma.$transaction() for operations that must succeed or fail together. Interactive transactions (callback form) support dependent queries where the second query uses the result of the first. Batch transactions (array form) are faster for independent mutations."
      example: |
        // src/repositories/order.repository.ts
        export async function createOrderWithInventoryUpdate(
          userId: string,
          productId: string,
          quantity: number
        ) {
          return prisma.$transaction(async (tx) => {
            // Check and decrement inventory atomically
            const product = await tx.product.update({
              where: { id: productId, stock: { gte: quantity } },
              data: { stock: { decrement: quantity } },
            });

            // Create the order using updated product data
            return tx.order.create({
              data: { userId, productId, quantity, total: product.price * quantity },
            });
          });
        }
      indicators:
        - "prisma.$transaction"
        - "$transaction("
patterns:
  data_flow:
    direction: "API Route/Server Action → Service → Repository → Prisma Client → Database"
    rules:
      - "API routes and Server Actions call service functions only  -  never prisma directly."
      - "Services contain business logic and call repository functions  -  never prisma directly."
      - "Repositories are the only files that import prisma from src/lib/db.ts."
      - "Migrations run via `prisma migrate`  -  never raw SQL."
      - "Prisma Client types are regenerated after every schema change with `prisma generate`."
      - "For N+1 prevention: use include/select in repositories rather than loading relations in loops."
  error_handling:
    recommended: "Catch PrismaClientKnownRequestError in repositories. P2002 = unique constraint violation (duplicate email), P2025 = record not found (delete/update of non-existent row), P2003 = foreign key constraint violation."
  naming:
    schema: "prisma/schema.prisma  -  single data model source of truth"
    client: "src/lib/db.ts  -  exports the prisma singleton"
    repositories: "src/repositories/[model].repository.ts  -  e.g. user.repository.ts, post.repository.ts"
    models: "src/models/[model].model.ts  -  domain model classes wrapping repository calls"
anti_patterns:
  - id: multiple_prisma_clients
    severity: critical
    description: "Calling `new PrismaClient()` in multiple files instead of importing the singleton. Each PrismaClient creates its own connection pool. In serverless environments (Vercel, Lambda), each function invocation can create a new pool  -  leading to database 'too many connections' errors under moderate traffic."
    bad_example: |
      // ❌ New PrismaClient in every file  -  separate connection pool per module
      // src/repositories/user.repository.ts
      import { PrismaClient } from '@prisma/client';
      const prisma = new PrismaClient(); // pool #1

      // src/repositories/post.repository.ts
      import { PrismaClient } from '@prisma/client';
      const prisma = new PrismaClient(); // pool #2  -  now two pools competing
    good_example: |
      // ✓ Import the singleton everywhere  -  one pool for the entire process
      // src/lib/db.ts: export const prisma = globalThis.prisma ?? new PrismaClient();
      import { prisma } from '@/lib/db';
  - id: prisma_in_route_handler
    severity: critical
    description: "Calling prisma directly in API route handlers, Server Actions, or React components. This bypasses the service/repository layer, makes the code untestable (can't mock prisma calls in unit tests), and scatters query logic across the codebase."
    bad_example: |
      // ❌ Direct prisma call in API route  -  no service layer, untestable
      import { prisma } from '@/lib/db';
      export async function GET() {
        const users = await prisma.user.findMany({
          include: { posts: true },
        });
        return Response.json(users);
      }
    good_example: |
      // ✓ API route calls service, service calls repository
      import { userService } from '@/services/user.service';
      export async function GET() {
        const users = await userService.listUsersWithPosts();
        return Response.json(users);
      }
      // src/services/user.service.ts calls userRepository.listWithPosts()
      // src/repositories/user.repository.ts calls prisma.user.findMany(...)
  - id: manual_sql_migration
    severity: warning
    description: "Modifying the database schema with raw SQL (ALTER TABLE, CREATE TABLE) instead of Prisma's migration system. The migration history becomes out of sync with the schema.prisma file  -  `prisma migrate deploy` in production applies migrations that have already been applied or skips needed ones."
    bad_example: |
      -- ❌ Manual SQL bypasses Prisma migration tracking
      -- Run directly in DB console:
      ALTER TABLE users ADD COLUMN phone VARCHAR(20);
      -- schema.prisma still has no phone field  -  Prisma Client has no phone type
    good_example: |
      // ✓ 1. Add field in schema.prisma
      // model User { phone String? }
      // 2. Generate + apply migration:
      // npx prisma migrate dev --name add-phone-to-users
      // 3. Prisma Client regenerated automatically  -  phone field is now typed
  - id: n_plus_one_query
    severity: warning
    description: "Loading a list of records and then fetching their relations in a loop  -  creates N+1 database queries (1 for the list + N for each record's relations). Use Prisma's include or nested select to fetch everything in a single query."
    bad_example: |
      // ❌ N+1: 1 query for posts + 1 query per post for the author
      const posts = await prisma.post.findMany(); // query 1
      for (const post of posts) {
        post.author = await prisma.user.findUnique({ where: { id: post.userId } }); // N queries
      }
    good_example: |
      // ✓ Single query: posts JOIN users via include
      const posts = await prisma.post.findMany({
        include: { author: { select: { id: true, name: true, email: true } } },
      });
  - id: unhandled_known_request_error
    severity: warning
    description: "Not catching PrismaClientKnownRequestError  -  unique constraint violations (P2002) and not-found errors (P2025) crash with an unhandled error instead of returning a user-friendly message. These errors are predictable and must be handled explicitly."
    bad_example: |
      // ❌ Unique constraint crash surfaces as a 500 Internal Server Error
      export async function createUser(email: string) {
        return prisma.user.create({ data: { email } });
        // If email already exists: Unhandled PrismaClientKnownRequestError P2002
      }
    good_example: |
      // ✓ Catch known errors and return domain-appropriate responses
      import { Prisma } from '@prisma/client';
      export async function createUser(email: string) {
        try {
          return await prisma.user.create({ data: { email } });
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError) {
            if (e.code === 'P2002') throw new Error('Email already in use');
          }
          throw e;
        }
      }
  - id: select_star_in_production
    severity: warning
    description: "Using findMany() or findUnique() without a select clause  -  fetches all columns including password hashes, internal flags, and large text fields. Always specify exactly what fields you need, especially in API responses."
    bad_example: |
      // ❌ Returns all fields including passwordHash, internalFlags, etc.
      export async function GET() {
        const users = await prisma.user.findMany(); // returns passwordHash!
        return Response.json(users);
      }
    good_example: |
      // ✓ Explicit select  -  only the fields the client needs
      const users = await prisma.user.findMany({
        select: { id: true, email: true, name: true, createdAt: true },
        // passwordHash, internalFlags, etc. never leave the DB layer
      });
composition:
  - when_combined_with: nextjs-app-router
    additional_phases:
      - name: "Prisma Singleton Setup"
        description: "Create shared PrismaClient instance in src/lib/db.ts using the global singleton pattern for Next.js HMR safety."
        priority: 1
      - name: "Server Action Data Layer"
        description: "Move direct Prisma calls from API routes to lib/ functions. Server Actions call lib/, lib/ calls Prisma."
        priority: 7
  - when_combined_with: express-api
    additional_phases:
      - name: "Prisma Repository Layer"
        description: "Create src/repositories/ with one file per model. Services call repositories, repositories call Prisma."
        priority: 2

---
