<div align="center">
  <h1>🏛️ Architect</h1>
  <h3><em>Know exactly what's wrong with your codebase. Fix it without breaking it.</em></h3>
</div>

<p align="center">
  <strong>An architectural health scanner for JS/TS, Python, C#, and Java projects. Find god files, hardcoded secrets, circular dependencies, and structural debt — then let your coding agent fix them with a stack-specific refactoring plan.</strong>
</p>

<p align="center">
  <a href="https://github.com/Levironexe/architect/releases/latest"><img src="https://img.shields.io/github/v/release/Levironexe/architect" alt="Latest Release"/></a>
  <a href="https://www.npmjs.com/package/@levironexe/architect"><img src="https://img.shields.io/npm/v/@levironexe/architect" alt="npm version"/></a>
  <a href="https://github.com/Levironexe/architect/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Levironexe/architect" alt="License"/></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen" alt="Node.js 20+"/>
</p>

---

## See how your project scores in 5 seconds

```bash
npx @levironexe/architect scan .
```

No install. No config. No API keys. Just a health score across 4 dimensions:

```
Health score: 51 warning
  - modularity:    38 critical  - 6 oversized file(s); 15 oversized function(s)
  - duplication:    65 warning   - 13.0% duplication
  - security:       20 critical  - 5 hardcoded secrets; 8 unguarded routes
  - architecture: 100 healthy   - No circular deps
```

Want to fix what it found? Keep reading.

---

## Quick Start

```bash
# 1. Scan — see what's wrong (no install needed)
npx @levironexe/architect scan .

# 2. Install and set up agent skills
npm install -g @levironexe/architect
architect init .

# 3. In your coding agent (Claude Code, Cursor, etc.), generate a refactoring plan
/architect-plan

# 4. Execute the plan phase by phase with verification
/architect-refactor

# 5. After writing more code, refresh the skills
/architect-catchup
```

**Step 1 works standalone.** You don't need an agent, an install, or any configuration. Use it in CI, in code reviews, or just to understand a new codebase.

**Steps 2-5 are the full workflow.** When you're ready to actually fix the problems, Architect installs stack-specific skills into your coding agent and guides it through a safe, phased refactoring.

---

## What does the scan measure?

| Dimension | Weight | What it catches |
|-----------|--------|-----------------|
| **Modularity** | 35% | God files (>300 LOC), oversized functions, high complexity |
| **Security** | 25% | Hardcoded secrets, missing auth guards, weak crypto |
| **Duplication** | 20% | Copy-pasted code blocks across files |
| **Architecture** | 20% | Circular dependencies, severe hub files, dead code |

The scan works for **JavaScript/TypeScript, Python, C#, and Java** projects. JS/TS gets full AST analysis (complexity, imports, circular deps). Python, C#, and Java get tree-sitter-based analysis.

---

## What problem does it solve?

Every prompt your AI agent writes is correct. But after 20 prompts, the project is a mess.

Each prompt was reasonable. Each response was good code. But nobody was watching the architecture. Business logic leaked into pages. The same helper lives in 4 files. A 700-line file holds validation, data fetching, state management, and UI.

**The code works. Nobody wants to touch it.**

Architect fixes this in two ways:
1. **`architect scan`** — shows you exactly what's wrong, with file paths and line numbers
2. **`architect init` + agent skills** — gives your coding agent a stack-specific blueprint so it knows where code belongs and how to move it safely

---

## How It Works

### 1. Scan (standalone — no agent needed)

```
architect scan .
      │
      ├─ Detects language     → JS/TS, Python, C#, or Java
      ├─ Analyzes files       → LOC, complexity, imports, duplication, security
      ├─ Scores 4 dimensions  → modularity, security, duplication, architecture
      └─ Reports findings     → god files, hardcoded secrets, circular deps, dead code
```

Use `--summary` for a compact view. Use `--json` for CI integration.

### 2. Init + Agent Workflow (when you want to fix things)

```
architect init .
      │
      ├─ Detects your stack         → express-api / django / nextjs-app-router / …
      ├─ Detects integration skills → prisma + clerk + playwright + s3 (auto-composed)
      └─ Writes 3 skill files       → /architect-plan, /architect-refactor, /architect-catchup

/architect-plan → reads codebase + blueprint → writes phased roadmap + baseline snapshot
/architect-refactor → executes plan phase by phase → verifies each phase with `--strict`
/architect-catchup → re-scans + refreshes skills after new code
```

---

