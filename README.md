<div align="center">
  <h1>🏛️ Architect</h1>
  <h3><em>Your code compiles. Is it in the right place?</em></h3>
</div>

<p align="center">
  <strong>An architecture linter for Next.js App Router projects written in TypeScript. Ten deterministic rules, no model call, exit 1 on a violation.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@levironexe/architect"><img src="https://img.shields.io/npm/v/@levironexe/architect" alt="npm version"/></a>
  <a href="https://github.com/Levironexe/architect/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Levironexe/architect" alt="License"/></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen" alt="Node.js 20+"/>
</p>

---

## Quick Start

```bash
npx @levironexe/architect check .
```

No install, no config, no API keys. Or install it globally:

```bash
npm install -g @levironexe/architect
architect check .
```

```
✗ src/app/projects/page.tsx:24
    Database client imported directly in a page or layout component.
    → Move the query into lib/ and call that function from the page.
      direct_db_in_page

⚠ src/components/TaskCard.tsx:7
    alert() used to surface an error to the user.
    → Render the error in the UI, or use a toast component.
      alert_for_errors

2 violations (1 critical, 1 warning) · 18 files checked · nextjs-app-router
```

Exit code is `1` when anything critical is found, so it fails CI as-is.

---

## Why this exists

Every other tool in this space tells you what is *wrong*: dead code, duplication,
cycles, complexity. None of them tells you where the code should have *gone*.

`eslint-plugin-boundaries` and `dependency-cruiser` can enforce layer rules — but
you have to write every rule yourself, and `eslint-config-next` explicitly will not
enforce that data access goes through a data layer.

Architect ships those rules for your stack, already written.

---

## Command Reference

### `architect check [directory]`

Check a project against its stack blueprint. Defaults to the current directory.

| Flag | Effect |
|------|--------|
| `--json` | Machine-readable output for CI and agents |
| `--list-rules` | Print every rule with its severity, then exit |
| `--baseline` | Write `.architect/baseline.json` instead of reporting |
| `--no-color` | Disable ANSI colour |

**Exit codes:** `0` clean · `1` critical violations · `2` no supported stack, or the directory does not exist.

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

### `architect verify [directory] --strict`

Fails when the violation count rises against `.architect/baseline.json`. Use it as a
ratchet: existing violations are tolerated, new ones are not.

```bash
architect check . --baseline    # record where you are today
architect verify . --strict     # exit 1 if it got worse
```

### `architect init <directory>`

Installs three Claude Code skills — `/architect-plan`, `/architect-refactor`,
`/architect-catchup` — into `.claude/skills/`.

| Flag | Effect |
|------|--------|
| `--skill <id>` | Override automatic stack detection |
| `--update` | Overwrite existing guidance files |

---

## The rules

Ten are checked automatically. One is agent-only guidance: it stays in the blueprint
for a coding agent to read, but is never reported by `check`.

| Rule | Severity | Fires when |
|------|----------|-----------|
| `direct_db_in_page` | critical | A database client is imported in `page.tsx` or `layout.tsx` |
| `direct_db_in_route` | critical | A database client is imported in `route.ts` |
| `leaked_server_secret` | critical | A `'use client'` file reads a non-`NEXT_PUBLIC_` env var |
| `illegal_import` | critical | `components/` imports from `app/` |
| `use_client_everywhere` | warning | `'use client'` sits on a layout |
| `client_data_fetching_by_default` | warning | A client component fetches in `useEffect` |
| `server_action_throws` | warning | A Server Action throws instead of returning a result |
| `scattered_process_env` | warning | `process.env` is read outside `lib/config.ts` |
| `alert_for_errors` | warning | `alert()` is used to show an error |
| `oversized_extraction` | warning | A file exceeds 300 LOC |
| `missing_layer` | warning | A required directory from the blueprint does not exist |
| `auth_mechanism_mismatch` | — | Agent guidance only; not checked |

Run `architect check --list-rules` for the current list straight from the blueprint.

---

## Continuous integration

```yaml
- uses: actions/setup-node@v4
  with: { node-version: 20 }
- run: npx @levironexe/architect check . --json
```

## Claude Code hook

Run `check` after every agent turn so the agent sees what it broke before you do.
In `.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          { "type": "command", "command": "npx @levironexe/architect check . --json" }
        ]
      }
    ]
  }
}
```

---

## Non-goals

Architect checks one thing: whether your code is in the right place. It
deliberately does not do these, and will not grow into them — each one is
already solved better elsewhere:

| Not this | Use this instead |
|----------|------------------|
| Duplicate code detection | [jscpd](https://github.com/kucherenko/jscpd) |
| Dead code, unused exports | [knip](https://github.com/webpro-nl/knip) |
| Secret scanning | [gitleaks](https://github.com/gitleaks/gitleaks) |
| A 0–100 health score | [fallow](https://github.com/fallow-rs/fallow) |
| Any language but TypeScript | — |
| Any stack but Next.js App Router | — |
| Auto-fixing violations | your coding agent |

If you want a broad codebase scanner, use fallow. Architect answers a
narrower question that scanners do not: given this stack's blueprint,
is this file in the layer it belongs to?

---

## Adding a rule

Rules live in the blueprint, not in code. Add a `detect:` block to an anti-pattern in
`skills/stacks/nextjs-app-router/SKILL.md`:

```yaml
- id: direct_db_in_page
  severity: critical
  detect:
    kind: import
    paths: ["app/**/page.tsx", "app/**/layout.tsx"]
    modules: ["@prisma/client", drizzle-orm, mongoose]
    message: "Database client imported directly in a page or layout component."
    fix: "Move the query into lib/ and call that function from the page."
```

Every rule needs a fixture with a known violation **and** a fixture proving it stays
silent on correct code. See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Prerequisites

Node.js 20 or newer.

## License

MIT. See [LICENSE](LICENSE).
