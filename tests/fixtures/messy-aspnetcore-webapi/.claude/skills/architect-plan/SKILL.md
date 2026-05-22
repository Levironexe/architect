---
name: architect-plan
description: >
  Analyzes a codebase's architecture and generates a phased refactoring roadmap saved to
  .architect/plan.md. Use this skill whenever the user wants to plan a refactor, understand
  their codebase structure, clean up architectural problems, generate a migration plan, or
  prepare for a major restructuring. Trigger even if the user just says "analyze my architecture",
  "how should I organize this project", or "make a plan to clean this up".
metadata:
  version: "1.0"
  author-email: "levironforwork@gmail.com"
  last-updated: "2026-05-11"
---

# architect-plan

You are helping a developer understand and improve the architecture of their codebase. Your job
is to produce a concrete, ordered refactoring roadmap  -  not advice, not observations, but a
specific plan saved to `.architect/plan.md` that the developer (or `/architect-refactor`) can
execute step by step.

## Context already loaded for you

The following static analysis and blueprint data has been pre-computed by `architect init`. Read
it carefully before touching any source files  -  it tells you where the biggest problems are and
what the target architecture looks like.

**Stack**: ASP.NET Core Web API

**Largest files by line count** (likely candidates for extraction):
- Controllers/TasksController.cs (426 LOC)
- Controllers/ProjectsController.cs (368 LOC)
- Controllers/UsersController.cs (160 LOC)
- Controllers/AuthController.cs (138 LOC)
- Controllers/ReportsController.cs (117 LOC)

**Hub files** (imported by many others  -  high-impact, higher risk to touch):


**Code duplication**: 1.2% of lines are duplicated

