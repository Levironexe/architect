---
schema_version: "2.0.0"
id: nextjs-app-router
name: "Next.js App Router"
version: "1.1.0"
description: "Next.js App Router structure with app routes, layouts, server components, server actions, shared UI, and data-access helpers properly separated."
category: stack
language: javascript
frameworks:
  - next
  - react
detection:
  dependencies:
    any:
      - next
  files:
    - next.config.js
    - next.config.mjs
    - next.config.ts
    - app
  source_indicators:
    - "next/"
    - "\"use client\""
    - "'use client'"
structure:
  required_dirs:
    - path: app
      purpose: "App Router entry point. Contains only Next.js file-convention files: layout.tsx, page.tsx, loading.tsx, error.tsx, route.ts. No business logic or reusable components live here."
    - path: components
      purpose: "Reusable React components shared across multiple routes. Components here must not import from app/  -  they receive data as props or use shared hooks."
    - path: lib
      purpose: "Server-side data access, third-party SDK wrappers, and shared utilities. All database queries and external API calls live here so they can be reused by server components, actions, and route handlers."
  recommended_dirs:
    - path: actions
      purpose: "Server Actions for form mutations and data mutations. Each file begins with 'use server'. Actions call lib/ functions  -  they do not access the database directly."
    - path: hooks
      purpose: "Client-only React hooks that encapsulate stateful browser behaviour (useLocalStorage, useDebounce). Must not import server-only modules."