## Agent Skills

After `architect init .`, three slash commands are available in your coding agent.

### `/architect-plan`

Reads your codebase, loads the architectural blueprint for your stack via `architect context`, and writes a phased refactoring roadmap to `.architect/plan.md`. Each step in the plan has:

- **What** — which file moves where
- **Why** — which separation rule this satisfies
- **Imports to update** — every file that needs patching after the move

After writing the plan, saves a baseline health snapshot and initializes phase tracking. The agent prompts you to run `/architect-refactor`.

### `/architect-refactor`

Reads `.architect/plan.md` and `.architect/state.json` to find the next pending phase. Executes each phase one step at a time. After completing a phase, runs `architect verify` to check TypeScript compilation, import resolution, and health score delta. Supports resuming across sessions. After each phase it stops and asks:

```
✅ Phase 1 complete: Extract service layer
Verification: PASSED (0 tsc errors, 0 broken imports)
Health: 34 → 42 (+8)
Proceed to Phase 2 (Add controllers)?
```

Hard constraints: never touches business logic, never proceeds automatically, never modifies files outside the current step's scope.

### `/architect-catchup`

Refreshes your skill files after you've refactored or written new code.

1. Checks that skill files already exist — if not, tells you to run `architect init .` first
2. Runs `npx @levironexe/architect init . --update` to re-scan and overwrite
3. Saves a fresh snapshot and shows before/after comparison
4. Prompts you to run `/architect-plan` to start a new cycle

---

## CLI Reference

### `architect init <directory>`

Scans the project, detects the stack and agent, and writes skill files.

```bash
architect init .                           # auto-detect everything
architect init . --skill express-api       # override stack detection
architect init . --integration claude      # override agent detection
architect init . --update                  # overwrite existing skill files without prompting
```

### `architect scan [directory]`

Prints a structural health report without writing any files. Includes security findings and dead code detection.

```bash
architect scan .
architect scan . --summary                          # health score + critical issues only
architect scan . --json                              # machine-readable output
architect scan . --verbose                           # include detailed diagnostics
architect scan . --no-color                          # for CI
architect scan . --threshold "loc=400,complexity=20" # custom thresholds
architect scan . --snapshot .architect/scans/baseline.json  # save metrics for later comparison
```

### `architect diff <directory>`

Compares scan snapshots to show before/after improvement.

```bash
architect diff .              # compare baseline vs latest phase snapshot
architect diff . --phase 3    # compare baseline vs specific phase
architect diff . --json       # machine-readable output
```

### `architect status <directory>`

Shows refactoring phase completion progress.

```bash
architect status .            # show phase progress from .architect/state.json
architect status . --json     # machine-readable output
```

### `architect verify <directory>`

Runs post-phase verification with language-aware compilation checks. Exit code 0 = passed, 1 = failed.

- **JS/TS**: TypeScript compilation (`tsc --noEmit`) + import resolution
- **Python**: `mypy` type check (if installed), falls back to `py_compile` syntax check
- **C#**: `dotnet build` compilation check
- **Java**: auto-detects Maven (`mvn compile`) or Gradle (`gradle compileJava`)

```bash
architect verify .              # run full verification suite
architect verify . --phase 3    # verify and save phase-3 snapshot
architect verify . --strict     # also fail on circular dep increase, duplication >1%, health regression
architect verify . --json       # machine-readable output
```

### `architect context [--techstack <ids...>]`

Prints the full architectural blueprint. Called automatically by `/architect-plan` — you rarely need this manually. When `--techstack` is omitted, auto-detects the stack from the current directory.

```bash
architect context                            # auto-detect
architect context --techstack express-api    # explicit
```

### `architect skill list`

Lists all available skills. Active skills (detected in the current directory) are marked.

---

## Supported Agents

| Agent | Skills written to |
|-------|-------------------|
| **Claude Code** | `.claude/skills/` |
| **Cursor** | `.cursor/rules/` |
| **Windsurf** | `.windsurf/rules/` |
| **GitHub Copilot** | `.github/copilot-instructions.md` |
| **Generic** | `.architect/skills/` (plain Markdown) |

Architect auto-detects the agent. Override with `--integration <agent>`.

---

## Built-in Architecture Skills

### Stack Skills