**Missing required directories** (the blueprint expects these but they don't exist yet):
- src/{AppName}.Domain/
- src/{AppName}.Application/
- src/{AppName}.Infrastructure/
- src/{AppName}.Api/
- tests/

**Target directory structure** (what the codebase should look like):
- src/{AppName}.Domain/: Core domain layer. Has zero dependencies on other projects or frameworks. Contains Entities, ValueObjects, Aggregates, Domain Events, Interfaces (IRepository<T>, IDomainService), Enums, and domain Exceptions. Business invariants and rules live here.
- src/{AppName}.Application/: Use-case orchestration layer. Depends only on the Domain project. Contains CQRS Commands and Queries (one folder per feature: Features/Products/Commands/, Features/Products/Queries/), DTOs, AutoMapper Profiles, MediatR Pipeline Behaviours (validation, logging, caching), and interface definitions for infrastructure services (IEmailService, ICurrentUser). DependencyInjection.cs registers all Application services.
- src/{AppName}.Infrastructure/: Framework and external service implementations. Depends on Domain and Application. Contains EF Core DbContext, Repository implementations, Migrations, Entity type configurations (Fluent API), and concrete service implementations (SmtpEmailService, S3FileService). DependencyInjection.cs registers all Infrastructure services. Never referenced directly from the API layer except in Program.cs for DI wiring.
- src/{AppName}.Api/: Thin HTTP entry point. Depends on Application. References Infrastructure only in Program.cs to register DI. Contains Controllers (one per feature), Middleware (error handling, correlation ID), Filters, and extension methods for service registration. Controllers call MediatR.Send() and return ActionResult — no business logic.
- tests/: Test projects mirroring the source structure: Domain.Tests (unit tests for domain logic), Application.Tests (unit tests for handlers with mocked interfaces), Api.IntegrationTests (end-to-end tests with real DB using WebApplicationFactory).

**How data should flow through this architecture**:
HTTP Request → Controller → IMediator.Send(Command/Query) → Pipeline Behaviours (validation, logging) → Handler (Application) → IRepository (Domain interface) → EF Core Repository (Infrastructure) → DTO → Response
- Dependency rule: Domain ← Application ← Infrastructure ← API. Inner layers never reference outer layers.
- Each layer exposes a static DependencyInjection.cs with an AddXxx(this IServiceCollection) extension method. Program.cs calls builder.Services.AddApplication().AddInfrastructure(config) — not individual registrations.
- Repository interfaces live in Domain; implementations live in Infrastructure. The Application layer depends only on the interface — it never imports EF Core types.
- Return Result<T> or domain exceptions from handlers instead of nullable types. Use middleware to convert domain exceptions to HTTP status codes.
- EF Core entity configurations use Fluent API in separate IEntityTypeConfiguration<T> classes in Infrastructure/Persistence/Configurations/ — not Data Annotations on domain entities.

**Service layer pattern** (if applicable):


**Integration-specific phases** (generated from skill composition rules):


If any of the above blocks are empty, proceed without them  -  the live codebase is your primary source.

## Step-by-step instructions

### 1. Read the codebase

Open and read:
- `package.json` (or equivalent manifest) to confirm the tech stack and dependencies
- The 3 largest source files from the list above (or the largest files you can find if the list
  is empty)  -  understand what they do and what concerns they mix

While reading `package.json`, flag dependency bloat:
- Multiple packages solving the same problem (e.g., 2+ ORMs, 2+ date libraries, 2+ state managers)
- Packages imported in source files but never actually used

While reading source files, flag security issues:
- Hardcoded secrets: grep for `['"].*(?:secret|password|key|token).*['"]` patterns assigned to variables
- Auth guards missing on route handlers that touch user data
- `process.env` reads scattered outside a central config module

Record both as problem areas to address in the plan.

### 2. Confirm the detected stack

Based on what you read, confirm or correct the detected stack (`ASP.NET Core Web API`). If the stack
looks wrong, call:
```
architect context --techstack <correct-id>
```
Otherwise call:
```
architect context --techstack aspnetcore-webapi aspnetcore-mvc
```

If `architect` is not found globally, fall back to:
```
npx @levironexe/architect context --techstack aspnetcore-webapi aspnetcore-mvc
```

This may return blueprints for several detected stacks. Apply the rules from each  -  the primary
stack (ASP.NET Core Web API) takes precedence on conflicts.

Read the output  -  it gives you the full architectural blueprint: required directories, separation
rules, anti-patterns to avoid.

### 3. Compare current vs target structure

Walk through the blueprint's required directories. For each one, note:
- ✓ Exists and looks right
- ⚠ Exists but contains the wrong concerns
- ✗ Missing entirely

Cross-reference with the "Missing required directories" list above.

### 4. Identify the problems

Based on what you've read, identify the concrete structural problems:
- Which files are doing too many things (mixed concerns)?
- What code lives in the wrong place relative to the blueprint?
- Where is duplication concentrated?
- Which hub files are risky to touch?
- Where does a file re-derive data already available from a `lib/` function? (inline filters,
  re-calculations, re-sorts that should be called once from a shared module)

**Enumerate exhaustively.** When you identify a problem pattern in a file, search for every
instance of that pattern in that file before writing the plan step. Do not write "remove the X
re-derivation" if X, Y, and Z are all the same pattern  -  list all three by name and line number
in the step's "What" field. Finding one instance is not license to move on.

Also enumerate from the pre-flight checks in step 1:
- Each duplicate-library pair → one cleanup step (remove the redundant one, update all callsites)
- Each hardcoded secret → one security step (move to env var + config module)
- Each missing auth guard → one security step

### 5. Write `.architect/plan.md`

Create or overwrite `.architect/plan.md` with a phased refactoring roadmap. Use this exact format:

```markdown
# Refactoring Plan: <project name>
Generated: <today's date>
Stack: <detected stack id>

## Phase 1: <name  -  most impactful, lowest risk first>
**Goal**: <what structural problem this phase solves>
**Risk**: low | medium | high

### Steps
- [ ] Step 1.1: <verb> `<source>` → `<target>`
  - What: <exactly what code is being moved or created  -  for deletions, list every item by name
    and line number; for extractions, list every symbol being moved>
  - Why: <which separation rule or blueprint requirement this satisfies>
  - Imports to update:
    - `<file>`: change `from '<old-module>'` → `from '<new-module>'` for `<symbols>`
    - "none" if no consumers exist
  - Verify: `grep -r "from '<old-module>'" <scope>/` should return zero results
    [include only on steps that move or extract a module; omit on pure creation steps]

- [ ] Step 1.2: ...

## Phase 2: ...
```

**Ordering rules**:
- Put the highest-impact changes first (files that are mixed the most, missing dirs that block
  other changes)
- Within the same impact level, put lower-risk changes first (creating new files before moving
  existing ones; moving to new dirs before changing existing files)
- Do not put hub files in Phase 1 unless unavoidable  -  moving a hub breaks many things at once
- Each phase should be independently executable: completing it leaves the project in a valid,
  runnable state
- If the "Service layer pattern" section above is non-empty, include a dedicated phase for
  service extraction. For each API route or controller that contains business logic or direct
  database calls: create a corresponding service file, move the logic there, and reduce the
  route/controller to a thin HTTP handler that delegates to the service. Follow the data flow
  direction specified above
- Collect all destructive steps (deleting dead code, removing duplicates, removing deprecated
  patterns) into a dedicated final phase labeled "Cleanup: Remove Dead Code." Do not embed
  deletions inside constructive phases  -  deletions produce absence, which is easy for an agent to
  skip when surrounded by creation steps
- **Every file listed in "Largest files" that is OVERSIZED must appear in at least one phase.**
  Do not close the plan while any oversized file from that list is unaddressed. If a file is too
  risky to touch early, schedule it in a later phase — but it must be scheduled.
- When a phase consolidates types into a single file (e.g., `types/index.ts`), add a follow-up
  step or phase to split it into domain-specific files if it exceeds 200 LOC after consolidation.
  Barrel-export from `index.ts` so consumers need no import changes.

**Minimum**: at least 1 phase with at least 1 step. If the project already follows the
blueprint well, write a single phase with steps for minor cleanup and note "Structure largely
follows the ASP.NET Core Web API blueprint."

### 6. Save baseline snapshot and initialize state tracking

After writing the plan, run:
```
npx @levironexe/architect scan . --snapshot .architect/scans/baseline.json
```

Then create `.architect/state.json` with the following structure (replace placeholders with
actual values from the plan you just wrote):

```json
{
  "plan_version": "<today's ISO date>",
  "total_phases": <number of phases in the plan>,
  "current_phase": 1,
  "phases": [
    { "id": 1, "name": "<phase 1 name>", "status": "pending" },
    { "id": 2, "name": "<phase 2 name>", "status": "pending" }
  ],
  "baseline_health": <health_score from the scan snapshot>,
  "latest_health": null
}
```

Include one entry per phase from the plan. Read the health score from the snapshot you just
saved (open `.architect/scans/baseline.json` and use the `health_score` field).

If the `npx` command fails (e.g. architect not installed), skip this step silently  -  the
refactor skill falls back to checkbox-based tracking.

### 7. Report to the developer

After writing the plan, summarize in the chat:
- How many phases and total steps
- The single biggest structural problem you found
- Which phase to start with and why
- Baseline health score (from the snapshot)

Do not ask for confirmation before writing the plan  -  just do it and report when done.

### 8. Hand off to refactor

After reporting the summary, output:

> Ready to start refactoring? Run `/architect-refactor` to execute Phase 1.
