---
schema_version: "2.0.0"
id: supabase-auth
name: "Supabase Auth"
version: "2.0.0"
description: "Supabase built-in authentication with SSR session management via @supabase/ssr, RLS row-level security policies tied to auth.uid(), OAuth callback routes, and middleware session refresh."
category: pattern
language: javascript
frameworks:
  - supabase
dependencies:
  none:
    - "@clerk/nextjs"
    - next-auth
    - lucia
detection:
  dependencies:
    any:
      - "@supabase/ssr"
      - "@supabase/supabase-js"
  source_indicators:
    - "supabase.auth.signIn"
    - "supabase.auth.signUp"
    - "auth.uid()"
    - "exchangeCodeForSession"
    - "createServerClient"
    - "supabase.auth.getUser"
structure:
  required_dirs:
    - path: app/auth
      purpose: "Supabase auth UI routes and OAuth callback handler. The callback route at app/auth/callback/route.ts is mandatory for all OAuth providers  -  it exchanges the one-time code from Supabase's redirect URL for a session cookie. Without it, OAuth sign-in always fails."
  recommended_dirs:
    - path: src/lib
      purpose: "Supabase client factory functions  -  one file for server contexts (createClient reading from Next.js cookies) and one for browser contexts (createBrowserClient). These files are imported by Server Components, API routes, middleware, and Client Components respectively. Never mix them."
    - path: middleware.ts
      purpose: "Session refresh middleware  -  calls supabase.auth.getUser() on every request to refresh the session cookie before it expires. Without this, users are silently logged out when their session cookie ages past the expiry window even if they are actively using the app."
