---
schema_version: "2.0.0"
id: drizzle
name: "Drizzle ORM"
version: "2.0.0"
description: "SQL-first Drizzle ORM with TypeScript schema as source of truth, drizzle-kit migrations, singleton database connection, inferred types, and explicit query building."
category: pattern
language: javascript
frameworks:
  - drizzle-orm
dependencies:
  none:
    - prisma
    - "@prisma/client"
    - mongoose
detection:
  dependencies:
    any:
      - drizzle-orm
  source_indicators:
    - "drizzle("
    - "pgTable("
    - "mysqlTable("
    - "sqliteTable("
    - "from 'drizzle-orm'"
structure:
  required_dirs:
    - path: src/db
      purpose: "Drizzle schema definitions in schema.ts  -  the single source of truth for all table structures and TypeScript types. Every table, column, index, and relation is defined here as TypeScript. The generated types (via `typeof users.$inferSelect`) come from these definitions  -  never from separate type files."
    - path: drizzle
      purpose: "Generated migration SQL files created by `npx drizzle-kit generate`. These files represent the canonical migration history. Never edit them manually  -  drizzle-kit detects checksum changes and may regenerate or fail on the next run."
  recommended_dirs:
    - path: src/lib
      purpose: "Drizzle database connection singleton in db.ts  -  the only place that creates the database connection and passes it to drizzle(). Imported by all repository files. Prevents multiple connections in serverless environments with the same global caching pattern as Prisma."
    - path: src/db/queries
      purpose: "Reusable query functions organized by resource  -  e.g. queries/users.ts, queries/posts.ts. Functions use Drizzle's query builder API and return typed results. Services and API routes call these functions rather than building queries inline."