| Skill ID | Stack |
|----------|-------|
| `express-api` | Express.js REST API |
| `nextjs-app-router` | Next.js App Router |
| `react-spa` | React Single Page App (Vite) |
| `nestjs` | NestJS |
| `fastify-api` | Fastify REST API |
| `hono-api` | Hono API (Edge + Node) |
| `django` | Django + DRF |
| `fastapi` | FastAPI |
| `flask` | Flask |
| `vue-nuxt` | Vue + Nuxt |
| `aspnetcore-mvc` | ASP.NET Core MVC |
| `aspnetcore-webapi` | ASP.NET Core Web API |

### Integration Skills

| Skill ID | Pattern | Language |
|----------|---------|----------|
| `prisma` | Prisma ORM (singleton, repository, migrations) | JS/TS |
| `drizzle` | Drizzle ORM (schema-first, type-safe queries) | JS/TS |
| `mongoose` | Mongoose ODM (schema, model, repository) | JS/TS |
| `supabase` | Supabase (server/browser clients, RLS, realtime) | JS/TS |
| `supabase-auth` | Supabase Auth (RLS policies, session management) | JS/TS |
| `clerk-auth` | Clerk (middleware, webhooks, org-scoping) | JS/TS |
| `nextauth` | NextAuth.js (route handler, session provider) | JS/TS |
| `vitest-testing` | Vitest (unit/integration testing patterns) | JS/TS |
| `playwright-e2e` | Playwright E2E (POM, auth fixtures) | JS/TS |
| `playwright-csharp` | Playwright E2E (POM, NUnit, async) | C# |
| `playwright-python` | Playwright E2E (POM, pytest fixtures) | Python |
| `playwright-java` | Playwright E2E (POM, JUnit5) | Java |
| `selenium-e2e` | Selenium E2E (POM, driver factory) | JS/TS |
| `selenium-csharp` | Selenium E2E (POM, NUnit, driver factory) | C# |
| `selenium-python` | Selenium E2E (POM, pytest, conftest) | Python |
| `selenium-java` | Selenium E2E (POM, JUnit5, PageFactory) | Java |
| `s3-storage` | S3/object storage (presigned URLs, upload flows) | JS/TS |
| `s3-python` | S3 storage (boto3, presigned URLs, moto testing) | Python |
| `s3-csharp` | S3 storage (AWSSDK.S3, IAmazonS3 DI) | C# |
| `s3-java` | S3 storage (AWS SDK v2, S3Presigner) | Java |
| `vercel-deploy` | Vercel deployment (edge, serverless, env vars) | JS/TS |
| `docker-deploy` | Docker (multi-stage, security, health checks) | Any |

### Meta Skills

| Skill ID | Purpose |
|----------|---------|
| `general-js` | General JS/TS conventions (naming, error handling, DI, DRY) |

Run `architect skill list` to see which skills are active in your current project.

### Skill Composition

When multiple skills are detected (e.g., `nextjs-app-router` + `prisma` + `clerk-auth`), Architect composes integration-specific phases into the refactoring plan:

- **Prisma + Next.js** → Prisma singleton setup, Server Action data layer
- **Prisma + Express** → Prisma repository layer
- **Supabase + Next.js** → Supabase client setup, RLS policy audit
- **Clerk + Next.js** → Clerk middleware setup, auth guard audit
- **NextAuth + Next.js** → NextAuth route handler, session provider isolation

### Engineering Principles

Every skill teaches 9 engineering principles:

1. **Separation of Concerns** — folder structure, data flow direction
2. **SOLID** — SRP per layer, dependency injection, interface segregation
3. **Layered Architecture** — strict layer dependencies, no skip-calls
4. **DRY** — singletons, shared middleware, composable extraction
5. **Security Patterns** — secrets management, auth guards, input validation
6. **Error Handling** — custom errors, centralized handlers, typed responses
7. **API Contracts** — separate input/output types, no ORM leakage
8. **Testability** — injectable deps, isolated services, test structure
9. **Configuration Management** — centralized config, startup validation, typed exports

---

## Contributing a Skill

Skills are `SKILL.md` files in `skills/`. To add one:

1. Create `skills/stacks/<id>/SKILL.md` (see existing skills for the format)
2. Add a detection fixture under `tests/fixtures/<id>/`
3. Run `npm test` — your skill must be detected and not conflict with existing ones
4. Open a pull request

---

## Prerequisites

- Node.js 20+ (LTS recommended)
- A supported AI coding agent (Claude Code, Cursor, GitHub Copilot, or Windsurf)
- A JavaScript/TypeScript, Python, C#, or Java project

---

## License

MIT — see [LICENSE](./LICENSE) for full terms.