separation:
  rules:
    - concern: routing
      belongs_in: app
      rule_text: "The app directory owns route structure using App Router file conventions (layout.tsx, page.tsx, loading.tsx, error.tsx, route.ts). Pages are thin: they call lib/ functions and pass data to components. No inline SQL, fetch wrappers, or reusable UI definitions inside page.tsx files."
      example: |
        // app/users/page.tsx  -  correct: thin page, delegates to lib and components
        import { listUsers } from '@/lib/users';
        import { UsersTable } from '@/components/users-table';

        export default async function UsersPage() {
          const users = await listUsers();
          return <UsersTable users={users} />;
        }
      indicators:
        - "app/"
        - "layout.tsx"
        - "page.tsx"
        - "route.ts"
    - concern: shared_ui
      belongs_in: components
      rule_text: "Reusable React components belong in components/ so route files stay focused on composition and data loading. A component should receive data as props and not perform its own data fetching unless it is an explicitly-marked client component using SWR/React Query."
      example: |
        // components/users-table.tsx  -  server-safe, pure presentational
        import type { User } from '@/lib/users';

        export function UsersTable({ users }: { users: User[] }) {
          return (
            <table>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}><td>{user.name}</td></tr>
                ))}
              </tbody>
            </table>
          );
        }
      anti_indicators:
        - "prisma"
        - "sql`"
        - "drizzle"
    - concern: business_logic
      belongs_in: lib
      rule_text: "All business logic, data fetching, and database interaction lives in lib/ as plain async functions. Pages, components, and Server Actions import from lib/ — they never contain direct database calls, SDK usage, or business rules inline. Each domain gets its own file (lib/users.ts, lib/products.ts). This is the service layer for Next.js App Router projects."
      example: |
        // lib/users.ts  -  business logic + data access
        import { prisma } from '@/lib/db';

        export async function listUsers() {
          return prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
        }

        export async function createUser(data: { name: string; email: string }) {
          return prisma.user.create({ data });
        }
      indicators:
        - "prisma."
        - "sql`"
        - "drizzle"
        - "mongoose"
    - concern: server_action
      belongs_in: actions
      rule_text: "Server Actions for mutations and form handling live in actions/ with an explicit 'use server' directive at the top of the file. Actions validate input, call lib/ functions, and revalidate cache  -  they do not contain SQL or SDK calls directly."
      example: |
        // actions/user-actions.ts
        'use server';

        import { revalidatePath } from 'next/cache';
        import { createUser } from '@/lib/users';
        import { z } from 'zod';

        const schema = z.object({ name: z.string().min(1) });

        export async function createUserAction(formData: FormData) {
          const { name } = schema.parse({ name: formData.get('name') });
          await createUser({ name });
          revalidatePath('/users');
        }
      indicators:
        - "\"use server\""
        - "'use server'"
    - concern: error_handling
      belongs_in: app
      rule_text: "Use Next.js error.tsx file convention for UI error boundaries in every route segment that fetches data. Server Actions must not throw errors to the client — instead catch errors and return typed result objects like { success: false, error: string }. lib/ functions throw; Server Actions catch and translate. API routes (route.ts) use try/catch and return NextResponse with appropriate status codes."
      example: |
        // app/users/error.tsx — catches rendering/data errors for this route
        'use client';
        export default function UsersError({ error, reset }: { error: Error; reset: () => void }) {
          return (
            <div>
              <h2>Something went wrong loading users</h2>
              <button onClick={reset}>Try again</button>
            </div>
          );
        }

        // actions/user-actions.ts — returns result, never throws to client
        'use server';
        import { createUser } from '@/lib/users';
        export async function createUserAction(formData: FormData) {
          try {
            const user = await createUser({ name: formData.get('name') as string });
            return { success: true, user };
          } catch (err) {
            return { success: false, error: 'Failed to create user' };
          }
        }
      indicators:
        - "error.tsx"
        - "{ success: false"
        - "{ success: true"
    - concern: security
      belongs_in: lib
      rule_text: "Never import server-only secrets in files that could be included in the client bundle. Use the 'server-only' package to poison client imports of sensitive modules. Server Actions must call auth() before any data mutation. API routes (route.ts) must verify authentication before processing requests. Environment variables without the NEXT_PUBLIC_ prefix are server-only — never destructure them in client components."
      example: |
        // lib/db.ts — import 'server-only' prevents accidental client inclusion
        import 'server-only';
        import { PrismaClient } from '@prisma/client';
        export const prisma = new PrismaClient();

        // actions/user-actions.ts — always verify auth before mutation
        'use server';
        import { auth } from '@/lib/auth';
        export async function deleteUser(userId: string) {
          const session = await auth();
          if (!session) throw new Error('Unauthorized');
          await prisma.user.delete({ where: { id: userId } });
        }
      indicators:
        - "server-only"
        - "auth()"
        - "NEXT_PUBLIC_"
    - concern: configuration
      belongs_in: lib
      rule_text: "Read all environment variables in src/lib/config.ts, validate with Zod, and export a typed object. Server-only secrets (DATABASE_URL, JWT_SECRET) must NOT use the NEXT_PUBLIC_ prefix. Client-safe values use NEXT_PUBLIC_ and are available in both server and client code. Import 'server-only' in config files that contain secrets to prevent accidental client inclusion."
      example: |
        // src/lib/config.ts
        import 'server-only';
        import { z } from 'zod';

        const serverSchema = z.object({
          DATABASE_URL: z.string().url(),
          JWT_SECRET: z.string().min(32),
        });

        export const serverConfig = serverSchema.parse(process.env);

        // src/lib/client-config.ts — safe for client
        const clientSchema = z.object({
          NEXT_PUBLIC_APP_URL: z.string().url(),
          NEXT_PUBLIC_APP_NAME: z.string().default('My App'),
        });

        export const clientConfig = clientSchema.parse({
          NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
          NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
        });
      indicators:
        - "config.ts"
        - "serverConfig"
        - "NEXT_PUBLIC_"
        - "server-only"
    - concern: dependency_injection
      belongs_in: lib
      rule_text: "lib/ functions accept dependencies as optional parameters with production defaults. This enables testing without module mocking. For example, a function that queries the database accepts a db parameter that defaults to the real Prisma client but can be overridden in tests with a mock."
      example: |
        // lib/users.ts — injectable for testing
        import { prisma as defaultDb } from '@/lib/db';
        import type { PrismaClient } from '@prisma/client';

        export async function listUsers(db: PrismaClient = defaultDb) {
          return db.user.findMany({ orderBy: { createdAt: 'desc' } });
        }

        // tests/lib/users.test.ts
        const mockDb = { user: { findMany: vi.fn().mockResolvedValue([]) } };
        const users = await listUsers(mockDb as any);
        expect(mockDb.user.findMany).toHaveBeenCalled();
      indicators:
        - "= defaultDb"
        - "db: PrismaClient"
