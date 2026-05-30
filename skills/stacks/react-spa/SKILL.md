---
schema_version: "2.0.0"
id: react-spa
name: "React Single Page Application"
version: "1.1.0"
description: "React SPA structure with UI components, hooks, pages, services, and utilities separated. Enforces one-way data flow and keeps network logic out of render cycles."
category: stack
language: javascript
frameworks:
  - react
detection:
  dependencies:
    any:
      - react
  source_indicators:
    - "from 'react'"
    - "from \"react\""
    - "useState("
    - "useEffect("
structure:
  required_dirs:
    - path: src/components
      purpose: "Reusable presentational React components shared across multiple pages. Components here receive all data via props and must not call services or perform fetch requests directly."
    - path: src/hooks
      purpose: "Custom React hooks that encapsulate stateful behaviour, data fetching, and side effects. Hooks here are reused by multiple pages or components  -  one-off hooks live colocated with their component."
    - path: src/services
      purpose: "Functions that perform HTTP calls and interact with external APIs. Every network request in the app originates here, making it the single place to add auth headers, error normalization, and request retries."
  recommended_dirs:
    - path: src/pages
      purpose: "Top-level route components that correspond to URL paths. Pages orchestrate data loading via hooks and pass results down to components  -  they are not reused across routes."
    - path: src/utils
      purpose: "Pure helper functions with no React dependency (date formatting, string manipulation, array transforms). Functions here must be synchronous and have no side effects."
