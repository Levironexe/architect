---
schema_version: "2.0.0"
id: clerk-auth
name: "Clerk Auth"
version: "2.0.0"
description: "Managed authentication with Clerk  -  middleware route protection, server/client user access patterns, webhook database sync, and organization-based multi-tenancy."
category: pattern
language: javascript
frameworks:
  - clerk
dependencies:
  none:
    - next-auth
    - "@supabase/ssr"
    - lucia
detection:
  dependencies:
    any:
      - "@clerk/nextjs"
      - "@clerk/clerk-sdk-node"
      - "@clerk/clerk-react"
  source_indicators:
    - "ClerkProvider"
    - "clerkMiddleware"
    - "auth()"
    - "currentUser()"
    - "useUser()"
    - "useAuth()"
structure:
  required_dirs:
    - path: app/api/webhooks/clerk
      purpose: "Clerk webhook handler route  -  receives user.created, user.updated, and user.deleted events pushed by Clerk's servers. Must verify the Svix signature on every incoming request before touching the database  -  no signature check means attackers can forge any user lifecycle event."
  recommended_dirs:
    - path: src/lib
      purpose: "Server-only Clerk helpers  -  auth() call wrappers, organization guard functions, and backend Clerk SDK calls (e.g., clerkClient().users.updateUserMetadata). Never import from here in Client Components ('use client' files)."
    - path: middleware.ts
      purpose: "Project root middleware file  -  clerkMiddleware() runs before every page render and API call, enforcing public vs. protected route separation. Only one middleware.ts is allowed per Next.js project; it must be at the root alongside app/."
separation:
  rules:
    - concern: route_protection
      belongs_in: middleware.ts
      rule_text: "Use clerkMiddleware() in middleware.ts to protect routes. Define public routes with createRouteMatcher  -  every other route is protected by default and redirects to sign-in. Never add per-page auth checks in layout.tsx or page.tsx as a substitute for middleware."
      example: |
        // middleware.ts  -  runs before every request
        import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

        const isPublicRoute = createRouteMatcher([
          '/sign-in(.*)',
          '/sign-up(.*)',
          '/api/webhooks/(.*)',
          '/',
        ]);

        export default clerkMiddleware(async (auth, req) => {
          if (!isPublicRoute(req)) await auth.protect();
        });

        export const config = {
          matcher: [
            '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
            '/(api|trpc)(.*)',
          ],
        };
      indicators:
        - "clerkMiddleware"
        - "createRouteMatcher"
        - "auth.protect()"
        - "isPublicRoute"
    - concern: server_user_access
      belongs_in: app
      rule_text: "In Server Components and API route handlers, use auth() from @clerk/nextjs/server to get the current session (userId, orgId). For full user profile data (name, email, imageUrl), use currentUser()  -  it makes a network call to Clerk's API so only call it when the profile data is actually needed."
      example: |
        // app/dashboard/page.tsx  -  Server Component
        import { auth, currentUser } from '@clerk/nextjs/server';
        import { redirect } from 'next/navigation';

        export default async function DashboardPage() {
          const { userId } = await auth();
          if (!userId) redirect('/sign-in');

          // Only call currentUser() when you need profile fields beyond userId
          const user = await currentUser();
          return <h1>Welcome, {user?.firstName}</h1>;
        }

        // app/api/user/route.ts  -  API route
        import { auth } from '@clerk/nextjs/server';
        export async function GET() {
          const { userId } = await auth();
          if (!userId) return new Response('Unauthorized', { status: 401 });
          const userData = await db.user.findUnique({ where: { clerkId: userId } });
          return Response.json(userData);
        }
      indicators:
        - "from '@clerk/nextjs/server'"
        - "auth()"
        - "currentUser()"
        - "userId"
    - concern: client_user_access
      belongs_in: components
      rule_text: "In Client Components, use useUser(), useAuth(), or useClerk() hooks from @clerk/nextjs. These hooks read from the ClerkProvider context  -  they work only inside components rendered below <ClerkProvider> in the tree. Use for display-only UI (avatars, names, role badges)  -  never for access control decisions."
      example: |
        // components/user-avatar.tsx  -  Client Component
        'use client';
        import { useUser } from '@clerk/nextjs';

        export function UserAvatar() {
          const { user, isLoaded, isSignedIn } = useUser();

          // isLoaded prevents hydration mismatch
          if (!isLoaded) return <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse" />;
          if (!isSignedIn) return null;

          return (
            <img
              src={user.imageUrl}
              alt={user.fullName ?? 'User avatar'}
              className="h-8 w-8 rounded-full"
            />
          );
        }
      indicators:
        - "useUser()"
        - "useAuth()"
        - "useClerk()"
        - "from '@clerk/nextjs'"
    - concern: webhook_sync
      belongs_in: app/api/webhooks/clerk
      rule_text: "Verify the Svix signature before processing any webhook event. Sync user lifecycle events (user.created, user.updated, user.deleted) to your database. Store Clerk's userId as a NOT NULL UNIQUE 'clerkId' column in your users table  -  never store email alone because users can change their email in Clerk's dashboard."
      example: |
        // app/api/webhooks/clerk/route.ts
        import { Webhook } from 'svix';
        import { headers } from 'next/headers';
        import type { WebhookEvent } from '@clerk/nextjs/server';

        export async function POST(req: Request) {
          const body = await req.text();
          const h = await headers();

          const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
          // wh.verify() throws WebhookVerificationError on invalid signature
          const event = wh.verify(body, {
            'svix-id': h.get('svix-id')!,
            'svix-timestamp': h.get('svix-timestamp')!,
            'svix-signature': h.get('svix-signature')!,
          }) as WebhookEvent;

          switch (event.type) {
            case 'user.created':
              await db.user.create({
                data: {
                  clerkId: event.data.id,
                  email: event.data.email_addresses[0].email_address,
                  name: `${event.data.first_name} ${event.data.last_name}`.trim(),
                },
              });
              break;
            case 'user.updated':
              await db.user.update({
                where: { clerkId: event.data.id },
                data: { email: event.data.email_addresses[0].email_address },
              });
              break;
            case 'user.deleted':
              await db.user.delete({ where: { clerkId: event.data.id! } });
              break;
          }

          return new Response('OK', { status: 200 });
        }
      indicators:
        - "Webhook"
        - "svix"
        - "CLERK_WEBHOOK_SECRET"
        - "WebhookEvent"
        - "svix-signature"
    - concern: organization_access
      belongs_in: app
      rule_text: "For multi-tenant apps, read orgId from auth() and filter every database query by it. Switching organizations in Clerk's UI rotates the orgId in the session  -  your database queries automatically see only the new org's data. Never derive the organization from user metadata or a custom header."
      example: |
        // app/projects/page.tsx  -  scoped to active organization
        import { auth } from '@clerk/nextjs/server';
        import { redirect } from 'next/navigation';

        export default async function ProjectsPage() {
          const { userId, orgId } = await auth();
          if (!userId) redirect('/sign-in');
          if (!orgId) redirect('/select-org'); // user hasn't selected an org yet

          // Every query filtered by orgId  -  no cross-tenant data leaks
          const projects = await db.project.findMany({
            where: { orgId },
            orderBy: { createdAt: 'desc' },
          });

          return <ProjectList projects={projects} />;
        }
      indicators:
        - "orgId"
        - "orgRole"
        - "useOrganization()"
        - "useOrganizationList()"
        - "orgSlug"
