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

The following rules come from the **Express.js REST API** architecture blueprint. Treat them as
hard constraints  -  they are not suggestions. Every file move you make must end up satisfying
these rules.

- routing -> src/routes
  Rule: Route files define HTTP endpoints and delegate request flow to controllers. They should not contain persistence or business rules.
  Example:
    router.get('/users', UserController.list);
    router.post('/users', UserController.create);

- request_handling -> src/controllers
  Rule: Controllers translate req/res objects into plain inputs for services and shape the HTTP response from service results.
  Example:
    export async function create(req, res) {
      const user = await userService.create(req.body);
      res.status(201).json(user);
    }

- business_logic -> src/services
  Rule: Services contain business rules and orchestration. They accept plain data and return plain data without touching HTTP objects.
  Example:
    export async function createUser(input) {
      await validateUser(input);
      return userModel.create(input);
    }

- data_access -> src/models
  Rule: Models and repositories own database queries and persistence details so higher layers stay storage-agnostic.
  Example:
    export async function createUserRecord(data) {
      return prisma.user.create({ data });
    }

- error_handling -> src/middleware
  Rule: Centralize error handling in a single Express error middleware at the end of the middleware chain. Define a custom AppError class that carries an HTTP status code and error code. Route handlers and services throw AppError instances — the error middleware catches them, logs, and returns a consistent JSON response. Never let raw Error objects or stack traces reach the client.
  Example:
    // src/middleware/error-handler.ts
    import { Request, Response, NextFunction } from 'express';
    import { AppError } from '../utils/errors';
    
    export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ error: err.code, message: err.message });
      }
      console.error('Unhandled error:', err);
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong' });
    }
    
    // src/utils/errors.ts
    export class AppError extends Error {
      constructor(public statusCode: number, public code: string, message: string) {
        super(message);
      }
    }

- dependency_injection -> src/services
  Rule: Services receive their dependencies (database client, external API clients, config) as constructor or function parameters — never import and instantiate them directly. This enables unit testing with mocks and swapping implementations without changing service code. Controllers create services with real dependencies; tests create them with mocks.
  Example:
    // src/services/user.service.ts — dependencies injected
    import type { PrismaClient } from '@prisma/client';
    
    export function createUserService(db: PrismaClient) {
      return {
        async getUser(id: string) {
          return db.user.findUnique({ where: { id } });
        },
        async createUser(data: { name: string; email: string }) {
          return db.user.create({ data });
        },
      };
    }
    
    // src/controllers/user.controller.ts — wires real deps
    import { prisma } from '../lib/db';
    import { createUserService } from '../services/user.service';
    const userService = createUserService(prisma);
    
    // tests/services/user.service.test.ts — wires mock deps
    const mockDb = { user: { findUnique: vi.fn(), create: vi.fn() } };
    const service = createUserService(mockDb as any);

- shared_middleware -> src/middleware
  Rule: Extract repeated cross-cutting logic (pagination, filtering, sorting, rate limiting) into reusable middleware or utility functions. If the same pattern appears in 2+ route handlers, extract it. Middleware is defined once in src/middleware/ and applied declaratively via router.use() or per-route.
  Example:
    // src/middleware/paginate.ts — reusable across all list endpoints
    import { Request, Response, NextFunction } from 'express';
    
    export function paginate(defaultLimit = 20) {
      return (req: Request, _res: Response, next: NextFunction) => {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, parseInt(req.query.limit as string) || defaultLimit);
        req.pagination = { page, limit, offset: (page - 1) * limit };
        next();
      };
    }
    
    // src/routes/users.ts — applied declaratively
    router.get('/', paginate(), UserController.list);

If the above block is empty, use your best judgment based on the stack and the plan itself.

## Anti-patterns to avoid

After each step, verify you have not introduced any of the following:

- god_file [critical]
  Single file mixes routes, data access, validation, and business logic.
  Bad example:
    app.post('/users', async (req, res) => {
      const hash = await bcrypt.hash(req.body.password, 10);
      const user = await db.query('INSERT INTO users ...');
      res.status(201).json(user);
    });
  Good example:
    // src/routes/users.ts  -  route only delegates
    router.post('/users', UserController.create);
    
    // src/controllers/users.controller.ts  -  translates HTTP to plain data
    export async function create(req: Request, res: Response) {
      const user = await userService.createUser(req.body);
      res.status(201).json(user);
    }
    
    // src/services/users.service.ts  -  business rules, no HTTP awareness
    export async function createUser(input: CreateUserDTO) {
      const hash = await bcrypt.hash(input.password, 10);
      return userModel.create({ ...input, password: hash });
    }

- raw_sql_in_routes [warning]
  SQL queries appear directly in route handlers.
  Bad example:
    router.get('/users', async (req, res) => {
      const rows = await db.query('SELECT * FROM users');
      res.json(rows);
    });
  Good example:
    router.get('/users', UserController.list);

- hardcoded_secrets [critical]
  Secrets or credentials are hardcoded in source files.
  Bad example:
    const jwtSecret = 'super-secret-key';
  Good example:
    // src/config/index.ts  -  validated at startup, never scattered across the app
    import { z } from 'zod';
    const env = z.object({
      JWT_SECRET: z.string().min(32),
      DATABASE_URL: z.string().url(),
    }).parse(process.env);
    export const config = {
      auth: { jwtSecret: env.JWT_SECRET },
      db: { url: env.DATABASE_URL },
    };
    
    // In middleware  -  reads from config, not from process.env
    import { config } from '@/config';
    const jwtSecret = config.auth.jwtSecret;

- swallowed_errors [warning]
  Empty catch blocks or catch blocks that only log and continue silently. The caller never learns the operation failed, leading to corrupted state or misleading success responses.
  Bad example:
    try {
      await db.query('INSERT INTO users...');
    } catch (err) {
      console.log(err); // swallowed — caller thinks insert succeeded
    }
    res.json({ success: true });
  Good example:
    try {
      await db.query('INSERT INTO users...');
      res.json({ success: true });
    } catch (err) {
      next(new AppError(500, 'DB_ERROR', 'Failed to create user'));
    }

- hardcoded_dependencies [warning]
  Services import and instantiate their own database client, HTTP client, or config directly. This makes them impossible to unit test without mocking the module system, and couples them to specific implementations.
  Bad example:
    // src/services/user.service.ts — imports db directly
    import { prisma } from '../lib/db';
    export async function getUser(id: string) {
      return prisma.user.findUnique({ where: { id } }); // can't test without real DB or module mock
    }
  Good example:
    // Dependencies passed in — testable with any implementation
    export function createUserService(db: PrismaClient) {
      return { async getUser(id: string) { return db.user.findUnique({ where: { id } }); } };
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
