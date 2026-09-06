# Commands

Architect 1.0 has three commands: `check`, `verify` and `init`.

## `architect check [directory]`

Checks a project against its stack blueprint. Defaults to the current directory.

```bash
npx @levironexe/architect check .
```

### Flags

| Flag | Effect |
|------|--------|
| `--json` | Emit machine-readable JSON for CI and coding agents |
| `--list-rules` | Print every rule with its severity, then exit |
| `--baseline` | Write `.architect/baseline.json` instead of reporting |
| `--no-color` | Disable ANSI colour output |

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | No violations, or warnings only |
| `1` | At least one **critical** violation |
| `2` | No supported stack detected, or the directory does not exist |

Warnings alone do not fail the command. That is deliberate: a new user should be
able to adopt architect without a red build on day one, then tighten with
`verify --strict`.

### JSON output

```json
{
  "stack": "nextjs-app-router",
  "files_checked": 18,
  "violations": [
    {
      "rule": "direct_db_in_page",
      "severity": "critical",
      "file": "src/app/projects/page.tsx",
      "line": 24,
      "message": "Database client imported directly in a page or layout component.",
      "fix": "Move the query into lib/ and call that function from the page."
    }
  ],
  "summary": { "critical": 1, "warning": 0, "info": 0 }
}
```

`--list-rules --json` emits a different shape, one entry per rule:

```json
{
  "rules": [
    {
      "stack": "nextjs-app-router",
      "rule": "direct_db_in_page",
      "severity": "critical",
      "checkable": true,
      "description": "Database queries or external API calls are made directly inside page.tsx…"
    }
  ]
}
```

`checkable: false` means the rule has no `detect:` block — it is guidance for a
coding agent and is never reported by `check`.

## `architect verify [directory] --strict`

A ratchet. Existing violations are tolerated; new ones are not.

```bash
architect check . --baseline    # record where you are today
# …refactor, or let an agent work…
architect verify . --strict     # exit 1 if the count went up
```

`--baseline` writes `.architect/baseline.json`:

```json
{
  "created": "2026-09-07T10:00:00.000Z",
  "stack": "nextjs-app-router",
  "violations": 11,
  "critical": 4,
  "warning": 7
}
```

`verify` also runs a TypeScript compilation check and import resolution, and
reports new circular dependencies against the recorded snapshot.

| Flag | Effect |
|------|--------|
| `--strict` | Fail when violations or circular dependencies increase |
| `--phase <n>` | Save the snapshot as `phase-N` for a staged refactor |
| `--json` | Machine-readable output |
| `--no-color` | Disable ANSI colour output |

## `architect init <directory>`

Installs three Claude Code skills into `.claude/skills/`:

- `/architect-plan` — reads the codebase and writes a phased refactoring roadmap
- `/architect-refactor` — executes the plan phase by phase, verifying each one
- `/architect-catchup` — refreshes the skills after new code lands

| Flag | Effect |
|------|--------|
| `--skill <id>` | Override automatic stack detection |
| `--update` | Overwrite existing guidance files |

## Removed in 1.0

`scan`, `context`, `diff`, `status` and `skill list` no longer exist. `check`
replaces `scan`. If you depend on any of the others, pin `0.7.13`.