patterns:
  data_flow:
    direction: "HTTP Request → clerkMiddleware (protect or allow) → Server Component (auth()) → Service/DB"
    rules:
      - "Middleware runs first  -  protected routes redirect to sign-in before any page code executes."
      - "Server Components call auth() for session (userId, orgId) and currentUser() for profile data  -  currentUser() costs an extra network call so only call it when needed."
      - "Client Components use useUser()/useAuth() hooks  -  they read from ClerkProvider context already in the page, zero extra network call."
      - "Webhooks are the bridge from Clerk's managed user store to your relational database  -  sync on user.created/updated/deleted events."
      - "For multi-tenant apps: auth() → { userId, orgId } → every DB query includes orgId in WHERE clause."
      - "publicMetadata and privateMetadata must only be mutated from Server Actions or API routes, never from Client Components."
  error_handling:
    recommended: "Use auth.protect() in middleware for route-level protection. For API routes not covered by middleware, check auth().userId and return 401 when null. For org-scoped routes, check auth().orgId and redirect to /select-org when null."
  naming:
    middleware: "middleware.ts at project root  -  clerkMiddleware() must be the outermost and only middleware"
    webhook_handler: "app/api/webhooks/clerk/route.ts  -  POST handler with Svix signature verification"
    server_helper: "src/lib/auth.ts  -  reusable server-side auth wrappers (requireAuth, requireOrg)"
    db_field: "clerkId  -  NOT NULL UNIQUE column in users table; stores Clerk's userId string (format: user_XXXX)"
    org_db_field: "orgId  -  NOT NULL column on organization-scoped tables; stores Clerk's orgId string (format: org_XXXX)"
