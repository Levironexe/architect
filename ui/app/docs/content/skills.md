# Skill System

## What is a skill?

A skill is a folder containing a `SKILL.md` file that encodes the architectural best practices for a specific tech stack. Architect skills follow the [Agent Skills open standard](https://agentskills.io), making them compatible with Claude Code, Cursor, GitHub Copilot, and 30+ other agents.

Each `SKILL.md` contains YAML frontmatter (machine-readable metadata and rules) plus an optional markdown body (human-readable context):

- **Target folder structure** — required and recommended directories with their purpose
- **Separation rules** — what code belongs where, with prose explanations and code examples
- **Data flow direction** — e.g. `Route → Controller → Service → Model`
- **Naming conventions** — file naming patterns per layer
- **Anti-patterns** — common mistakes with bad/good examples

When you run `architect init`, the matched skill is rendered into a `SKILL.md` file that your coding agent reads as a slash command. When the agent runs `/architect-plan`, it calls `architect context` to load the full blueprint fresh from the skill knowledge base.

## Skill Categories

| Category | Description | Always applied? |
|----------|-------------|----------------|
| **Stack** | Core structure for a framework (Express, Next.js, React, etc.) | No — matched from project |
| **Meta** | Language-level conventions (naming, imports, error handling) | Yes — `general-js` always included with any JS/TS stack |
| **Integration** | Patterns for libraries layered onto a stack (Prisma, Supabase, etc.) | No — matched from dependencies |

## Built-in Skills

### Stack Skills

| ID | Name | Language |
|----|------|----------|
| `express-api` | Express.js REST API | JavaScript/TypeScript |
| `nextjs-app-router` | Next.js App Router | JavaScript/TypeScript |
| `react-spa` | React Single Page Application | JavaScript/TypeScript |
| `nestjs` | NestJS | TypeScript |
| `fastify-api` | Fastify API | JavaScript/TypeScript |
| `hono-api` | Hono API | JavaScript/TypeScript |
| `django` | Django | Python |
| `fastapi` | FastAPI | Python |
| `flask` | Flask | Python |
| `aspnetcore-webapi` | ASP.NET Core Web API | C# |
| `aspnetcore-mvc` | ASP.NET Core MVC | C# |
| `vue-nuxt` | Vue + Nuxt | JavaScript/TypeScript |

### Meta Skills

| ID | Name | Description |
|----|------|-------------|
| `general-js` | General JavaScript/TypeScript | Naming, imports, error handling, env vars |

### Integration Skills

| ID | Name | Language |
|----|------|----------|
| `prisma` | Prisma ORM | JS/TS |
| `drizzle` | Drizzle ORM | JS/TS |
| `mongoose` | Mongoose (MongoDB) | JS/TS |
| `supabase` | Supabase | JS/TS |
| `supabase-auth` | Supabase Auth | JS/TS |
| `clerk-auth` | Clerk Auth | JS/TS |
| `nextauth` | NextAuth.js | JS/TS |
| `vitest-testing` | Vitest | JS/TS |
| `playwright-e2e` | Playwright E2E | JS/TS |
| `playwright-csharp` | Playwright E2E | C# |
| `playwright-python` | Playwright E2E | Python |
| `playwright-java` | Playwright E2E | Java |
| `selenium-e2e` | Selenium E2E | JS/TS |
| `selenium-csharp` | Selenium E2E | C# |
| `selenium-python` | Selenium E2E | Python |
| `selenium-java` | Selenium E2E | Java |
| `s3-storage` | AWS S3 | JS/TS |
| `s3-python` | AWS S3 | Python |
| `s3-csharp` | AWS S3 | C# |
| `s3-java` | AWS S3 | Java |
| `docker-deploy` | Docker | Any |
| `vercel-deploy` | Vercel | JS/TS |

## Auto-Detection

When `architect init` runs, it detects your project in two stages:

**Stage 1 — Language detection:**

1. Checks for config files: `package.json` (JS/TS), `pyproject.toml`/`requirements.txt` (Python), `*.csproj` (C#), `pom.xml`/`build.gradle` (Java)
2. Falls back to counting file extensions (`.js`, `.py`, `.cs`, `.java`) if no config file found

**Stage 2 — Framework/skill matching:**

1. Reads dependencies from the detected config file (npm deps, pip packages, NuGet packages, Maven/Gradle deps)
2. Scores each skill's detection rules against the dependency list and file patterns
3. Selects the highest-scoring stack skill as primary; if no stack matches, promotes the highest-scoring integration skill
4. Only skills matching the detected language are considered (prevents cross-language mismatches)

For JS/TS projects, a full structural scan (LOC, complexity, imports, circular deps, dead code) runs. For Python, C#, and Java projects, a lite scan (LOC, duplication, security, file-size health) runs — full scan (complexity, imports, circular deps, dead code) remains JS/TS only.

The `general-js` meta skill is always applied for JavaScript/TypeScript projects. Integration skills (Prisma, Supabase, Selenium, etc.) are applied when their dependencies appear in the project config.

If detection picks the wrong skill, override it:

```bash
architect init . --skill nextjs-app-router
```

Run `architect skill list` to see which skill is currently active in a directory.

## Skill Schema

Every skill is a `SKILL.md` file — a Markdown document with YAML frontmatter for machine-readable metadata and a markdown body for human-readable context. The frontmatter defines detection rules, structure requirements, separation rules, and anti-patterns. The markdown body can include additional prose, examples, and guidance.

Here is an abbreviated `express-api` example:

```markdown
---
schema_version: "2.0.0"
id: express-api
name: "Express.js REST API"
version: "1.1.0"
description: "Layered Express REST API with routing, request handling, business logic, and data access separated."
category: stack          # stack | meta | integration
language: javascript
frameworks:
  - express

detection:
  dependencies:
    any:
      - express          # matches if any of these appear in package.json
  source_indicators:
    - "express()"        # matched against source file content
    - "app.listen"

structure:
  required_dirs:
    - path: src/routes
      purpose: "Route definitions organized by resource."
    - path: src/controllers
      purpose: "Request handlers that receive HTTP input, call services, and return responses."
    - path: src/services
      purpose: "Business logic with no HTTP awareness."
    - path: src/models
      purpose: "Data models and database interactions."
  recommended_dirs:
    - path: src/config
      purpose: "Environment and application configuration."

separation:
  rules:
    - concern: routing
      belongs_in: src/routes
      rule_text: "Route files define HTTP endpoints and delegate to controllers. No business logic."
      example: |
        router.get('/users', UserController.list);
        router.post('/users', UserController.create);
    - concern: business_logic
      belongs_in: src/services
      rule_text: "Services contain business rules. Accept plain data, return plain data. No req/res."
      example: |
        export async function createUser(input) {
          await validateUser(input);
          return userModel.create(input);
        }

patterns:
  data_flow:
    direction: "Route -> Controller -> Service -> Model"
  naming:
    files: "kebab-case, suffixed by layer: users.route.ts, users.service.ts"

anti_patterns:
  - id: god_file
    severity: critical          # critical | warning | info
    description: "Single file mixes routes, data access, and business logic."
    bad_example: |
      app.post('/users', async (req, res) => {
        const hash = await bcrypt.hash(req.body.password, 10);
        const user = await db.query('INSERT INTO users ...');
        res.json(user);
      });
    good_example: |
      router.post('/users', UserController.create);
---

## Service Layer

**Pattern:** service-per-resource
**Location:** `src/services/`
**Naming:** `{resource}.service.ts`

Routes become thin HTTP handlers that delegate to services for business logic.
```

## v0.4 Skill Capabilities

### Service Layer Sections

Stack skills can include a **Service Layer** section in the markdown body that defines the pattern, location, and naming convention for service files. When present, `/architect-plan` generates a dedicated "Service Layer Extraction" phase that moves business logic from routes into service files.

### Security Anti-Pattern Detection

Scans now detect common security mistakes in your codebase: hardcoded secrets, weak JWT fallbacks, missing auth middleware, MD5/SHA1 for passwords, tokens in query params, and non-singleton database clients. Security findings appear in scan output and influence the health score.

### Dead Code Detection

Scans identify unreferenced files (zero inbound imports) and unreferenced exports (named exports with no external references). Dead code findings feed directly into the plan as a cleanup phase.

### Integration Composition

When multiple skills match a project (e.g. `nextjs-app-router` + `prisma`), composition rules in integration skills generate additional phases specific to the combination. For example, Prisma + Next.js generates phases for singleton setup and server action data layer migration.
