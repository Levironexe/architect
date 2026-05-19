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
      ├─ Scans every .js/.ts file   → LOC, complexity, imports, duplication
      ├─ Detects your stack         → express-api / nextjs-app-router / react-spa / …
      └─ Writes skill files         → /architect-plan, /architect-refactor, /architect-catchup

/architect-plan
      │
      ├─ Reads your codebase + fetches the architecture blueprint
      └─ Writes .architect/plan.md  → phased roadmap, each step has What / Why / Imports

/architect-refactor
      │
      ├─ Executes one phase at a time
      ├─ Announces every move before touching a file
      └─ Pauses after each phase for your approval

/architect-catchup
      │
      ├─ Re-scans the project
      └─ Overwrites skill files with fresh data → back to /architect-plan
```

---

## Agent Skills

After `architect init .`, three slash commands are available in your coding agent.

### `/architect-plan`

Reads your codebase, loads the architectural blueprint for your stack via `architect context`, and writes a phased refactoring roadmap to `.architect/plan.md`. Each step in the plan has:

- **What** — which file moves where
- **Why** — which separation rule this satisfies
- **Imports to update** — every file that needs patching after the move

After writing the plan, the agent prompts you to run `/architect-refactor`.

### `/architect-refactor`

Reads `.architect/plan.md` and executes each phase one step at a time. Supports resuming mid-plan. After each phase it stops and asks:

```
✅ Phase 1 complete: Extract service layer
Proceed to Phase 2 (Add controllers)?
```

Hard constraints: never touches business logic, never proceeds automatically, never modifies files outside the current step's scope.

### `/architect-catchup`

Refreshes your skill files after you've refactored or written new code.

1. Checks that skill files already exist — if not, tells you to run `architect init .` first
2. Runs `npx @levironexe/architect init . --update` to re-scan and overwrite
3. Prompts you to run `/architect-plan` to start a new cycle

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

Prints a structural health report without writing any files.

```bash
architect scan .
architect scan . --json           # machine-readable output
architect scan . --verbose        # include detailed diagnostics
architect scan . --no-color       # for CI
architect scan . --threshold "loc=400,complexity=20"
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

| Skill ID | Stack |
|----------|-------|
| `express-api` | Express.js REST API |
| `nextjs-app-router` | Next.js App Router |
| `react-spa` | React Single Page App |
| `general-js` | General JS/TS fallback |

Run `architect skill list` to see the full list including Python, C#, NestJS, and more.

---

## Contributing a Skill

Skills are YAML files in `skills/stacks/`. To add one:

1. Create `skills/stacks/<id>.skill.yaml` with the schema (see existing files for reference)
2. Add a detection fixture under `tests/fixtures/<id>/`
3. Run `npm test` — your skill must be detected and not conflict with existing ones
4. Open a pull request

---

## Prerequisites

- Node.js 20+ (LTS recommended)
- A supported AI coding agent (Claude Code, Cursor, GitHub Copilot, or Windsurf)
- A JavaScript or TypeScript project

---

## License

MIT — see [LICENSE](./LICENSE) for full terms.