separation:
  rules:
    - concern: ssr_sessions
      belongs_in: src/lib
      rule_text: "Use @supabase/ssr (not @supabase/supabase-js directly) for Next.js and server-rendered apps. Create a server client in src/lib/supabase-server.ts that reads and writes session cookies using Next.js cookie utilities. Create a browser client in src/lib/supabase-browser.ts for Client Components."
      example: |
        // src/lib/supabase-server.ts  -  for Server Components, API routes, middleware
        import { createServerClient } from '@supabase/ssr';
        import { cookies } from 'next/headers';

        export async function createClient() {
          const cookieStore = await cookies();
          return createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
              cookies: {
                getAll: () => cookieStore.getAll(),
                setAll: (cookiesToSet) => {
                  cookiesToSet.forEach(({ name, value, options }) =>
                    cookieStore.set(name, value, options)
                  );
                },
              },
            }
          );
        }

        // src/lib/supabase-browser.ts  -  for Client Components only
        import { createBrowserClient } from '@supabase/ssr';
        export const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
      indicators:
        - "createServerClient"
        - "@supabase/ssr"
        - "createBrowserClient"
        - "exchangeCodeForSession"
    - concern: middleware_refresh
      belongs_in: middleware.ts
      rule_text: "Call supabase.auth.getUser() in middleware on every request to refresh the session cookie. This keeps short-lived access tokens alive as long as the user is active. Without middleware refresh, sessions expire mid-visit even when the user is actively interacting with the app."
      example: |
        // middleware.ts
        import { createServerClient } from '@supabase/ssr';
        import { NextResponse, type NextRequest } from 'next/server';

        export async function middleware(request: NextRequest) {
          let supabaseResponse = NextResponse.next({ request });

          const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
              cookies: {
                getAll: () => request.cookies.getAll(),
                setAll: (cookiesToSet) => {
                  cookiesToSet.forEach(({ name, value, options }) => {
                    request.cookies.set(name, value);
                    supabaseResponse.cookies.set(name, value, options);
                  });
                },
              },
            }
          );

          // Refreshes the session if expired  -  MUST NOT be removed
          const { data: { user } } = await supabase.auth.getUser();

          if (!user && !request.nextUrl.pathname.startsWith('/login')) {
            const url = request.nextUrl.clone();
            url.pathname = '/login';
            return NextResponse.redirect(url);
          }

          return supabaseResponse;
        }
      indicators:
        - "supabase.auth.getUser()"
        - "createServerClient"
        - "supabaseResponse"
    - concern: rls_integration
      belongs_in: src/lib
      rule_text: "Every table that stores user data must have Row Level Security enabled and at least one policy using auth.uid(). Supabase Auth's primary security mechanism is RLS  -  authenticated queries still see all rows if no policy restricts them. Write policies before writing application code."
      example: |
        -- Enable RLS on every user-data table (run in Supabase SQL editor)
        ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
        ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
        ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

        -- Policy: users can only read, create, update, and delete their own rows
        CREATE POLICY "own posts" ON posts
          FOR ALL
          USING (auth.uid() = user_id)
          WITH CHECK (auth.uid() = user_id);

        -- Policy: profiles are readable by everyone but only editable by owner
        CREATE POLICY "public profiles read" ON profiles
          FOR SELECT USING (true);
        CREATE POLICY "own profile write" ON profiles
          FOR ALL USING (auth.uid() = id);
      indicators:
        - "auth.uid()"
        - "USING ("
        - "CREATE POLICY"
        - "ROW LEVEL SECURITY"
    - concern: social_providers
      belongs_in: app/auth
      rule_text: "Configure OAuth providers in the Supabase dashboard (Authentication > Providers)  -  not in code. Create a mandatory callback route at app/auth/callback/route.ts that calls supabase.auth.exchangeCodeForSession() to convert the one-time OAuth code into a session cookie."
      example: |
        // app/auth/callback/route.ts  -  mandatory for all OAuth providers
        import { createServerClient } from '@supabase/ssr';
        import { cookies } from 'next/headers';
        import { NextResponse } from 'next/server';

        export async function GET(request: Request) {
          const { searchParams, origin } = new URL(request.url);
          const code = searchParams.get('code');
          const next = searchParams.get('next') ?? '/';

          if (code) {
            const cookieStore = await cookies();
            const supabase = createServerClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              { cookies: { getAll: () => cookieStore.getAll(), setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
            );
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (!error) {
              return NextResponse.redirect(`${origin}${next}`);
            }
          }

          return NextResponse.redirect(`${origin}/auth/auth-code-error`);
        }
      indicators:
        - "exchangeCodeForSession"
        - "app/auth/callback"
        - "searchParams.get('code')"
    - concern: server_component_auth
      belongs_in: app
      rule_text: "In Server Components, call supabase.auth.getUser() (not getSession()) to get the authenticated user. getUser() validates the token with Supabase's server  -  getSession() only reads the local cookie which can be forged. Always use getUser() for security-sensitive decisions."
      example: |
        // app/dashboard/page.tsx  -  Server Component with auth check
        import { createClient } from '@/lib/supabase-server';
        import { redirect } from 'next/navigation';

        export default async function DashboardPage() {
          const supabase = await createClient();
          // getUser() validates with Supabase server  -  getSession() does NOT
          const { data: { user }, error } = await supabase.auth.getUser();
          if (error || !user) redirect('/login');

          const { data: posts } = await supabase
            .from('posts')
            .select('*')
            .eq('user_id', user.id); // RLS also enforces this at DB level

          return <PostList posts={posts ?? []} />;
        }
      indicators:
        - "supabase.auth.getUser()"
        - "from('@/lib/supabase-server')"
patterns:
  data_flow:
    direction: "Request → Middleware (session refresh) → Server Component (getUser) → RLS-enforced Supabase Query → Database"
    rules:
      - "Middleware refreshes the session cookie on every request  -  without it users get silently logged out mid-session."
      - "Server Components call supabase.auth.getUser() for the authenticated user  -  never getSession() for security decisions."
      - "Client Components use the browser client from supabase-browser.ts  -  it reads the session from localStorage."
      - "RLS policies enforce per-user data isolation at the database level  -  authenticated queries still need policies to restrict rows."
      - "The OAuth callback route at app/auth/callback/route.ts is the mandatory landing point for all social provider sign-ins."
      - "Service role key is only used server-side for admin operations that intentionally bypass RLS  -  never in browser code."
  error_handling:
    recommended: "Always call supabase.auth.getUser() (not getSession()) for auth decisions  -  getUser() validates with Supabase's server. Check both error and data.user being null. Redirect to /login when no valid session."
  naming:
    callback_route: "app/auth/callback/route.ts  -  OAuth code exchange via exchangeCodeForSession()"
    server_client: "src/lib/supabase-server.ts  -  SSR client reading session from cookies (@supabase/ssr)"
    browser_client: "src/lib/supabase-browser.ts  -  browser client (createBrowserClient from @supabase/ssr)"
    rls_policies: "Named 'own [resource]'  -  e.g. 'own posts', 'own profiles'; reference auth.uid() = user_id"
anti_patterns:
  - id: no_rls_with_auth
    severity: critical
    description: "Using Supabase Auth to authenticate users but not creating RLS policies. All authenticated users can read and modify each other's data  -  enabling auth without RLS does not provide any data isolation. This is the most common Supabase security mistake."
    bad_example: |
      -- ❌ RLS enabled but no policies  -  Supabase defaults to DENY for anon,
      -- but ALL authenticated users can read ALL rows from each other
      ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
      -- Missing: CREATE POLICY
      -- Any signed-in user: SELECT * FROM posts → sees every user's posts
    good_example: |
      -- ✓ RLS with per-user policy  -  each user only sees their own rows
      ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "own posts" ON posts
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
  - id: get_session_for_auth_decisions
    severity: critical
    description: "Using supabase.auth.getSession() to verify authentication instead of supabase.auth.getUser(). getSession() reads the local session cookie without validating it with Supabase's server  -  a forged or replayed cookie will pass getSession() but fail getUser()."
    bad_example: |
      // ❌ getSession() only reads the cookie  -  can be forged
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) redirect('/login');
      // session.user is from the unvalidated cookie  -  not trustworthy
      const userId = session.user.id;
    good_example: |
      // ✓ getUser() validates with Supabase's auth server  -  cannot be forged
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) redirect('/login');
      const userId = user.id; // validated server-side
  - id: direct_supabase_js_on_server
    severity: warning
    description: "Using @supabase/supabase-js createClient() in Server Components instead of @supabase/ssr createServerClient(). The plain createClient() has no way to read Next.js cookie storage  -  it cannot find the user session and all authenticated queries run as anonymous."
    bad_example: |
      // ❌ Plain supabase-js on server  -  can't read session cookies
      import { createClient } from '@supabase/supabase-js';
      const supabase = createClient(URL, ANON_KEY);
      // supabase.auth.getUser() always returns null  -  session is invisible
      const { data: { user } } = await supabase.auth.getUser(); // user = null
    good_example: |
      // ✓ SSR client reads session from Next.js cookie store
      import { createClient } from '@/lib/supabase-server';
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser(); // user = authenticated user
  - id: missing_callback_route
    severity: warning
    description: "Using OAuth social login (GitHub, Google, etc.) without an auth callback route. When Supabase redirects back after OAuth, there is nowhere to exchange the one-time code for a session  -  the user lands on the redirect URL with a 404 or a broken page."
    bad_example: |
      // ❌ No callback route  -  sign-in with OAuth always fails with a broken redirect
      await supabase.auth.signInWithOAuth({ provider: 'github' });
      // Supabase redirects to: /auth/callback?code=... → 404 Not Found
    good_example: |
      // ✓ app/auth/callback/route.ts exists and calls exchangeCodeForSession()
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(`${origin}/dashboard`);
  - id: missing_middleware_refresh
    severity: warning
    description: "Not running session refresh in middleware. Supabase access tokens expire after 1 hour by default. Without middleware calling getUser() on each request, the session cookie ages and the user is silently logged out even while actively using the app."
    bad_example: |
      // middleware.ts  -  missing or empty, no session refresh
      export function middleware(req: NextRequest) {
        return NextResponse.next(); // session cookie never refreshed
      }
      // User gets logged out every hour even while actively using the app
    good_example: |
      // ✓ Middleware calls supabase.auth.getUser() which refreshes the access token
      const supabase = createServerClient(URL, KEY, { cookies: { ... } });
      await supabase.auth.getUser(); // side effect: refreshes session if near expiry
  - id: insecure_rls_policy
    severity: critical
    description: "Writing an RLS policy with USING (true) which grants full access to all authenticated users  -  equivalent to having no RLS at all. Often introduced by accident when following generic Supabase examples."
    bad_example: |
      -- ❌ USING (true) grants every authenticated user full table access
      CREATE POLICY "allow all" ON posts
        FOR ALL USING (true);
      -- Any logged-in user can read, update, or delete any other user's posts
    good_example: |
      -- ✓ Scope the policy to the authenticated user's own rows
      CREATE POLICY "own posts" ON posts
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);

---