separation:
  rules:
    - concern: schema_definition
      belongs_in: src/db
      rule_text: "Define all table schemas in src/db/schema.ts using Drizzle's TypeScript API. Export the table objects so that drizzle-kit can discover them for migration generation. Use `typeof table.$inferSelect` and `typeof table.$inferInsert` for type inference  -  never manually write type interfaces for database rows."
      example: |
        // src/db/schema.ts  -  single source of truth
        import { pgTable, text, timestamp, uuid, boolean } from 'drizzle-orm/pg-core';

        export const users = pgTable('users', {
          id: uuid('id').primaryKey().defaultRandom(),
          email: text('email').notNull().unique(),
          name: text('name'),
          emailVerified: boolean('email_verified').notNull().default(false),
          createdAt: timestamp('created_at').defaultNow().notNull(),
          updatedAt: timestamp('updated_at').defaultNow().notNull(),
        });

        export const posts = pgTable('posts', {
          id: uuid('id').primaryKey().defaultRandom(),
          title: text('title').notNull(),
          content: text('content'),
          userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
          publishedAt: timestamp('published_at'),
          createdAt: timestamp('created_at').defaultNow().notNull(),
        });

        // Inferred types  -  never write these manually
        export type User = typeof users.$inferSelect;
        export type NewUser = typeof users.$inferInsert;
        export type Post = typeof posts.$inferSelect;
        export type NewPost = typeof posts.$inferInsert;
      indicators:
        - "pgTable("
        - "mysqlTable("
        - "sqliteTable("
        - "$inferSelect"
        - "$inferInsert"
    - concern: database_connection
      belongs_in: src/lib
      rule_text: "Create the Drizzle database connection in src/lib/db.ts using a module-level or global singleton. Pass the underlying driver instance (e.g., postgres from 'postgres' or Pool from 'pg') to drizzle(). Never create a new connection per query or per request."
      example: |
        // src/lib/db.ts  -  singleton pattern for serverless compatibility
        import { drizzle } from 'drizzle-orm/postgres-js';
        import postgres from 'postgres';
        import * as schema from '@/db/schema';

        // Singleton: reuse connection across hot reloads in development
        const globalForDb = globalThis as unknown as {
          connection: ReturnType<typeof postgres> | undefined;
        };

        const connection =
          globalForDb.connection ??
          postgres(process.env.DATABASE_URL!, {
            max: process.env.NODE_ENV === 'production' ? 10 : 1,
          });

        if (process.env.NODE_ENV !== 'production') globalForDb.connection = connection;

        export const db = drizzle(connection, { schema });
      indicators:
        - "drizzle("
        - "DATABASE_URL"
        - "from 'drizzle-orm"
    - concern: migrations
      belongs_in: drizzle
      rule_text: "Use drizzle-kit to generate and apply migrations. Configure drizzle.config.ts with the schema path and migration output directory. Run `npx drizzle-kit generate` to create migration SQL from schema changes, and `npx drizzle-kit migrate` (or `push` for prototyping) to apply them."
      example: |
        // drizzle.config.ts  -  tells drizzle-kit where to find schema and write migrations
        import { defineConfig } from 'drizzle-kit';
        export default defineConfig({
          schema: './src/db/schema.ts',
          out: './drizzle',
          dialect: 'postgresql',
          dbCredentials: { url: process.env.DATABASE_URL! },
        });

        # Development workflow:
        # 1. Edit src/db/schema.ts
        # 2. Generate migration:
        npx drizzle-kit generate
        # 3. Apply migration:
        npx drizzle-kit migrate
        # 4. The db object's types update automatically (schema is the source)
      indicators:
        - "drizzle-kit generate"
        - "drizzle-kit migrate"
        - "drizzle.config.ts"
        - "defineConfig("
    - concern: query_building
      belongs_in: src/db/queries
      rule_text: "Use Drizzle's query builder API for all queries. For complex SQL, use the `sql` template tag with parameterized values  -  never string concatenation. Queries live in src/db/queries/ functions; services call these functions rather than building queries inline."
      example: |
        // src/db/queries/users.ts
        import { db } from '@/lib/db';
        import { users, posts } from '@/db/schema';
        import { eq, and, desc, ilike, sql } from 'drizzle-orm';

        export async function findUserByEmail(email: string) {
          return db.query.users.findFirst({
            where: eq(users.email, email),
          });
        }

        export async function listUsersWithPostCount(limit = 20) {
          return db
            .select({
              id: users.id,
              email: users.email,
              name: users.name,
              postCount: sql<number>`count(${posts.id})`.mapWith(Number),
            })
            .from(users)
            .leftJoin(posts, eq(posts.userId, users.id))
            .groupBy(users.id)
            .orderBy(desc(users.createdAt))
            .limit(limit);
        }
      anti_indicators:
        - "db.execute(`SELECT"
        - "db.execute(\"SELECT"
        - "+ email +"
    - concern: transactions
      belongs_in: src/db/queries
      rule_text: "Use db.transaction() for operations that must succeed or fail atomically. The transaction callback receives a `tx` context  -  use `tx` instead of `db` for all queries inside the transaction."
      example: |
        // src/db/queries/orders.ts
        import { db } from '@/lib/db';
        import { orders, inventory } from '@/db/schema';
        import { eq, sql } from 'drizzle-orm';

        export async function createOrderWithInventoryDecrement(
          userId: string,
          productId: string,
          quantity: number,
          price: number
        ) {
          return db.transaction(async (tx) => {
            // Atomically decrement inventory
            const [product] = await tx
              .update(inventory)
              .set({ stock: sql`${inventory.stock} - ${quantity}` })
              .where(and(eq(inventory.productId, productId), sql`${inventory.stock} >= ${quantity}`))
              .returning();

            if (!product) throw new Error('Insufficient stock');

            return tx.insert(orders).values({ userId, productId, quantity, total: price * quantity }).returning();
          });
        }
      indicators:
        - "db.transaction("
        - "tx.insert("
        - "tx.update("
patterns:
  data_flow:
    direction: "API Route/Server Action → Service → Query Function (src/db/queries/) → Drizzle → Database"
    rules:
      - "src/db/schema.ts is the source of truth  -  TypeScript types are inferred from it, never written manually."
      - "db in src/lib/db.ts is the only Drizzle instance  -  imported by all query files."
      - "Query functions in src/db/queries/ own all SQL  -  services call these functions, never db.select() directly."
      - "Migrations are generated by drizzle-kit from schema changes  -  never write migration SQL manually."
      - "Use $inferSelect and $inferInsert for parameter and return types  -  keeps types in sync with schema automatically."
  error_handling:
    recommended: "Drizzle does not wrap errors  -  database errors bubble as driver-level errors. Check error.code: '23505' = PostgreSQL unique violation, '23503' = foreign key violation. Wrap in try/catch in repositories."
  naming:
    schema: "src/db/schema.ts  -  all pgTable/mysqlTable definitions with $inferSelect/$inferInsert exports"
    connection: "src/lib/db.ts  -  drizzle(connection, { schema }) singleton"
    queries: "src/db/queries/[resource].ts  -  e.g. users.ts, posts.ts"
    config: "drizzle.config.ts  -  drizzle-kit configuration at project root"
