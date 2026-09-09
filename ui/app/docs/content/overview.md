# Overview

Architect is an **architecture linter for Next.js App Router projects written in
TypeScript**. It answers one question that other tools do not: given this stack's
blueprint, is this file in the layer it belongs to?

## See it work

```bash
npx @levironexe/architect check .
```

```
✗ src/app/projects/page.tsx:24
    Database client imported directly in a page or layout component.
    → Move the query into lib/ and call that function from the page.
      direct_db_in_page

✗ src/components/TaskCard.tsx:3
    components/ imports from app/, which inverts the dependency direction.
    → Pass the value in as a prop, or move the shared code to lib/.
      illegal_import

⚠ src/app/dashboard/layout.tsx:1
    'use client' on a layout turns the whole subtree into a client bundle.
    → Remove the directive here and mark only the interactive leaf component.
      use_client_everywhere

3 violations (2 critical, 1 warning) · 18 files checked · nextjs-app-router
```

Exit code is `1` when anything critical is found, so it fails CI with no extra
configuration. No install, no config file, no API key, no model call — the rules
are deterministic.

## Why it exists

Every other tool in this category reports what is *wrong*: dead code, duplication,
circular dependencies, complexity hotspots. None of them tells you where the code
should have *gone*.

The enforcement engines for that do exist — `eslint-plugin-boundaries` and
`dependency-cruiser` — but you have to write every rule yourself, and
`eslint-config-next` explicitly will not enforce that data access goes through a
data layer.

Architect ships those rules for your stack, already written. Ten of them are
checked deterministically; one stays as guidance for a coding agent to read.

## How it works

```
architect check .
      │
      ├─ Detects the stack        → nextjs-app-router
      ├─ Parses every TS/TSX file → imports, calls, directives, members
      ├─ Evaluates the blueprint  → 10 detect: rules + required directories
      └─ Reports violations       → file, line, what to do, rule id
```

Rules live in the blueprint (`skills/stacks/nextjs-app-router/SKILL.md`) as
machine-readable `detect:` blocks, not in TypeScript. Adding a rule means writing
YAML and two fixtures. See [Contributing](/docs/contributing).

## Where to go next

- [Commands](/docs/commands) — `check`, `verify`, `init`, flags and exit codes
- [Rules](/docs/skills) — all eleven rules and the `detect:` schema
- [Integrations](/docs/integrations) — GitHub Actions and the Claude Code hook
- [Contributing](/docs/contributing) — how to add a rule

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
