<div align="center">
  <h1>🏛️ Architect</h1>
  <h3><em>Fix vibe-coded projects without breaking them.</em></h3>
</div>

<p align="center">
  <strong>A CLI tool that scans your codebase, detects its architecture pattern, and installs agent skills that guide your coding agent through a safe, phased refactoring. Supports JavaScript/TypeScript, Python, C#, and Java projects.</strong>
</p>

<p align="center">
  <a href="https://github.com/Levironexe/architect/releases/latest"><img src="https://img.shields.io/github/v/release/Levironexe/architect" alt="Latest Release"/></a>
  <a href="https://www.npmjs.com/package/@levironexe/architect"><img src="https://img.shields.io/npm/v/@levironexe/architect" alt="npm version"/></a>
  <a href="https://github.com/Levironexe/architect/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Levironexe/architect" alt="License"/></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen" alt="Node.js 20+"/>
</p>

---

## What problem does it solve?

Vibe coding is fast. Cleanup is hard.

When you ship quickly with an AI agent — or inherit a fast-moving codebase — you often end up with god files, wrong folder structure, and risky refactors where you don't know what moving something will break.

Architect fixes this by giving your coding agent a precise, stack-specific architectural blueprint and a structured way to execute refactors safely. No LLM API keys. No cloud. Just a local CLI that hands off to the agent already open in your editor.

---

## Quick Start

```bash
# 1. Install
npm install -g @levironexe/architect

# 2. Scan your project and install agent skills
cd your-project
architect init .

# 3. In your agent (Claude Code, Cursor, etc.), generate a plan
/architect-plan

# 4. Execute the plan phase by phase
/architect-refactor

# 5. After writing more code, refresh the skills
/architect-catchup
```

---

## How It Works

```
architect init .
      │
      ├─ Detects language            → JS/TS, Python, C#, or Java (via config files or extensions)
      ├─ Scans your project         → LOC, duplication, security (all languages)
      │                               + complexity, imports, dead code (JS/TS)
      ├─ Detects your stack         → express-api / django / aspnetcore-webapi / fastapi / …
      ├─ Detects integration skills → prisma + clerk + selenium-e2e + s3-storage (auto-composed)
      └─ Writes skill files         → /architect-plan, /architect-refactor, /architect-catchup

/architect-plan
      │
      ├─ Reads your codebase + fetches the architecture blueprint
      ├─ Writes .architect/plan.md  → phased roadmap, each step has What / Why / Imports
      ├─ Saves baseline snapshot    → .architect/scans/baseline.json
      └─ Creates state tracking     → .architect/state.json (all phases: pending)

/architect-refactor
      │
      ├─ Reads state.json to resume where you left off
      ├─ Executes one phase at a time
      ├─ Announces every move before touching a file
      ├─ Runs `architect verify` after each phase (tsc + imports + health delta)
      ├─ Updates state.json with completion status
      └─ Pauses after each phase for your approval

/architect-catchup
      │
      ├─ Re-scans the project
      ├─ Overwrites skill files with fresh data
      └─ Shows before/after scan comparison via `architect diff`
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

Runs post-phase verification: compilation check (JS/TS), broken import detection (JS/TS), and scan delta comparison (all languages). Exit code 0 = passed, 1 = failed.

```bash
architect verify .              # run full verification suite
architect verify . --phase 3    # verify and save phase-3 snapshot
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

