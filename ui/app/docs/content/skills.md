# Rules

Architect ships **one** stack blueprint: `nextjs-app-router`. It carries eleven
anti-patterns. Ten are checked deterministically; one is guidance for a coding
agent to read.

Run `architect check --list-rules` to print the current list straight from the
blueprint — that output is generated from the source, so it cannot drift from
this page.

## The ten checked rules

| Rule | Severity | Fires when |
|------|----------|-----------|
| `direct_db_in_page` | critical | A database client is imported in `page.tsx` or `layout.tsx` |
| `direct_db_in_route` | critical | A database client is imported in `route.ts` |
| `leaked_server_secret` | critical | A `'use client'` file reads a non-`NEXT_PUBLIC_` env var |
| `illegal_import` | critical | `components/` imports from `app/` |
| `use_client_everywhere` | warning | `'use client'` sits on a layout |
| `client_data_fetching_by_default` | warning | A client component fetches in `useEffect` |
| `server_action_throws` | warning | A Server Action throws instead of returning a result |
| `scattered_process_env` | warning | `process.env` is read outside `lib/config.ts` |
| `alert_for_errors` | warning | `alert()` is used to show an error |
| `oversized_extraction` | warning | A file exceeds 300 LOC |
| `missing_layer` | warning | A required directory from the blueprint does not exist |

`missing_layer` is derived from the blueprint's `structure.required_dirs` rather
than from a `detect:` block.

### Agent-only

| Rule | Why it is not checked |
|------|----------------------|
| `auth_mechanism_mismatch` | Requires cross-file semantic judgement — the login flow issuing one token type while an API route validates another. A static matcher would produce false positives, so it stays as guidance in the blueprint. |

## The `detect:` schema

Rules are data, not code. An anti-pattern becomes checkable by gaining a
`detect:` block:

```yaml
- id: direct_db_in_page
  severity: critical
  detect:
    kind: import
    paths: ["app/**/page.tsx", "app/**/layout.tsx"]
    modules: ["@prisma/client", drizzle-orm, mongoose]
    message: "Database client imported directly in a page or layout component."
    fix: "Move the query into lib/ and call that function from the page."
  description: "..."     # read by the coding agent, never by check
  bad_example: |  ...
  good_example: |  ...
```

An anti-pattern **without** `detect:` is agent-only guidance and is never
reported.

### Matcher kinds

| `kind` | Fires when | Key fields |
|--------|-----------|------------|
| `import` | A module is imported inside `paths` — or, with `bindings`, one hop away through a workspace package or local file | `modules`, `bindings` |
| `import_direction` | A file under `from` imports one under `to` | `from`, `to` |
| `directive` | A file carries a directive prologue | `value` |
| `call` | A named function is called | `callee` |
| `member` | A member expression appears | `object`, `property` |
| `throw` | A `throw` statement appears | — |
| `metric` | A file metric exceeds a ceiling | `metric`, `gt` |

### Shared fields

| Field | Effect |
|-------|--------|
| `paths` | Globs the rule applies to. Omitted means every file. |
| `not_paths` | Globs excluded, applied after `paths` |
| `requires_directive` | The file must also carry this directive, e.g. `use client` |
| `requires_call` | The file must also contain this call, e.g. `useEffect` |
| `inside_callback_of` | `call` only. The call must sit lexically inside a function passed to this call — `useEffect(() => { fetch() })` yes, a fetch in an `onClick` handler no |
| `method_not` | `call` only. Skip a fetch whose literal `method:` is one of these, e.g. `[POST, PUT, PATCH, DELETE]` |
| `not_matching` | Matched text starting with any of these is not a violation |
| `bindings` | `import` only. Names that, when imported from a module that depends on or imports a `modules` entry, count as importing that module. `prisma` yes, `listUsers` no. Type-only imports never match. |
| `message` | What is wrong. Shown to the user. |
| `fix` | What to do about it. States the move, not the diagnosis. |

### Path matching

Globs are anchored at a **segment boundary**, not the repository root, because
projects put the App Router in either `app/` or `src/app/`:

| Pattern | Path | Match |
|---------|------|-------|
| `app/**/page.tsx` | `app/users/page.tsx` | ✅ |
| `app/**/page.tsx` | `src/app/users/page.tsx` | ✅ |
| `app/**/page.tsx` | `src/app/(dashboard)/team/page.tsx` | ✅ |
| `app/**/page.tsx` | `src/myapp/users/page.tsx` | ❌ |
| `app/*.tsx` | `src/app/users/page.tsx` | ❌ (one segment only) |

## Matching is AST-based

Every matcher runs against a real parse, not a text scan. A commented-out
`alert()` and a string that merely mentions `process.env` are not violations.

Two violations never share a `file:line` — where rules legitimately overlap, only
the most severe is reported.

## Adding a rule

See [Contributing](/docs/contributing). Every rule needs a violation fixture
**and** a clean fixture proving it stays silent on correct code.
