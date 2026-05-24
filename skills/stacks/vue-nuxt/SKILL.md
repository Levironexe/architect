---
schema_version: "2.0.0"
id: vue-nuxt
name: "Nuxt 3"
version: "1.1.0"
description: "Full-stack Nuxt 3 with auto-imports, composables, Nitro server routes, and Pinia state management."
category: stack
language: javascript
frameworks:
  - nuxt
  - vue
detection:
  dependencies:
    any:
      - nuxt
  source_indicators:
    - "defineNuxtConfig"
    - "nuxt.config"
    - "useNuxtApp"
structure:
  required_dirs:
    - path: pages
      purpose: "File-based route components  -  each .vue file maps directly to a URL path. Pages are thin: they call composables for data and delegate rendering to components. No business logic or direct API calls in page components."
    - path: components
      purpose: "Reusable Vue components auto-imported by Nuxt  -  no import statement needed. Components receive data via props and emit events; they must not call useFetch or useAsyncData directly."
    - path: composables
      purpose: "Reusable stateful logic using Vue Composition API  -  auto-imported. Composables own local or feature-scoped reactive state. For state that must survive navigation or be shared between distant components, use a Pinia store instead."
    - path: server/api
      purpose: "Server-side Nitro API route handlers auto-discovered by filename ([resource].[method].ts). Handlers call server/utils/ functions  -  they must not embed business logic or SQL directly."
  recommended_dirs:
    - path: server/middleware
      purpose: "Nitro server-side middleware that runs on every request: auth token validation, rate limiting, CORS headers. Executes before server/api/ route handlers."
    - path: stores
      purpose: "Pinia stores for global state that must persist across route navigations or be shared between unrelated components (auth session, shopping cart, notifications). Local UI state that belongs to one component or page stays as composable state  -  not in a store."
    - path: utils
      purpose: "Auto-imported pure utility functions with no Vue or Nuxt dependency (formatDate, slugify, truncate). Must be synchronous and side-effect-free."
    - path: server/utils
      purpose: "Server-side utility functions and service layer shared across server/api/ route handlers. Database queries, third-party API wrappers, and business logic live here  -  never inline in event handlers."