patterns:
  data_flow:
    direction: "app/page.tsx -> lib/ -> database/external API; actions/ -> lib/ -> database"
    rules:
      - "Use React Server Components by default. Only add 'use client' when the component needs browser APIs, event handlers, or client-side state."
      - "Push 'use client' as far down the component tree as possible to maximize server-rendered surface."
      - "Use loading.tsx and error.tsx file conventions for every route segment that performs async data fetching."
      - "Never access process.env directly in components or lib/  -  import from a centralized config module."
  naming:
    routes: "Use App Router file conventions: page.tsx, layout.tsx, loading.tsx, error.tsx, not-found.tsx, route.ts. Use (group) folders for layout sharing without URL impact. Use _folder prefix for private non-routable helpers colocated with routes."
    components: "Use PascalCase for component files (UsersTable.tsx) and function names. Use kebab-case for utility and hook files (use-debounce.ts)."
anti_patterns:
  - id: use_client_everywhere
    severity: warning
    description: "The 'use client' directive is placed at the top of layout, page, or large wrapper components rather than pushed down to only the leaf components that actually need browser interactivity. This unnecessarily turns large component subtrees into client bundles, increasing JavaScript shipped to the browser."
    bad_example: |
      // app/dashboard/layout.tsx  -  wrong: entire layout becomes a client bundle
      'use client';

      export default function DashboardLayout({ children }: { children: React.ReactNode }) {
        return <div className="dashboard">{children}</div>;
      }
    good_example: |
      // app/dashboard/layout.tsx  -  server component, no directive needed
      export default function DashboardLayout({ children }: { children: React.ReactNode }) {
        return <div className="dashboard">{children}</div>;
      }

      // components/dashboard-nav.tsx  -  only the interactive nav is a client component
      'use client';
      import { useState } from 'react';
      export function DashboardNav() { /* toggle state, event handlers */ }
  - id: client_data_fetching_by_default
    severity: warning
    description: "Data fetching is moved to client components using useEffect/useState without a user interaction requirement. This delays the first meaningful paint, exposes API endpoints unnecessarily, and forfeits React Server Component streaming and caching benefits."
    bad_example: |
      'use client';

      export default function UsersPage() {
        const [users, setUsers] = useState([]);
        useEffect(() => {
          fetch('/api/users').then((r) => r.json()).then(setUsers);
        }, []);
        return <UsersTable users={users} />;
      }
    good_example: |
      // Server component  -  data fetches on the server before any HTML is sent
      import { listUsers } from '@/lib/users';
      import { UsersTable } from '@/components/users-table';

      export default async function UsersPage() {
        const users = await listUsers();
        return <UsersTable users={users} />;
      }
  - id: direct_db_in_page
    severity: critical
    description: "Database queries or external API calls are made directly inside page.tsx or layout.tsx files instead of being encapsulated in lib/. This scatters data-access logic across the route tree, makes it impossible to reuse queries in Server Actions or Route Handlers, and prevents centralized error handling and logging."
    bad_example: |
      // app/users/page.tsx  -  wrong: database logic inside the page
      import { prisma } from '@/lib/prisma';

      export default async function UsersPage() {
        const users = await prisma.user.findMany({ where: { active: true } });
        return <UserList users={users} />;
      }
    good_example: |
      // lib/users.ts  -  all user queries live here
      import { prisma } from './prisma';
      export async function listActiveUsers() {
        return prisma.user.findMany({ where: { active: true } });
      }

      // app/users/page.tsx  -  page calls lib, never touches prisma directly
      import { listActiveUsers } from '@/lib/users';
      export default async function UsersPage() {
        const users = await listActiveUsers();
        return <UserList users={users} />;
      }
  - id: server_action_throws
    severity: warning
    description: "Server Actions throw errors instead of returning typed result objects. When a Server Action throws, Next.js shows a generic error boundary or the error is lost — the client component cannot distinguish between error types or show specific messages."
    bad_example: |
      // actions/user-actions.ts — throws to client
      'use server';
      export async function createUserAction(formData: FormData) {
        const user = await createUser(formData); // throws on failure — client gets generic error
        return user;
      }
    good_example: |
      // actions/user-actions.ts — returns typed result
      'use server';
      export async function createUserAction(formData: FormData) {
        try {
          const user = await createUser(formData);
          return { success: true as const, user };
        } catch {
          return { success: false as const, error: 'Failed to create user' };
        }
      }
  - id: leaked_server_secret
    severity: critical
    description: "Importing a module that reads process.env secrets (database URL, API keys) inside a Client Component or a file without 'server-only' guard. Next.js may bundle the secret into client JavaScript, exposing it to anyone who inspects the page source."
    bad_example: |
      // components/dashboard.tsx
      'use client';
      import { prisma } from '@/lib/db'; // db module reads DATABASE_URL — now in client bundle!
    good_example: |
      // lib/db.ts — add server-only guard
      import 'server-only';
      import { PrismaClient } from '@prisma/client';
      // Client Components that try to import this will get a build error
  - id: scattered_process_env
    severity: warning
    description: "process.env.NEXT_PUBLIC_* and process.env.DATABASE_URL read directly in lib/ functions, Server Actions, and components. No validation, no typing, no single source of truth. If a variable name changes, every file must be updated."
    bad_example: |
      // scattered across lib/db.ts, lib/auth.ts, actions/user.ts
      const url = process.env.DATABASE_URL!; // ! hides the undefined risk
    good_example: |
      // src/lib/config.ts — single source, validated at build/startup
      export const serverConfig = serverSchema.parse(process.env);
      // everywhere else:
      import { serverConfig } from '@/lib/config';
  - id: direct_db_in_route
    severity: critical
    description: "Database queries or ORM calls are made directly inside API route handlers (route.ts) instead of delegating to service/lib functions. This scatters data-access logic, makes routes untestable, and duplicates queries across GET/POST/PUT handlers."
    bad_example: |
      // app/api/users/route.ts  -  wrong: prisma inside route handler
      import { prisma } from '@/lib/db';
      export async function GET() {
        const users = await prisma.user.findMany({ where: { active: true } });
        return Response.json(users);
      }
    good_example: |
      // app/api/users/route.ts  -  correct: delegates to lib
      import { listActiveUsers } from '@/lib/users';
      export async function GET() {
        const users = await listActiveUsers();
        return Response.json(users);
      }
  - id: alert_for_errors
    severity: warning
    description: "Using window.alert() or alert() to display errors to the user. Alert blocks the UI thread, cannot be styled, provides no actionable context, and is impossible to test. Use toast notifications or inline error messages instead."
    bad_example: |
      // components/user-form.tsx
      const handleSubmit = async () => {
        const result = await createUser(data);
        if (!result.success) {
          alert(result.error);  // blocks UI, not testable, ugly
        }
      };
    good_example: |
      // components/user-form.tsx
      const handleSubmit = async () => {
        const result = await createUser(data);
        if (!result.success) {
          setError(result.error);  // inline error state, testable
          // or: toast.error(result.error);  // non-blocking notification
        }
      };
  - id: oversized_extraction
    severity: warning
    description: "A component or module was extracted from a page to a separate file, but the extracted file is still 300+ LOC. This just moved the god file — it did not solve the modularity problem. After extraction, split further into focused sub-components."
    bad_example: |
      // components/admin-content.tsx  -  595 LOC  -  just moved from app/admin/page.tsx
      'use client';
      export function AdminContent() {
        // 600 lines of mixed tabs, forms, tables, state management
      }
    good_example: |
      // components/admin/admin-content.tsx  -  80 LOC orchestrator
      import { UsersTab } from './users-tab';
      import { AuditTab } from './audit-tab';
      import { SettingsTab } from './settings-tab';
      export function AdminContent() {
        const [tab, setTab] = useState('users');
        return <Tabs><UsersTab /><AuditTab /><SettingsTab /></Tabs>;
      }
  - id: auth_mechanism_mismatch
    severity: critical
    description: "The login flow uses one auth mechanism (e.g., custom localStorage blob, manual JWT) but API route guards check a different one (e.g., Supabase session, NextAuth getServerSession). The two systems never connect — every authenticated API request will be rejected. This creates false security confidence: the guards look correct but block all real users."
    bad_example: |
      // login/page.tsx — stores custom blob
      localStorage.setItem('user', JSON.stringify({ email, role }));
      
      // api/route.ts — checks Supabase token (never issued by login!)
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    good_example: |
      // login/page.tsx — uses the same auth system as the guards
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      // session stored automatically in cookie/localStorage by Supabase
      
      // api/route.ts — checks the same Supabase session
      const { data: { user } } = await supabase.auth.getUser(token);
      // works because login actually created a Supabase session

---