anti_patterns:
  - id: raw_sql_strings
    severity: warning
    description: "Building SQL queries with string concatenation or unparameterized template literals. Even with Drizzle available, some developers fall back to raw strings when queries get complex. This loses type safety and creates SQL injection risk."
    bad_example: |
      // ❌ String concatenation  -  SQL injection risk, no type safety
      const email = req.body.email;
      await db.execute(`SELECT * FROM users WHERE email = '${email}'`);
      // If email = "' OR '1'='1" → returns all users
    good_example: |
      // ✓ Drizzle query builder  -  parameterized and type-safe
      import { eq } from 'drizzle-orm';
      const user = await db.select().from(users).where(eq(users.email, email));

      // ✓ For complex SQL: use sql tag with parameters (not string concat)
      import { sql } from 'drizzle-orm';
      const result = await db.execute(sql`SELECT * FROM users WHERE email = ${email}`);
  - id: multiple_db_connections
    severity: critical
    description: "Creating a new Drizzle instance (and underlying driver connection/pool) in multiple files instead of importing from src/lib/db.ts. In serverless environments, each function invocation may create a new connection pool, exhausting database connections under load."
    bad_example: |
      // ❌ New drizzle instance in every repository file
      // src/db/queries/users.ts
      import postgres from 'postgres';
      import { drizzle } from 'drizzle-orm/postgres-js';
      const db = drizzle(postgres(process.env.DATABASE_URL!)); // new connection pool

      // src/db/queries/posts.ts
      const db = drizzle(postgres(process.env.DATABASE_URL!)); // another pool
    good_example: |
      // ✓ Import the singleton from src/lib/db.ts everywhere
      import { db } from '@/lib/db';
      const users = await db.select().from(usersTable).where(eq(usersTable.id, id));
  - id: schema_outside_db_dir
    severity: warning
    description: "Defining table schemas outside src/db/schema.ts. drizzle-kit looks for schemas in the path configured in drizzle.config.ts  -  schemas defined elsewhere are invisible to the migration tool and won't generate migrations."
    bad_example: |
      // ❌ Schema scattered in model files  -  drizzle-kit can't find it
      // src/models/user.model.ts
      export const users = pgTable('users', { id: text('id') });
      // drizzle-kit generate → no migration generated for this table
    good_example: |
      // ✓ All schemas in src/db/schema.ts  -  drizzle-kit finds them all
      // drizzle.config.ts: schema: './src/db/schema.ts'
      export const users = pgTable('users', { id: uuid('id').primaryKey() });
  - id: manual_type_interfaces
    severity: warning
    description: "Writing TypeScript interfaces for database row types by hand instead of using `typeof table.$inferSelect`. When the schema changes, the manual interface goes stale  -  the database returns columns the interface doesn't know about, or the interface references columns that no longer exist."
    bad_example: |
      // ❌ Manual type  -  gets out of sync when schema changes
      interface User {
        id: string;
        email: string;
        name: string; // What if 'name' is renamed to 'fullName' in the schema?
      }
    good_example: |
      // ✓ Inferred type  -  always in sync with schema.ts
      import { users } from '@/db/schema';
      export type User = typeof users.$inferSelect;
      export type NewUser = typeof users.$inferInsert;
  - id: push_in_production
    severity: critical
    description: "Using `npx drizzle-kit push` in production environments. `push` modifies the database directly without creating a migration file  -  there is no migration history, no rollback path, and no CI/CD audit trail. Use `push` only for local prototyping; use `migrate` in all deployed environments."
    bad_example: |
      # ❌ In production CI/CD pipeline  -  no migration history
      npx drizzle-kit push
      # Database changed but no migration file created  -  next deploy may push again
    good_example: |
      # ✓ Production: apply versioned migrations from the drizzle/ directory
      npx drizzle-kit migrate
      # Each migration is a timestamped SQL file with a checksum  -  safe to replay

---