separation:
  rules:
    - concern: ui_component
      belongs_in: src/components
      rule_text: "Components render UI from props and delegated hooks instead of embedding network or business logic. A component that calls fetch() or a service directly cannot be rendered in isolation during testing."
      example: |
        // src/components/user-card.tsx  -  receives data, never fetches it
        import type { User } from '@/types';

        export function UserCard({ user }: { user: User }) {
          return (
            <article>
              <h2>{user.name}</h2>
              <p>{user.email}</p>
            </article>
          );
        }
      indicators:
        - "return <"
        - "React.FC"
    - concern: state_logic
      belongs_in: src/hooks
      rule_text: "Reusable stateful behaviour belongs in hooks so pages and components stay declarative. A hook name must start with 'use'. If the same useState/useEffect block appears in two components, extract it into a shared hook."
      example: |
        // src/hooks/use-users.ts  -  all user-list state in one place
        import { useState, useEffect } from 'react';
        import { listUsers } from '@/services/users';
        import type { User } from '@/types';

        export function useUsers() {
          const [users, setUsers] = useState<User[]>([]);
          const [loading, setLoading] = useState(true);

          useEffect(() => {
            void listUsers().then((data) => {
              setUsers(data);
              setLoading(false);
            });
          }, []);

          return { users, loading };
        }
      indicators:
        - "useState"
        - "useEffect"
    - concern: api_access
      belongs_in: src/services
      rule_text: "HTTP calls and third-party integrations belong in services that hooks and components consume. Services are plain async functions  -  they do not call useState or useEffect. This makes them independently testable with mocked fetch."
      example: |
        // src/services/users.ts  -  network logic isolated from React
        import type { User } from '@/types';

        export async function listUsers(): Promise<User[]> {
          const response = await fetch('/api/users', {
            headers: { Authorization: `Bearer ${getToken()}` },
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json() as Promise<User[]>;
        }
      indicators:
        - "fetch("
        - "axios."
    - concern: error_handling
      belongs_in: components
      rule_text: "Wrap route-level components with React Error Boundaries to catch render errors without crashing the entire app. Services return typed results or throw typed errors — never throw raw Error objects. Hooks translate service errors into user-facing state (error message, retry function). API service functions use a consistent error shape that components can pattern-match on."
      example: |
        // components/ErrorBoundary.tsx
        import { Component, ReactNode } from 'react';

        interface Props { children: ReactNode; fallback: ReactNode }
        interface State { hasError: boolean }

        export class ErrorBoundary extends Component<Props, State> {
          state = { hasError: false };
          static getDerivedStateFromError() { return { hasError: true }; }
          render() {
            return this.state.hasError ? this.props.fallback : this.props.children;
          }
        }

        // services/api.ts — consistent error shape
        export class ApiError extends Error {
          constructor(public status: number, public code: string, message: string) { super(message); }
        }

        export async function fetchJson<T>(url: string): Promise<T> {
          const res = await fetch(url);
          if (!res.ok) throw new ApiError(res.status, 'API_ERROR', await res.text());
          return res.json();
        }
      indicators:
        - "ErrorBoundary"
        - "ApiError"
    - concern: security
      belongs_in: services
      rule_text: "Never store auth tokens in localStorage — use httpOnly cookies set by the backend. Services attach the Authorization header from a central auth module, not per-fetch. Sanitize any user-generated HTML before rendering to prevent XSS. Never embed secrets or API keys in client-side code — all sensitive calls go through your backend API."
      example: |
        // services/auth.ts — centralized token handling
        export async function fetchWithAuth(url: string, options: RequestInit = {}) {
          return fetch(url, {
            ...options,
            credentials: 'include', // sends httpOnly cookies automatically
            headers: { ...options.headers, 'Content-Type': 'application/json' },
          });
        }
      indicators:
        - "credentials: 'include'"
        - "Authorization"
        - "httpOnly"
    - concern: configuration
      belongs_in: src/config
      rule_text: "Read all environment variables once in src/config/env.ts, validate them, and export a typed config object. Components and services import from this module — never read import.meta.env or process.env directly. Vite exposes only variables prefixed with VITE_ to the client — server-only secrets must never use this prefix."
      example: |
        // src/config/env.ts
        import { z } from 'zod';

        const envSchema = z.object({
          VITE_API_URL: z.string().url(),
          VITE_APP_NAME: z.string().default('My App'),
        });

        export const env = envSchema.parse(import.meta.env);

        // Usage anywhere: import { env } from '@/config/env';
        // env.VITE_API_URL — typed and validated
      indicators:
        - "import.meta.env"
        - "VITE_"
        - "config/env"
patterns:
  data_flow:
    direction: "src/pages -> src/hooks -> src/services -> external API"
    rules:
      - "Components do not perform inline API calls during render. All data fetching happens in hooks."
      - "Shared behaviour moves into custom hooks. If the same useState/useEffect pair appears in two components, it must be extracted."
      - "Lift state to the lowest common ancestor that needs it. Do not put local UI state (modal open, form field value) into global state management."
      - "Derive values from state  -  do not create a second useState to hold a value that is computable from existing state."
  naming:
    components: "Use PascalCase for component files and function names (UserCard.tsx, ProductList.tsx). Use kebab-case for non-component utility and hook files (use-users.ts, format-date.ts)."
    hooks: "All hook function names must start with 'use' (useUsers, useAuth). The file name matches the hook name in kebab-case (use-users.ts)."
anti_patterns:
  - id: business_logic_in_components
    severity: warning
    description: "Business logic (validation, data transformation, API calls) is embedded directly in UI components. This makes the component impossible to render in isolation during testing and ties UI to network behaviour."
    bad_example: |
      export function SignupForm() {
        const handleSubmit = async (event: React.FormEvent) => {
          event.preventDefault();
          const payload = validateSignup(new FormData(event.currentTarget));
          await fetch('/api/signup', { method: 'POST', body: JSON.stringify(payload) });
        };
        return <form onSubmit={handleSubmit}>...</form>;
      }
    good_example: |
      // Component delegates to a hook; hook delegates to a service
      export function SignupForm() {
        const { submit, error } = useSignupForm();
        return <form onSubmit={submit}>{error && <p>{error}</p>}</form>;
      }
  - id: inline_api_calls_in_render
    severity: critical
    description: "API calls occur directly during render (outside of useEffect or an async event handler). Each re-render triggers another network request, leading to request storms and race conditions."
    bad_example: |
      export function UsersPage() {
        // called on every render  -  network storm
        fetch('/api/users').then(() => undefined);
        return <div>Loading...</div>;
      }
    good_example: |
      export function UsersPage() {
        const { users, loading } = useUsers();
        if (loading) return <div>Loading...</div>;
        return <UsersList users={users} />;
      }
  - id: array_index_as_key
    severity: warning
    description: "Using the array index as the React 'key' prop on list items causes silent reconciliation bugs when the list is reordered, filtered, or items are inserted or deleted. React uses the key to match elements between renders  -  an index-based key can swap component state to the wrong item."
    bad_example: |
      // key={index} breaks when items are reordered or deleted
      {users.map((user, index) => (
        <UserCard key={index} user={user} />
      ))}
    good_example: |
      // Stable unique id from the data model  -  safe for any list mutation
      {users.map((user) => (
        <UserCard key={user.id} user={user} />
      ))}
  - id: silent_fetch_failure
    severity: warning
    description: "Fetch calls wrapped in try/catch that set error state to a generic string, or worse, silently fall back to empty data. The user sees a blank screen or stale data with no indication that something failed."
    bad_example: |
      const [users, setUsers] = useState([]);
      useEffect(() => {
        fetch('/api/users').then(r => r.json()).then(setUsers).catch(() => {}); // silent failure
      }, []);
    good_example: |
      const [users, setUsers] = useState<User[]>([]);
      const [error, setError] = useState<string | null>(null);
      useEffect(() => {
        fetchJson<User[]>('/api/users')
          .then(setUsers)
          .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load users'));
      }, []);
  - id: token_in_localstorage
    severity: critical
    description: "Storing JWT or session tokens in localStorage. Any XSS vulnerability gives an attacker full access to the token — localStorage is readable by any script on the page. httpOnly cookies are immune to XSS because JavaScript cannot access them."
    bad_example: |
      // Login handler — stores token where any script can read it
      const { token } = await login(email, password);
      localStorage.setItem('token', token);
      // Later: headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    good_example: |
      // Login handler — backend sets httpOnly cookie, frontend never sees the token
      await fetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        credentials: 'include', // cookie is set automatically by Set-Cookie header
      });
      // Subsequent requests: credentials: 'include' sends the cookie
  - id: scattered_env_reads
    severity: warning
    description: "import.meta.env.VITE_API_URL scattered across multiple components and services. If the variable name changes, every file must be updated. No validation — a missing variable causes a runtime crash instead of a startup error."
    bad_example: |
      // scattered across 8 files
      fetch(`${import.meta.env.VITE_API_URL}/users`);
      // another file:
      const ws = new WebSocket(import.meta.env.VITE_WS_URL); // typo? missing? no error until runtime
    good_example: |
      // src/config/env.ts validates at startup
      export const env = envSchema.parse(import.meta.env); // crashes immediately if VITE_API_URL missing
      // everywhere else:
      import { env } from '@/config/env';
      fetch(`${env.VITE_API_URL}/users`);
  - id: alert_for_errors
    severity: warning
    description: "Using window.alert() or alert() to display errors to the user. Alert blocks the UI thread, cannot be styled, provides no actionable context, and is impossible to test. Use toast notifications or inline error messages instead."
    bad_example: |
      const handleSubmit = async () => {
        const result = await createUser(data);
        if (!result.success) alert(result.error);
      };
    good_example: |
      const handleSubmit = async () => {
        const result = await createUser(data);
        if (!result.success) setError(result.error);
      };
  - id: oversized_extraction
    severity: warning
    description: "A component or module was extracted but the extracted file is still 300+ LOC. This just moved the god file. After extraction, split further into focused sub-components under 200 LOC each."
    bad_example: |
      // components/dashboard.tsx  -  500 LOC  -  just moved from pages/
      export function Dashboard() { /* 500 lines of everything */ }
    good_example: |
      // components/dashboard/index.tsx  -  80 LOC orchestrator
      export function Dashboard() {
        return <><StatsCards /><RecentActivity /><Charts /></>;
      }
  - id: auth_mechanism_mismatch
    severity: critical
    description: "Login stores auth state using one mechanism (e.g., custom localStorage JSON) but API calls or route guards check a different one (e.g., httpOnly cookie, JWT from auth provider). The two systems never connect — authenticated requests fail silently."
    bad_example: |
      // login: stores custom blob
      localStorage.setItem('user', JSON.stringify({ email, role }));
      // api call: sends Authorization header from auth provider (never set!)
      fetch('/api/data', { headers: { Authorization: `Bearer ${token}` } });
    good_example: |
      // login: uses the auth provider
      const { token } = await authProvider.signIn({ email, password });
      // api call: uses the same token
      fetch('/api/data', { headers: { Authorization: `Bearer ${token}` } });

---
