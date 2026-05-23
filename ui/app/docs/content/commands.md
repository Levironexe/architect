# CLI Reference

All commands are available after `npm install -g @levironexe/architect`. Run `architect --help` for a summary at any time.

## architect init

Scans the project, detects the stack and agent, and writes skill files into your agent's config directory.

```bash
architect init .
architect init ./my-app --integration claude
architect init . --skill express-api --integration cursor
```

| Flag | Type | Description |
|------|------|-------------|
| `--integration <agent>` | `claude \| cursor \| windsurf \| copilot \| generic` | Skip agent auto-detection and write for a specific agent |
| `--skill <id>` | string | Override stack auto-detection and use a specific skill ID |
| `--update` | boolean | Overwrite existing Architect skill files (skipped by default if they exist) |

**What it does:**

1. Detects project language via config files (`package.json`, `pyproject.toml`, `*.csproj`, `pom.xml`, `build.gradle`) or file extensions
2. Reads dependencies from the detected config file
3. For JS/TS: runs full static analysis (file sizes, import graph, circular deps, duplication, security, dead code)
4. For Python/C#/Java: skips scanning, proceeds directly to skill matching
5. Matches dependencies + file patterns against skill detection rules → selects best skill
6. Detects agent by checking for `.claude/`, `.cursor/`, `.windsurf/` dirs — or uses `--integration`
7. Renders skill file templates and writes to the agent-specific directory

**Example output:**

```
✓ Detected stack:  Express.js REST API (express-api)
✓ Detected agent:  Claude Code
✓ Installed 3 skills:
    /architect-plan     → .claude/skills/architect-plan/SKILL.md
    /architect-refactor → .claude/skills/architect-refactor/SKILL.md
    /architect-catchup  → .claude/skills/architect-catchup/SKILL.md

Open Claude Code and run /architect-plan to get started.
```

## architect scan

Runs static analysis and prints a structural health report. No agent required, no LLM calls. Works for all 4 supported languages — JS/TS gets full analysis (complexity, imports, circular deps), while Python, C#, and Java get lite analysis (LOC, duplication, security, file-size health score).

```bash
architect scan .
architect scan ./my-app --json
architect scan . --threshold loc=400,complexity=20
```

| Flag | Type | Description |
|------|------|-------------|
| `--json` | boolean | Emit machine-readable JSON instead of the terminal report |
| `--verbose` | boolean | Include detailed scan diagnostics |
| `--threshold <values>` | string | Override default thresholds, e.g. `loc=300,complexity=15` |
| `--snapshot <path>` | string | Save scan results as a JSON snapshot to the given path (used for before/after comparison with `architect diff`) |
| `--no-color` | boolean | Disable ANSI color output |

**Example output:**

```
Detected skill: express-api v1.1.0

STRUCTURE
  ✓ src/routes/       exists
  ✗ src/controllers/  missing
  ✗ src/services/     missing
  ✓ src/models/       exists

METRICS
  Largest files:  src/index.js (1,247 LOC), src/routes/users.js (340 LOC)
  Hub files:      src/db.js (imported by 8 files)
  Duplication:    14%
  Circular deps:  src/models/user.js ↔ src/services/auth.js

Run `architect init .` to install /architect-plan in your coding agent.
```

## architect diff

Compares scan snapshots to show before/after metrics. Requires at least a baseline snapshot in `.architect/scans/`.

```bash
architect diff .
architect diff . --phase 2
architect diff . --json
```

| Flag | Type | Description |
|------|------|-------------|
| `--phase <N>` | number | Compare a specific phase snapshot against the baseline (defaults to latest) |
| `--json` | boolean | Emit machine-readable JSON instead of the terminal table |
| `--no-color` | boolean | Disable ANSI color output |

**Example output:**

```
                    Before    After     Delta
Health score        42        67        +25 ▲
Flagged files       8         3         -5  ▼
Duplication         14%       8%        -6% ▼
Circular deps       2         0         -2  ▼
Avg file LOC        312       147       -165 ▼
God files (>300)    5         1         -4  ▼
```

## architect status

Shows refactoring progress by reading `.architect/state.json`. Displays which phases are complete, in progress, or pending, along with health score changes.

```bash
architect status .
architect status . --json
```

| Flag | Type | Description |
|------|------|-------------|
| `--json` | boolean | Emit machine-readable JSON instead of the terminal report |
| `--no-color` | boolean | Disable ANSI color output |

**Example output:**

```
Architect Refactoring Progress

Plan: .architect/plan.md (8 phases)
Health: 42 → 58 (+16)

  ✓ Phase 1: Types and Constants
  ✓ Phase 2: Static Data Extraction
  ◐ Phase 3: Homepage Components (in progress)
  ○ Phase 4: Dashboard Components
  ○ Phase 5: PetManager Split
  ○ Phase 6: Data Access Layer
  ○ Phase 7: RSC Conversion
  ○ Phase 8: Dead Code Removal

Progress: 2/8 phases complete (25%)
Next: Phase 3 — Homepage Components

Run /architect-refactor to continue.
```

