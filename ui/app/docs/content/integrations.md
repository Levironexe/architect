# Integrations

Architect 1.0 targets **Claude Code**. Cursor, Windsurf and GitHub Copilot output
writers were removed — if you need them, pin `0.7.13`.

## GitHub Actions

Six lines. Fails the build on any critical violation, because `check` exits `1`.

```yaml
name: architecture
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npx @levironexe/architect check .
```

### Ratcheting an existing project

A codebase with existing violations should not go red on day one. Commit a
baseline, then fail only on regressions:

```yaml
      - run: npx @levironexe/architect verify . --strict
```

Generate the baseline once and commit it:

```bash
npx @levironexe/architect check . --baseline
git add .architect/baseline.json
```

## Claude Code

### The Stop hook

This is the piece worth setting up. It runs `check` after every agent turn, so
the agent sees what it broke before you do.

In `.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "npx @levironexe/architect check . --json"
          }
        ]
      }
    ]
  }
}
```

The JSON lands back in the session, so the agent can read the `file`, `line` and
`fix` fields and correct itself without you having to notice first.

### The skills

```bash
npx @levironexe/architect init .
```

Installs three skills into `.claude/skills/`:

| Skill | What it does |
|-------|--------------|
| `/architect-plan` | Reads the codebase and the blueprint, writes a phased roadmap to `.architect/plan.md` |
| `/architect-refactor` | Executes the plan phase by phase, running `verify` after each one |
| `/architect-catchup` | Refreshes the skills after new code lands |

The skills read the blueprint's `description`, `bad_example` and `good_example`
fields — including for `auth_mechanism_mismatch`, which `check` never reports.
The agent gets more guidance than the linter enforces, by design.

## Any other agent

There is no dedicated writer, but `check --json` is a stable contract. Any tool
that can run a command and read JSON can consume it:

```bash
npx @levironexe/architect check . --json | jq '.violations[] | "\(.file):\(.line) \(.fix)"'
```
