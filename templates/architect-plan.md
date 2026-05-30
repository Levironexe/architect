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

**Stack**: {{skill.name}}

**Largest files by line count** (likely candidates for extraction):
{{analysis.largestFiles}}

**Hub files** (imported by many others  -  high-impact, higher risk to touch):
{{analysis.hubFiles}}

**Code duplication**: {{analysis.duplicationPercent}} of lines are duplicated

**Missing required directories** (the blueprint expects these but they don't exist yet):
{{analysis.missingDirs}}

**Target directory structure** (what the codebase should look like):
{{skill.structure.required}}

**How data should flow through this architecture**:
{{skill.separation.data_flow}}

**Service layer pattern** (if applicable):
{{skill.separation.service_layer}}

**Security findings** (from static analysis):
{{analysis.securityFindings}}

**Anti-patterns to look for** (specific to this stack  -  check every file for these):
{{skill.anti_patterns}}

**Integration-specific phases** (generated from skill composition rules):
{{analysis.composedPhases}}

**Scan tier**: {{analysis.scanTier}} | **Static health score**: {{analysis.healthScore}}

If the scan tier is "lite", the static health score only measures file sizes and duplication  -  it
cannot detect architectural problems like mixed concerns, layer violations, or missing abstractions.
Your job is to read the code and assess these yourself. Do not trust a high static score as evidence
that the architecture is sound.

If any of the above blocks are empty, proceed without them  -  the live codebase is your primary source.

## Step-by-step instructions

### 1. Read the codebase

Open and read:
- The project manifest (`package.json`, `*.csproj`, `pom.xml`, `build.gradle`, `pyproject.toml`,
  `requirements.txt`, or equivalent) to confirm the tech stack and dependencies
- The 3 largest source files from the list above (or the largest files you can find if the list
  is empty)  -  understand what they do and what concerns they mix
- The entry point (`Program.cs`, `app.py`, `main.ts`, `index.ts`, etc.)

While reading the manifest, flag dependency bloat:
- Multiple packages solving the same problem (e.g., 2+ ORMs, 2+ date libraries, 2+ state managers)
- Packages imported in source files but never actually used

While reading source files, flag security issues:
- Hardcoded secrets: grep for `['"].*(?:secret|password|key|token).*['"]` patterns assigned to variables
- Auth guards missing on route handlers that touch user data
- Configuration values scattered across files instead of centralized

Review the "Security findings" and "Anti-patterns" lists above. For each anti-pattern listed,
search the codebase for concrete instances. Record every violation with file name and line number.

Record all findings as problem areas to address in the plan.

### 2. Confirm the detected stack

Based on what you read, confirm or correct the detected stack (`{{skill.name}}`). If the stack
looks wrong, call:
```
architect context --techstack <correct-id>
```
Otherwise call:
```
architect context --techstack {{skills.detected}}
```

If `architect` is not found globally, fall back to:
```
architect context --techstack {{skills.detected}}
```

This may return blueprints for several detected stacks. Apply the rules from each  -  the primary
stack ({{skill.name}}) takes precedence on conflicts.

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
- Where does a file re-derive data already available from a shared utility? (inline filters,
  re-calculations, re-sorts that should be called once from a shared module)

**Check every anti-pattern from the list above.** For each anti-pattern in the "Anti-patterns to
look for" section, open the files most likely to violate it and record:
- The anti-pattern ID
- The file and line number
- What specifically is wrong (e.g., "business logic in controller: credit check on line 45")

**Enumerate exhaustively.** When you identify a problem pattern in a file, search for every
instance of that pattern in that file before writing the plan step. Do not write "remove the X
re-derivation" if X, Y, and Z are all the same pattern  -  list all three by name and line number
in the step's "What" field. Finding one instance is not license to move on.

Also enumerate from the pre-flight checks in step 1:
- Each duplicate-library pair → one cleanup step (remove the redundant one, update all callsites)
- Each hardcoded secret → one security step (move to env var + config module)
- Each missing auth guard → one security step
- Each security finding from the scan → one security step if not already covered

### 4b. Score the architecture

After identifying all problems, write a brief architectural assessment at the top of the plan.
Rate each of the 9 engineering principles 1-5 and give an overall score:

- **Separation of Concerns**: Are responsibilities split correctly? Do views/routes contain only
  HTTP handling, or do they also have DB queries, email sending, business logic?
- **SOLID Principles**: Single Responsibility per class? Open-Closed (extend not modify)?
  Dependency Inversion (depend on abstractions, not concretions)?
- **Layered Architecture**: Does data flow follow the stack's layer hierarchy (e.g.,
  Route → Controller → Service → Model)? Are layers skipped? Any reverse-direction imports?
- **DRY**: Is logic duplicated across files? Are there copy-paste patterns, duplicate utility
  functions, or contradictory implementations of the same business rule?
- **Security Patterns**: Secrets from environment only? Auth guards on routes? Input validated?
  No weak crypto?
- **Error Handling**: Domain-specific exceptions? No bare except/catch blocks? No swallowed
  errors? Typed error responses?
