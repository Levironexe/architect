# Agent Integrations

`architect init` writes skill files into the correct directory for your coding agent. After installation, open your agent and run `/architect-plan` to get started.

Detect the agent automatically:

```bash
architect init .
# Checks for .claude/, .cursor/, .windsurf/ directories
```

Or specify explicitly:

```bash
architect init . --integration claude
architect init . --integration cursor
architect init . --integration windsurf
architect init . --integration copilot
```

## Claude Code

**Files written:**

```
.claude/
└── skills/
    ├── architect-plan/
    │   └── SKILL.md
    ├── architect-refactor/
    │   └── SKILL.md
    └── architect-catchup/
        └── SKILL.md
```

**How to use:**

1. Run `architect init . --integration claude` in your project directory
2. Open Claude Code in that directory
3. Type `/architect-plan` — the agent reads the skill and generates `.architect/plan.md`
4. Type `/architect-refactor` — the agent executes the plan phase by phase, verifying each phase
5. Type `/architect-catchup` — re-scans and refreshes skills after writing new code

Claude Code discovers skills in `.claude/skills/<name>/SKILL.md` automatically. No additional configuration needed.

## Cursor

**Files written:**

```
.cursor/
└── rules/
    └── architect.mdc
```

**How to use:**

1. Run `architect init . --integration cursor`
2. Open Cursor in the project directory
3. In the chat panel, type `/architect-plan`
4. Type `/architect-refactor` after reviewing the plan
5. Type `/architect-catchup` after writing new code to refresh skills

All three skills are bundled into a single `.mdc` file in Cursor's rules format.

## Windsurf

**Files written:**

```
.windsurf/
└── rules/
    └── architect.md
```

**How to use:**

1. Run `architect init . --integration windsurf`
2. Open Windsurf (Cascade) in the project directory
3. In the Cascade panel, type `/architect-plan`
4. Type `/architect-refactor` after reviewing the plan
5. Type `/architect-catchup` after writing new code to refresh skills

All three skills are bundled into a single markdown file in Windsurf's rules format.

## GitHub Copilot

**Files written:**

```
.github/
└── copilot-instructions.md  (Architect section appended)
```

**How to use:**

1. Run `architect init . --integration copilot`
2. Open VS Code with GitHub Copilot Chat enabled
3. In the chat panel, type `/architect-plan`
4. Type `/architect-refactor` after reviewing the plan
5. Type `/architect-catchup` after writing new code to refresh skills

If `.github/copilot-instructions.md` already exists, Architect appends the skill section rather than overwriting it. Use `--update` to replace the existing section.

## Generic Fallback

If no agent is detected and no `--integration` flag is passed, Architect writes to a generic location:

```
.architect/
└── skills/
    ├── architect-plan/
    │   └── SKILL.md
    ├── architect-refactor/
    │   └── SKILL.md
    └── architect-catchup/
        └── SKILL.md
```

Copy the contents of these files into your agent's context or rules directory manually.