anti_patterns:
  - id: manual_token_handling
    severity: critical
    description: "Manually reading, parsing, or verifying Clerk JWTs or __session cookies instead of using Clerk's auth() helper. This breaks when Clerk rotates signing keys (which happens automatically), and bypasses session freshness checks, leaving stale or forged tokens accepted."
    bad_example: |
      // ❌ Manual JWT parsing  -  breaks on key rotation, bypasses Clerk's checks
      import jwt from 'jsonwebtoken';
      const token = req.headers.authorization?.split(' ')[1];
      const decoded = jwt.verify(token, process.env.CLERK_PEM_KEY!);
      const userId = (decoded as any).sub;
      // This will silently break the next time Clerk rotates its signing key
    good_example: |
      // ✓ Clerk's auth() handles verification, key rotation, and session refresh automatically
      import { auth } from '@clerk/nextjs/server';
      const { userId } = await auth();
      if (!userId) return new Response('Unauthorized', { status: 401 });
  - id: unverified_webhook
    severity: critical
    description: "Processing Clerk webhook payloads without verifying the Svix HMAC signature. Any attacker who discovers your webhook endpoint URL can POST fabricated user.created or user.deleted events  -  creating phantom users, deleting real users, or granting admin roles without ever touching Clerk's dashboard."
    bad_example: |
      // ❌ No signature verification  -  endpoint is open to forgery
      export async function POST(req: Request) {
        const payload = await req.json();
        // Blindly trusting the payload type and data
        if (payload.type === 'user.created') {
          await db.user.create({
            data: { clerkId: payload.data.id, role: 'admin' }, // forged!
          });
        }
        return new Response('OK');
      }
    good_example: |
      // ✓ Svix verification throws WebhookVerificationError on tampered requests
      import { Webhook } from 'svix';
      const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
      const event = wh.verify(body, svixHeaders) as WebhookEvent;
      // Only reaches here if signature is valid
      if (event.type === 'user.created') {
        await db.user.create({ data: { clerkId: event.data.id } });
      }
  - id: client_component_auth_check
    severity: warning
    description: "Using useUser() or useAuth() to gate protected content or navigation in Client Components. Client-side auth can be bypassed by disabling JavaScript, using browser DevTools to modify React state, or navigating directly via URL. Always enforce access control in middleware or Server Components."
    bad_example: |
      // ❌ Client-side guard  -  content flashes and is bypassable with DevTools
      'use client';
      import { useAuth } from '@clerk/nextjs';
      export function AdminPanel() {
        const { isSignedIn } = useAuth();
        if (!isSignedIn) return null; // briefly visible during hydration; bypassable
        return <DangerousAdminActions />;
      }
    good_example: |
      // ✓ Server Component  -  auth check happens before any HTML is sent
      import { auth } from '@clerk/nextjs/server';
      import { redirect } from 'next/navigation';
      export default async function AdminPage() {
        const { userId } = await auth();
        if (!userId) redirect('/sign-in');
        return <DangerousAdminActions />;
      }
      // OR: add /admin to isPublicRoute exclusion in middleware.ts (simplest)
  - id: missing_clerk_provider
    severity: critical
    description: "Not wrapping the root layout with <ClerkProvider>. All Clerk client hooks (useUser, useAuth, useClerk, SignInButton, UserButton) throw a React context error at runtime because they expect to find ClerkProvider as an ancestor in the component tree."
    bad_example: |
      // app/layout.tsx  -  missing ClerkProvider
      export default function RootLayout({ children }: { children: React.ReactNode }) {
        return (
          <html lang="en">
            <body>{children}</body>
            {/* Any child that calls useUser() crashes:
                Error: useUser() called outside <ClerkProvider> */}
          </html>
        );
      }
    good_example: |
      // app/layout.tsx  -  ClerkProvider wraps the entire app
      import { ClerkProvider } from '@clerk/nextjs';
      export default function RootLayout({ children }: { children: React.ReactNode }) {
        return (
          <ClerkProvider>
            <html lang="en">
              <body>{children}</body>
            </html>
          </ClerkProvider>
        );
      }
  - id: org_id_not_enforced
    severity: warning
    description: "In multi-tenant apps, querying the database without filtering by orgId. Users authenticated to organization A can read or modify organization B's data because the tenant boundary is not applied to the query."
    bad_example: |
      // ❌ Returns ALL projects regardless of the user's current organization
      const { userId } = await auth();
      // orgId is available but ignored  -  org B members see org A's data
      const projects = await db.project.findMany({ where: { createdBy: userId } });
    good_example: |
      // ✓ Scope every query to the authenticated user's active organization
      const { userId, orgId } = await auth();
      if (!orgId) redirect('/select-organization');
      const projects = await db.project.findMany({
        where: { orgId }, // org boundary enforced at query level
      });
  - id: metadata_mutation_on_client
    severity: warning
    description: "Updating Clerk publicMetadata from a Client Component via the browser SDK. The client-side user.update() call is made with the user's own session, meaning any user can call it with arbitrary values  -  including promoting themselves to 'admin'. All metadata writes must go through a Server Action that validates permissions first."
    bad_example: |
      // ❌ Client-side metadata write  -  user can call update() with any role value
      'use client';
      import { useUser } from '@clerk/nextjs';
      export function UpgradeButton() {
        const { user } = useUser();
        const upgrade = () => user?.update({ unsafeMetadata: { plan: 'enterprise' } });
        return <button onClick={upgrade}>Upgrade</button>;
      }
    good_example: |
      // ✓ Server Action validates the request before mutating metadata
      'use server';
      import { auth, clerkClient } from '@clerk/nextjs/server';
      export async function upgradePlan(targetUserId: string) {
        const { sessionClaims } = await auth();
        // Only admins can upgrade other users
        if (sessionClaims?.publicMetadata?.role !== 'admin') {
          throw new Error('Forbidden');
        }
        await (await clerkClient()).users.updateUserMetadata(targetUserId, {
          publicMetadata: { plan: 'enterprise' },
        });
      }

---
