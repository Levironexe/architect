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

---
