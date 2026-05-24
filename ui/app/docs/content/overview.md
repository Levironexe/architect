# Architect Documentation

Architect installs stack-specific architectural skills into your coding agent. No API keys. No LLM calls. Just the right knowledge, in the right place.

## What is Architect?

Architect is a CLI tool that reads your existing project, detects your tech stack, and writes skill files into your coding agent's config directory. Those skill files give your agent — Claude Code, Cursor, Windsurf, or Copilot — a precise architectural blueprint for your stack.

Three slash commands are installed:

- **`/architect-plan`** — the agent walks your codebase, compares it against the blueprint, writes a phased refactoring roadmap to `.architect/plan.md`, and saves a baseline scan snapshot
- **`/architect-refactor`** — the agent executes the plan phase by phase, verifying each phase compiles and improves health before continuing. Tracks progress in `.architect/state.json` so it can resume if interrupted
- **`/architect-catchup`** — after you've written new code or finished a refactor, re-scans the project and refreshes the skill files so your agent's guidance stays current

Three CLI commands support the workflow:

- **`architect diff`** — compares scan snapshots to show before/after metrics (health score, duplication, circular deps, file sizes)
- **`architect status`** — shows which refactoring phases are complete, in progress, or pending
- **`architect verify`** — runs post-phase checks (compilation, import resolution, health score) and saves a scan snapshot

Architect itself calls no LLM. Your agent is the intelligence. Architect gives it the right context to act on.

## How It Works

**Step 1 — Install skills into your agent**

```bash
npm install -g @levironexe/architect
architect init . --integration claude
```

Architect detects your project language (JavaScript/TypeScript, Python, C#, or Java), identifies the stack or framework, and writes three skill files into your agent's config directory.

**Step 2 — Generate a refactoring plan**

Open your coding agent and run:

```
/architect-plan
```

The agent reads the installed skill, calls `npx @levironexe/architect context` to load the full architectural blueprint for your stack, compares it against your current codebase, and writes a phased refactoring roadmap to `.architect/plan.md`. It also saves a baseline scan snapshot and initializes phase tracking.

**Step 3 — Execute the plan**

```
/architect-refactor
```

The agent reads `.architect/plan.md` and executes each phase one at a time, explaining what it's doing. After each phase it runs `architect verify` to confirm the code compiles, imports resolve, and health score improves. It pauses after each phase and waits for your confirmation before continuing.

If the session is interrupted, run `/architect-refactor` again — it reads `.architect/state.json` to find where it left off and resumes from the next pending phase.

**Step 3.5 — Check progress and metrics**

At any point during or after refactoring, you can check progress and see quantitative improvement:

```bash
architect status .     # see which phases are done/pending
architect diff .       # see before/after metrics comparison
```

## Quickstart

```bash
# 1. Install the CLI
npm install -g @levironexe/architect

# 2. Point it at your project
architect init . --integration claude

# Output:
# ✓ Detected stack:  Express.js REST API (express-api)
# ✓ Detected agent:  Claude Code
# ✓ Installed 3 skills:
#     /architect-plan     → .claude/skills/architect-plan/SKILL.md
#     /architect-refactor → .claude/skills/architect-refactor/SKILL.md
#     /architect-catchup  → .claude/skills/architect-catchup/SKILL.md

# 3. Open Claude Code and run:
# /architect-plan      → generates .architect/plan.md + baseline snapshot
# /architect-refactor  → executes the plan, verifies each phase
# /architect-catchup   → refresh skills after writing new code

# 4. Check progress and metrics at any time:
# architect status .   → see phase completion progress
# architect diff .     → see before/after health metrics
```

**Step 4 — Keep skills fresh as your codebase evolves**

After refactoring and writing new code, run:

```
/architect-catchup
```

This re-scans the project and refreshes the skill files so your agent's analysis reflects the current state of the codebase.

## Next Steps

- [Commands](/docs/commands) — full CLI reference with all flags and examples
- [Skills](/docs/skills) — how the skill system works, built-in skills list, SKILL.md schema
- [Agent Integrations](/docs/integrations) — per-agent setup and exact file paths
- [Contributing](/docs/contributing) — write and submit your own skill
