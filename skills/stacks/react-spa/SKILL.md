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

---
