# Contributing

Architect is an architecture linter for Next.js App Router projects written in
TypeScript. Contributions that widen that scope will be declined — see the
Non-goals section of the README. Contributions that add **rules** are the ones
this project wants.

## Local Setup

```bash
git clone https://github.com/Levironexe/architect.git
cd architect/architect-cli
npm install
npm run build
npm run lint
npm test
```

`tests/fixtures/` is tracked in git, so the suite runs on a fresh clone with no
extra setup.

## Adding a rule

Rules live in the blueprint, not in TypeScript. You add YAML.

### 1. Write the `detect:` block

In `skills/stacks/nextjs-app-router/SKILL.md`, find or add an anti-pattern and
give it a `detect:` block:

```yaml
- id: direct_db_in_page
  severity: critical            # critical | warning | info
  detect:
    kind: import
    paths: ["app/**/page.tsx", "app/**/layout.tsx"]
    modules: ["@prisma/client", drizzle-orm, mongoose]
    message: "Database client imported directly in a page or layout component."
    fix: "Move the query into lib/ and call that function from the page."
  description: "..."            # read by the coding agent, not by check
  bad_example: |  ...
  good_example: |  ...
```

An anti-pattern **without** a `detect:` block is agent-only guidance: it stays in
the blueprint for a coding agent to read and is never reported by `check`. That is
the right home for anything requiring real semantic judgement.

### 2. Pick a matcher kind

| `kind` | Fires when | Key fields |
|--------|-----------|------------|
| `import` | A module is imported inside `paths` | `modules` |
| `import_direction` | A file under `from` imports one under `to` | `from`, `to` |
| `directive` | A file carries a directive prologue | `value` |
| `call` | A named function is called | `callee` |
| `member` | A member expression appears | `object`, `property` |
| `throw` | A `throw` statement appears | — |
| `metric` | A file metric exceeds a ceiling | `metric`, `gt` |

Shared fields: `paths` and `not_paths` scope the rule; `requires_directive` and
`requires_call` add guards; `not_matching` excludes matched text by prefix.

Paths are globs anchored at a **segment boundary**, not the repo root, so
`app/**/page.tsx` matches `app/users/page.tsx` and `src/app/users/page.tsx` but
not `src/myapp/users/page.tsx`.

### 3. Write both fixtures — this is not optional

Every rule needs two things, and a pull request with only the first will not be
merged:

1. **A violation fixture** in `tests/fixtures/messy-nextjs/` that the rule catches.
2. **A clean fixture** in `tests/fixtures/clean-nextjs/` proving the rule stays
   silent on correct code.

A rule with no false-positive test does not count as done. A linter that flags
correct code is worse than no linter — people turn it off and never come back.
Both of the false-positive bugs found while writing the original ten rules were
caught by the clean fixture, not by the violation fixture.

Then add the rule to the table in `tests/unit/rules/engine.test.ts`, which asserts
both halves for every rule automatically.

### 4. Verify

```bash
npm run build && npm test
npx architect check tests/fixtures/messy-nextjs   # your rule should appear
npx architect check tests/fixtures/clean-nextjs   # must stay silent
```

Update the rule table in `README.md` and in [Rules](/docs/skills).

## Pull Requests

- One rule, or one fix, per pull request.
- `npm run build`, `npm run lint` and `npm test` must all pass.
- Say which fixtures you added, and paste the `check` output for both.
- If you found a false positive, add the failing case to `clean-nextjs` in the
  same PR as the fix.

## What will be declined

- Another language or framework. One stack, done properly.
- Re-adding duplication, dead-code, secret scanning or a health score.
- Auto-fixing. The fix text tells a human or an agent what to do; the tool does
  not rewrite code.