## architect verify

Runs post-phase verification checks and health score comparison. For JS/TS: includes TypeScript compilation, import resolution, and circular dependency detection. For Python, C#, and Java: runs scan delta comparison only. Saves a scan snapshot after verification.

```bash
architect verify .
architect verify . --phase 3
architect verify . --json
```

| Flag | Type | Description |
|------|------|-------------|
| `--phase <N>` | number | Tag this verification with a phase number (saves snapshot as `phase-N.json`) |
| `--json` | boolean | Emit machine-readable JSON instead of the terminal report |
| `--no-color` | boolean | Disable ANSI color output |

**Example output:**

```
Verifying Phase 3: Homepage Components

  ✓ TypeScript compilation    (0 errors)
  ✓ Import resolution         (0 broken imports)
  ✓ No new circular deps      (0 → 0)
  ⚠ Duplication increased     (14% → 15%)
  ✓ Health score improved     (42 → 52, +10)

Phase 3 verification: PASSED
Snapshot saved: .architect/scans/phase-3.json
```

## architect context

Prints the full architectural blueprint for one or more skills as plain text. Called by the agent skill during `/architect-plan` — you typically don't run this manually.

```bash
architect context                                      # auto-detect stack from current directory
architect context --techstack express-api              # specify stack explicitly
architect context --techstack nextjs-app-router prisma # multiple stacks
```

| Flag | Type | Description |
|------|------|-------------|
| `--techstack <ids...>` | string[] (optional) | One or more skill IDs to render. When omitted, auto-detects the stack by scanning the current directory. |

The blueprint is printed to stdout. The agent reads it as part of its context window and uses it to compare your current structure against best practices.

## Agent Skills (slash commands)

These are not CLI commands — they are skill files written into your agent's config directory by `architect init`. Run them inside your coding agent (Claude Code, Cursor, etc.).

### `/architect-plan`

Reads your codebase, fetches the architecture blueprint via `architect context`, and writes a phased refactoring roadmap to `.architect/plan.md`. Also creates a baseline scan snapshot at `.architect/scans/baseline.json` and initializes phase tracking in `.architect/state.json`. After writing the plan it prompts:

```
✅ Plan written to .architect/plan.md — N phases, M total steps.
✅ Baseline snapshot saved to .architect/scans/baseline.json
✅ State tracking initialized in .architect/state.json
Ready to start? Run /architect-refactor to execute Phase 1.
```

### `/architect-refactor`

Reads `.architect/plan.md` and executes each phase one step at a time. Announces every file move before touching anything. After each phase, runs `architect verify` to check compilation, imports, and health score. Updates `.architect/state.json` with phase completion status. Pauses after each phase for your confirmation before continuing.

If a previous session was interrupted, `/architect-refactor` reads `state.json` to find the next pending phase and resumes from there.

### `/architect-catchup`

Re-scans the project and refreshes the skill files after you've refactored or written new code.

1. Checks that `.claude/skills/architect-plan/SKILL.md` and `.claude/skills/architect-refactor/SKILL.md` exist — if not, stops and tells you to run `architect init .` first
2. Runs `npx @levironexe/architect init . --update` to overwrite skill files with fresh scan data
3. Saves a fresh snapshot and shows a before/after comparison via `architect diff`
4. Prompts you to run `/architect-plan` to start a new plan cycle

---

## .architect/ Directory Structure

When you run `/architect-plan` and `/architect-refactor`, Architect creates and manages files in a `.architect/` directory at your project root:

```
.architect/
├── plan.md              # Phased refactoring roadmap (created by /architect-plan)
├── state.json           # Phase completion tracking (created by /architect-plan)
└── scans/
    ├── baseline.json    # Scan snapshot before refactoring starts
    ├── phase-1.json     # Scan snapshot after phase 1 verification
    ├── phase-2.json     # Scan snapshot after phase 2 verification
    └── ...
```

- **plan.md** — the refactoring roadmap with phase markers (`<!-- status: completed -->`) updated as the agent works
- **state.json** — machine-readable phase tracking: which phases are pending, in progress, or completed, plus health score history
- **scans/** — JSON snapshots from `architect scan --snapshot`, used by `architect diff` to show before/after metrics

---

## architect skill list

Lists all available built-in skills, marking which ones are active (detected) in the current directory.

```bash
architect skill list
```

**Example output:**

```
STACK SKILLS
  ● express-api          Express.js REST API            (active)
  ○ nextjs-app-router    Next.js App Router
  ○ react-spa            React Single Page Application
  ○ nestjs               NestJS
  ...

META SKILLS (always applied with a stack skill)
  ● general-js           General JavaScript/TypeScript  (active)

INTEGRATION SKILLS
  ○ prisma               Prisma ORM
  ○ supabase             Supabase
  ...
```