separation:
  rules:
    - concern: data_fetching
      belongs_in: composables
      rule_text: "Use useFetch() or useAsyncData() inside composables, not directly in page components. This enables reuse, keeps pages declarative, and supports SSR hydration without duplication."
      example: |
        // composables/useUsers.ts
        export function useUsers() {
          return useFetch('/api/users');
        }
        // pages/users.vue
        const { data: users } = useUsers();
      indicators:
        - "useFetch"
        - "useAsyncData"
    - concern: server_routes
      belongs_in: server/api
      rule_text: "Server routes in server/api/ use defineEventHandler(). They call services or utilities for business logic  -  no DB queries directly in event handlers."
      example: |
        // server/api/users.get.ts
        export default defineEventHandler(async (event) => {
          return getUsersService();
        });
    - concern: auto_imports
      belongs_in: components
      rule_text: "Nuxt auto-imports components, composables, and utils. Do NOT add explicit import statements for these  -  let Nuxt's auto-import system handle it."
      example: |
        // ✓ Just use it  -  Nuxt handles the import
        const { data } = useUsers();
      anti_indicators:
        - "import { use"
        - "from '~/composables"
        - "from '~/components"
    - concern: error_handling
      belongs_in: composables
      rule_text: "Use Nuxt's error.vue page for fatal errors and createError() for expected HTTP errors in server routes. Composables wrap $fetch calls and return typed error state — components never call $fetch directly. Server API routes (server/api/) use createError() to return structured error responses. Client-side composables use useAsyncData or useFetch which provide built-in error refs."
      example: |
        // error.vue — global error page
        <script setup lang="ts">
        const props = defineProps<{ error: { statusCode: number; message: string } }>();
        const handleClear = () => clearError({ redirect: '/' });
        </script>
        <template>
          <div>
            <h1>{{ error.statusCode }}</h1>
            <p>{{ error.message }}</p>
            <button @click="handleClear">Go home</button>
          </div>
        </template>

        // server/api/users/[id].get.ts — structured error
        export default defineEventHandler(async (event) => {
          const id = getRouterParam(event, 'id');
          const user = await findUser(id);
          if (!user) throw createError({ statusCode: 404, message: 'User not found' });
          return user;
        });
      indicators:
        - "createError"
        - "error.vue"
        - "clearError"
    - concern: security
      belongs_in: server
      rule_text: "Keep secrets server-side using runtimeConfig (not public runtimeConfig). Use Nuxt auth middleware for route protection. Server API routes (server/api/) validate all input before processing. Never expose database credentials or API secrets to the client bundle — only values in runtimeConfig.public reach the browser."
      example: |
        // nuxt.config.ts — server secrets never reach the client
        export default defineNuxtConfig({
          runtimeConfig: {
            databaseUrl: process.env.DATABASE_URL, // server-only
            apiSecret: process.env.API_SECRET,       // server-only
            public: {
              appName: 'My App', // safe — visible to browser
            },
          },
        });

        // middleware/auth.ts — route guard
        export default defineNuxtRouteMiddleware((to) => {
          const { loggedIn } = useUserSession();
          if (!loggedIn.value && to.path !== '/login') {
            return navigateTo('/login');
          }
        });
      indicators:
        - "runtimeConfig"
        - "defineNuxtRouteMiddleware"
        - "useUserSession"
    - concern: configuration
      belongs_in: nuxt.config.ts
      rule_text: "Define all configuration in nuxt.config.ts runtimeConfig. Server-only secrets go in the top-level runtimeConfig object; client-safe values go in runtimeConfig.public. Access via useRuntimeConfig() in composables and server routes — never read process.env directly. Validate required config at app startup using a Nitro plugin."
      example: |
        // nuxt.config.ts
        export default defineNuxtConfig({
          runtimeConfig: {
            dbUrl: process.env.DATABASE_URL,        // server-only
            jwtSecret: process.env.JWT_SECRET,      // server-only
            public: {
              appName: process.env.NUXT_PUBLIC_APP_NAME || 'My App',
            },
          },
        });

        // server/plugins/validate-config.ts — fail fast on missing config
        export default defineNitroPlugin(() => {
          const config = useRuntimeConfig();
          if (!config.dbUrl) throw new Error('DATABASE_URL is required');
          if (!config.jwtSecret) throw new Error('JWT_SECRET is required');
        });

        // Usage: const config = useRuntimeConfig();
      indicators:
        - "useRuntimeConfig"
        - "runtimeConfig"
        - "NUXT_PUBLIC_"
    - concern: testability
      belongs_in: tests
      rule_text: "Unit test composables and utility functions with Vitest — they are plain TypeScript, no Vue runtime needed. Test components with @vue/test-utils and mount(). Server API routes (server/api/) can be tested by importing the handler and calling it with mock events. Organize tests mirroring the source structure: tests/composables/, tests/components/, tests/server/."
      example: |
        // tests/composables/useCounter.test.ts
        import { describe, it, expect } from 'vitest';
        import { useCounter } from '~/composables/useCounter';

        describe('useCounter', () => {
          it('increments count', () => {
            const { count, increment } = useCounter();
            expect(count.value).toBe(0);
            increment();
            expect(count.value).toBe(1);
          });
        });

        // tests/components/UserCard.test.ts
        import { mount } from '@vue/test-utils';
        import UserCard from '~/components/UserCard.vue';

        it('renders user name', () => {
          const wrapper = mount(UserCard, { props: { name: 'Alice' } });
          expect(wrapper.text()).toContain('Alice');
        });
      indicators:
        - "@vue/test-utils"
        - "mount("
        - "useCounter"
    - concern: composable_reuse
      belongs_in: composables
      rule_text: "Extract repeated stateful logic into composables in composables/. If the same ref + watch + onMounted pattern appears in 2+ components, extract it as a composable. Shared utility functions (pure, no Vue reactivity) go in utils/. Never duplicate fetch + error + loading state management — use useFetch() or a custom composable."
      example: |
        // composables/useSearch.ts — extracted from 3 components that had the same pattern
        export function useSearch<T>(fetchFn: (query: string) => Promise<T[]>) {
          const query = ref('');
          const results = ref<T[]>([]);
          const loading = ref(false);

          const search = useDebounceFn(async () => {
            loading.value = true;
            results.value = await fetchFn(query.value);
            loading.value = false;
          }, 300);

          watch(query, search);
          return { query, results, loading };
        }
      indicators:
        - "composables/"
        - "useDebounceFn"
        - "export function use"