- **API Contracts**: Clean DTOs/serializers for input/output? Typed responses? Consistent
  error format?
- **Testability**: Do services accept plain data (not HTTP request objects)? Are layers
  independently testable? Is dependency injection used?
- **Config Management**: Centralized config module? Environment validated at startup?
  No scattered process.env/os.environ reads across app code?

Rate overall architecture 1-10 and explain the single biggest structural risk. This assessment
helps the developer understand why the refactoring matters  -  especially when the static scan
score is high but the architecture is poor.

Cross-reference your manual assessment with the static scan dimensions. The scan measures
separation, layered architecture, error handling, config management, API contracts, and
testability automatically. If the scan score for a dimension is high but you found problems,
explain why  -  the scan uses pattern matching and may miss nuanced violations.

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
  patterns, deleting superseded directories) into the mandatory cleanup phase at the end.
  Do not embed deletions inside constructive phases  -  deletions produce absence, which is easy
  for an agent to skip when surrounded by creation steps
- **Every file listed in "Largest files" that is OVERSIZED must appear in at least one phase.**
  Do not close the plan while any oversized file from that list is unaddressed. If a file is too
  risky to touch early, schedule it in a later phase — but it must be scheduled.
- **When splitting an oversized file, the step MUST name the sub-components or sub-modules
  to create**, each with a target LOC estimate. Do NOT write "extract to component" — write
  "split into `DashboardStats` (~60 LOC), `RecentAssessments` (~80 LOC), `RevenueChart`
  (~50 LOC), `DashboardFilters` (~40 LOC)". The agent needs concrete targets, not vague
  instructions. If a step says "move to component" without naming sub-components, the agent
  will create one monolithic component — which is just the god file in a new location.
- When a phase consolidates types into a single file (e.g., `types/index.ts`), add a follow-up
  step or phase to split it into domain-specific files if it exceeds 200 LOC after consolidation.
  Barrel-export from `index.ts` so consumers need no import changes.

**Principle-driven phases** (mandatory):
After writing your structural phases, review your 9-principle assessment from step 4b. For each
principle you rated 3 or below, the plan MUST include a dedicated phase to address it. Use the
stack skill's guidance as the blueprint for what "good" looks like. Map each weak principle to
concrete steps:

- **Separation of Concerns ≤ 3**: Create a phase to move DB queries out of views into
  selectors/repositories, move side effects (email, payment, notifications) into services
- **SOLID ≤ 3**: Create a phase to split god classes, extract interfaces for external
  dependencies, replace long if/elif chains with strategy pattern
- **Layered Architecture ≤ 3**: Create a phase to fix import direction violations  -  views
  must not import models directly when a service layer exists
- **DRY ≤ 3**: Create a phase to extract duplicate logic into shared utilities or services.
  List every duplicate pair with file:line
- **Security ≤ 3**: Create a phase to externalize secrets, add auth guards, replace weak
  crypto, add input validation
- **Error Handling ≤ 3**: Create a phase to add domain exception classes, replace bare
  except/catch with specific exceptions, add error response formatting
- **API Contracts ≤ 3**: Create a phase to add input/output serializers or DTOs to every
  route handler, separate request validation from response shaping
- **Testability ≤ 3**: Create a phase to remove framework coupling from services  -  services
  must accept plain data, not request objects. Add dependency injection where needed
- **Config Management ≤ 3**: Create a phase to centralize all env reads into a config module
  with validation. Remove scattered process.env/os.environ reads from app code

Do not skip this. If 5 principles score ≤ 3, the plan needs 5 principle phases (plus structural
phases). The whole point is that the refactored codebase is better across ALL principles, not
just file organization.

**Cleanup phase** (mandatory, always last):
The final phase MUST be "Cleanup: Remove Dead Code and Superseded Files." This phase deletes:
- All files/directories that were replaced by earlier phases (e.g., old `services/` dir after
  per-app services were created)
- Unreferenced exports and dead code
- Deprecated patterns
Every deletion must be explicit  -  list the file path and confirm it is fully superseded.
Do not leave old code alongside new code. Duplication from incomplete cleanup is the #1 cause
of regression in refactoring scores.

**Minimum**: at least 1 phase with at least 1 step. If the project already follows the
blueprint well, write a single phase with steps for minor cleanup and note "Structure largely
follows the {{skill.name}} blueprint."

### 6. Save baseline snapshot and initialize state tracking

After writing the plan, run:
```
architect scan . --snapshot .architect/scans/baseline.json
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

### 6b. Create a refactoring branch

Before any code changes happen, create a dedicated branch so the original code stays intact on
the current branch. This lets the developer compare before/after and revert if needed.

```bash
git checkout -b refactor/<today's date in YYYY-MM-DD>
```

If git is not initialized or the working tree is dirty, commit or stash first:
```bash
git add -A && git commit -m "chore: snapshot before architect refactoring"
git checkout -b refactor/<today's date in YYYY-MM-DD>
```

If branch creation fails (not a git repo, permissions, etc.), skip silently and continue  -
the refactoring still works without version control, it just loses the safety net.

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
