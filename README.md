<div align="center">
  <h1>🏛️ Architect</h1>
  <h3><em>Fix vibe-coded projects without breaking them.</em></h3>
</div>

<p align="center">
  <strong>A CLI tool that scans your JavaScript or TypeScript codebase, detects its architecture pattern, and installs agent skills that guide your coding agent through a safe, phased refactoring.</strong>
</p>

<p align="center">
  <a href="https://github.com/Levironexe/architect-cli/releases/latest"><img src="https://img.shields.io/github/v/release/Levironexe/architect-cli" alt="Latest Release"/></a>
  <a href="https://www.npmjs.com/package/@levironexe/architect"><img src="https://img.shields.io/npm/v/@levironexe/architect" alt="npm version"/></a>
  <a href="https://github.com/Levironexe/architect-cli/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Levironexe/architect-cli" alt="License"/></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen" alt="Node.js 20+"/>
</p>

---

## Table of Contents

- [🤔 What problem does it solve?](#-what-problem-does-it-solve)
- [⚡ Quick Start](#-quick-start)
- [🔄 How It Works](#-how-it-works)
- [🤖 Supported Agents](#-supported-agents)
- [🗂️ Built-in Architecture Skills](#️-built-in-architecture-skills)
- [🔧 Command Reference](#-command-reference)
- [📋 The Refactoring Skills](#-the-refactoring-skills)
- [🛠️ How to Contribute a Skill](#️-how-to-contribute-a-skill)
- [🔧 Prerequisites](#-prerequisites)
- [📄 License](#-license)

---

## 🤔 What problem does it solve?

Vibe coding is fast. Cleanup is hard.

When you ship quickly with an AI agent  -  or inherit a fast-moving codebase  -  you often end up with:

- **God files**  -  one 800-line `index.ts` doing routing, DB queries, and business logic at once
- **Wrong structure**  -  everything in the root, no `services/`, no `controllers/`, no separation
- **Risky refactors**  -  you know something needs to move, but you don't know what it will break

**Architect** solves this in three steps:

1. **Scan**  -  static analysis tells you exactly what's wrong (file sizes, complexity, duplication, dependency risks)
2. **Plan**  -  your coding agent reads the analysis, loads the architecture blueprint for your stack, and writes a safe, phased refactoring plan
3. **Execute**  -  the agent executes the plan one phase at a time, explaining every move and pausing for your approval before proceeding

No LLM API keys. No cloud. Architect is a local CLI that hands off to the agent already open in your editor.

---

## ⚡ Quick Start

### 1. Install the CLI

```bash
npm install -g @levironexe/architect
```

### 2. Initialize your project

```bash
cd your-project
architect init .
```

This scans your project, detects your stack (Express, Next.js, React SPA, etc.), and installs two skills into your coding agent's config directory.

### 3. Open your agent and plan the refactor

In Claude Code (or any supported agent), run:

```
/architect-plan
```

The agent reads the analysis, fetches the architecture blueprint for your stack, and writes a phased refactoring roadmap to `.architect/plan.md`.

### 4. Execute the plan

```
/architect-refactor
```

The agent executes Phase 1, announces every file move before touching anything, updates all imports, and pauses:

```
✅ Phase 1 complete: Extract service layer

Proceed to Phase 2 (Add controllers)? yes / no
```

You control the pace. The agent does the work.

---

## 🔄 How It Works

```
architect init .
      │
      ▼
  Scan project            ← file sizes, complexity, imports, duplication
      │
      ▼
  Detect stack            ← express-api / next-app / react-spa / general-js
      │
      ▼
  Install agent skills    ← /architect-plan and /architect-refactor
      │
      ▼
  /architect-plan         ← agent loads analysis + blueprint → writes .architect/plan.md
      │
      ▼
  /architect-refactor     ← agent executes plan phase by phase, pauses between phases
```

### What `architect init` does under the hood

1. Walks your source tree (skipping `node_modules/`, `.git/`, `dist/`)
2. Parses every `.js`, `.jsx`, `.ts`, `.tsx` file with Babel
3. Computes: lines of code, cyclomatic complexity, import/export graph, duplication %, hub files
4. Detects your stack from `package.json` dependencies and source patterns
5. Embeds the analysis results into two SKILL.md files and writes them into your agent's config directory (e.g., `.claude/skills/architect-plan/SKILL.md`)

When your agent runs `/architect-plan`, it reads those pre-computed numbers  -  so it knows where the problems are before it opens a single file.

---

## 🤖 Supported Agents

| Agent | Status | Skills installed to |
|-------|--------|---------------------|
| **Claude Code** | ✅ Supported | `.claude/skills/` |
| **GitHub Copilot** | ✅ Supported | `.github/copilot-instructions.md` |
| **Cursor** | ✅ Supported | `.cursor/rules/` |
| **Windsurf** | ✅ Supported | `.windsurf/rules/` |
| **Generic** | ✅ Supported | `.architect/skills/` (plain Markdown) |

Architect auto-detects which agent is installed in your project. Override with `--integration <agent>`.

---

## 🗂️ Built-in Architecture Skills

Each skill defines what an ideal project structure looks like for a given stack  -  required directories, separation rules, and anti-patterns. Architect uses the skill to generate your plan and constrain your refactor.

| Skill ID | Stack | Detects via |
|----------|-------|-------------|
| `express-api` | Express.js REST API | `express` in `package.json` |
| `next-app` | Next.js App Router | `next` in `package.json` |
| `react-spa` | React Single Page App | `react` + no `next` |
| `general-js` | General JS/TS | Fallback for any JS/TS project |

Check active skills in your current directory:

```bash
architect skill list
```

---

## 🔧 Command Reference

### `architect init <directory>`

Scans the project, detects the stack, and installs agent skill files.

```bash
architect init .                          # auto-detect everything
architect init . --skill express-api      # override stack detection
architect init . --integration claude     # override agent detection
architect init . --update                 # overwrite existing skill files
```

**Edge cases handled:**
- **Empty directory** → `No source files found. Point architect at a JS/TS project root.`
- **No `package.json`** → warns and continues with file-pattern detection
- **Unrecognized stack** → `Could not detect stack. Override with --skill <id>.`
- **Large project (>500 files)** → shows progress spinner during scan

---

### `architect scan [directory]`

Analyzes your project and reports structural health metrics  -  without writing any files.

```bash
architect scan .
architect scan . --json          # machine-readable JSON
architect scan . --verbose       # detailed diagnostics per file
architect scan . --no-color      # for CI environments
architect scan . --threshold "loc=400,complexity=20"   # custom thresholds
```

**Output includes:**
- Total files, lines of code, average complexity
- Files over the LOC threshold (default: 300 lines)
- Functions over the complexity threshold (default: 15)
- Hub files (imported by many  -  risky to touch)
- Code duplication percentage

---

### `architect context --techstack <id>`

Fetches and prints the full architecture blueprint for a stack. Called automatically by `/architect-plan`.

```bash
architect context --techstack express-api
architect context --techstack next-app react-spa    # multiple stacks
```

---

### `architect skill list`

Lists all available skills. Skills installed in the current directory's agent config are marked `[active]`.

```bash
architect skill list
```

Example output:

```
Available skills:

  express-api   [active]   Express.js REST API
  next-app                 Next.js App Router
  react-spa                React Single Page Application
  general-js               General JavaScript/TypeScript
```

---

## 📋 The Refactoring Skills

After `architect init .`, your agent has two new skills:

### `/architect-plan`

The agent will:

1. Read `package.json` and the 3 largest source files to understand current structure
2. Call `npx @levironexe/architect context --techstack <detected>` to load the full blueprint
3. Compare current vs target directory structure
4. Write `.architect/plan.md`  -  a phased roadmap where each step specifies:
   - **What**: which file moves where
   - **Why**: which separation rule this satisfies
   - **Imports to update**: every file that needs to be patched after the move

**Pass criteria** (what a good plan looks like):
- ≥ 2 phases for a messy project, ≤ 1 phase for a clean one
- Phase 1 targets the biggest structural problem first (lowest risk, highest impact)
- Every step has `What`, `Why`, and `Imports to update` fields
- Agent asks zero clarifying questions  -  it just makes the plan

---

### `/architect-refactor`

The agent will:

1. Check for `.architect/plan.md`  -  if missing, prints `❌ No refactoring plan found. Run /architect-plan first.` and stops
2. Find the first phase with unchecked steps (supports resuming mid-plan)
3. For each step, announce intent before touching any file: `"Step 1.2: Moving src/server.ts → src/app.ts. Reason: …"`
4. Execute the move, update all listed imports, mark the step `[x]` in the plan
5. After the last step in the phase, output the phase-gate message and **stop**:

```
✅ Phase 1 complete: Extract service layer

Proceed to Phase 2 (Add controllers)? yes / no
```

**Hard constraints the agent follows:**
- Never touches business logic  -  structural moves only
- Never proceeds to the next phase automatically
- Never modifies files outside the current step's scope

---

## 🛠️ How to Contribute a Skill

Skills are YAML files (with a Markdown body for the blueprint) that live in `skills/stacks/` or `skills/meta/`.

**To add a new skill:**

1. Create `skills/stacks/<your-skill-id>.skill.yaml` following the schema:

```yaml
schema_version: "2.0.0"
id: your-skill-id
name: "Human Readable Name"
version: "1.0.0"
description: "What this architecture pattern looks like."
category: stack        # stack | meta
language: javascript
frameworks:
  - your-framework
detection:
  dependencies:
    any:
      - framework-package-name
structure:
  required_dirs:
    - path: src/your-dir
      purpose: "What belongs here."
separation:
  rules:
    - rule_text: "Business logic MUST NOT live in route handlers."
      example: "// good: call service from route\nrouter.get('/', (req, res) => userService.getAll())"
anti_patterns:
  - name: God File
    description: "Everything in one file."
    bad_example: "// 600-line server.js with routes + DB + auth"
    good_example: "// separate files per concern"
```

2. Add a detection fixture under `tests/fixtures/<your-skill-id>/`  -  a minimal project that should match your skill
3. Run `npm test`  -  your skill must be detected and not conflict with existing ones
4. Open a pull request with the skill file and fixture

See existing skills in `skills/stacks/` for complete examples.

---

## 🔧 Prerequisites

- **Node.js 20+** (LTS recommended)
- A supported AI coding agent (Claude Code, Cursor, GitHub Copilot, or Windsurf)
- A JavaScript or TypeScript project to analyze

---

## 📄 License

MIT  -  see [LICENSE](./LICENSE) for full terms.