patterns:
  data_flow:
    direction: "Page → Composable → useFetch/useAsyncData → Server Route → Service"
    rules:
      - "Pages use composables for data fetching  -  not useFetch directly."
      - "Server API routes handle business logic via server utilities."
      - "Pinia stores manage global client-side state."
  error_handling:
    recommended: "Use createError() in server routes and useError() in pages for unified error handling."
  naming:
    composables: "use[Resource].ts"
    stores: "[resource].store.ts"
    server_routes: "[resource].[method].ts"
anti_patterns:
  - id: explicit_auto_imports
    severity: warning
    description: "Writing explicit import statements for components, composables, or utils that Nuxt auto-imports adds noise and can cause confusion."
    bad_example: |
      // ❌ Nuxt auto-imports this  -  explicit import is redundant
      import { useUsers } from '~/composables/useUsers';
    good_example: |
      // ✓ Just use it  -  Nuxt handles the import automatically
      const { data } = useUsers();
  - id: db_in_page_component
    severity: critical
    description: "Querying databases directly in page or layout components instead of going through server routes."
    bad_example: |
      // ❌ DB access in a page component  -  only works server-side, breaks hydration
      const users = await prisma.user.findMany();
    good_example: |
      // ✓ Page → composable → server route → service
      const { data: users } = useUsers();
  - id: fetch_in_component
    severity: warning
    description: "Using useFetch() or useAsyncData() directly in page components instead of wrapping them in composables  -  prevents reuse and makes pages harder to test."
    bad_example: |
      // pages/users.vue  -  useFetch directly in page
      const { data: users } = useFetch('/api/users');
    good_example: |
      // composables/useUsers.ts
      export function useUsers() { return useFetch('/api/users'); }
      // pages/users.vue
      const { data: users } = useUsers();
  - id: uncaught_fetch_errors
    severity: warning
    description: "Components call $fetch directly without error handling. When the request fails, Nuxt shows the global error page instead of a component-level error state. The user loses their current page context."
    bad_example: |
      // pages/users.vue — raw $fetch, no error handling
      const users = await $fetch('/api/users'); // throws on failure, kills the page
    good_example: |
      // pages/users.vue — useFetch provides error ref
      const { data: users, error } = await useFetch('/api/users');
      // template can show inline error without leaving the page
  - id: secrets_in_public_config
    severity: critical
    description: "Placing API keys or database credentials in runtimeConfig.public or in NUXT_PUBLIC_ environment variables. These values are embedded in the client JavaScript bundle and visible to anyone who opens browser DevTools."
    bad_example: |
      // nuxt.config.ts — secret leaked to browser
      export default defineNuxtConfig({
        runtimeConfig: {
          public: {
            stripeSecret: process.env.STRIPE_SECRET_KEY, // visible in client bundle!
          },
        },
      });
    good_example: |
      // nuxt.config.ts — secret stays server-side
      export default defineNuxtConfig({
        runtimeConfig: {
          stripeSecret: process.env.STRIPE_SECRET_KEY, // server-only
          public: {
            stripePublicKey: process.env.STRIPE_PUBLIC_KEY, // safe — publishable key
          },
        },
      });
  - id: direct_process_env
    severity: warning
    description: "Reading process.env directly in server routes or composables instead of using useRuntimeConfig(). This bypasses Nuxt's config system, makes values untyped, and prevents runtime config overrides."
    bad_example: |
      // server/api/users.ts
      const dbUrl = process.env.DATABASE_URL; // untyped, no validation, no override support
    good_example: |
      // server/api/users.ts
      const config = useRuntimeConfig();
      const dbUrl = config.dbUrl; // typed, validated at startup, overridable
  - id: alert_for_errors
    severity: warning
    description: "Using window.alert() or alert() to display errors to the user. Alert blocks the UI thread, cannot be styled, and is impossible to test. Use toast notifications or inline error messages."
    bad_example: |
      // pages/users.vue
      const handleSubmit = async () => {
        try { await createUser(data); }
        catch (e) { alert(e.message); }
      };
    good_example: |
      const handleSubmit = async () => {
        try { await createUser(data); }
        catch (e) { error.value = e.message; }
      };
  - id: oversized_extraction
    severity: warning
    description: "A component was extracted but is still 300+ LOC. Split further into focused sub-components."
    bad_example: |
      <!-- components/AdminPanel.vue  -  500 LOC -->
      <template><!-- tabs, forms, tables all in one --></template>
    good_example: |
      <!-- components/admin/AdminPanel.vue  -  80 LOC -->
      <template><UsersTab /><AuditTab /><SettingsTab /></template>

---
