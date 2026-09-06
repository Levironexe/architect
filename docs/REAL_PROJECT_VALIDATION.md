# Real project validation

`architect check` run against five real Next.js App Router codebases before the
1.0 release. 1,508 files total. Every remaining critical was inspected by hand.

Criticals across all five: **92 → 29** after the false positives below were fixed.
All 29 survivors were confirmed as true positives.

Re-run with:

```bash
npm run build && node dist/cli/index.js check <project> --json
```

### Sample 1 — plink

- Category: monorepo, Turborepo workspaces, 168 files
- Check outcome: 35 violations, 0 critical
- False positives: 49. `scattered_process_env` fired 38 times on `*.test.ts` and
  `playwright.config.ts`, where reading `process.env` is correct. `missing_layer`
  reported `app/`, `components/` and `lib/` absent when all three exist at
  `apps/web/src/` — structure checking only tried the repo root and `root/src`.
- Follow-up: `not_paths` added for tests and tool configs; source roots are now
  derived from the discovered files. Both covered by `clean-nextjs` fixtures.

### Sample 2 — ecocraft

- Category: single app, layers nested inside `app/`, 54 files
- Check outcome: 13 violations, 0 critical
- False positives: 62, all `illegal_import`. This project puts `components/` and
  `lib/` inside `app/`, so every sibling import resolved under `app/**` and
  tripped the direction rule. More false criticals than the project has files.
- Follow-up: `import_direction` gained `not_to`, exempting shared layers wherever
  they are nested. 62 false criticals became 0; the fixture still fires.

### Sample 3 — Erudex

- Category: single app, Drizzle ORM, Supabase, 65 files
- Check outcome: 24 violations, 10 critical
- False positives: none. The criticals are eight route handlers importing
  `drizzle-orm` operators and building queries inline, plus two pages doing the
  same — exactly `direct_db_in_route` and `direct_db_in_page`.
- Follow-up: none. Confirmed true positives on manual inspection.

### Sample 4 — HappyGen

- Category: large monorepo, 1,171 files — the scale test
- Check outcome: 191 violations, 19 critical
- False positives: 4 `scattered_process_env` on `process.env.NODE_ENV`.
  The 19 criticals are components importing route-colocated Server Actions,
  which is the dependency inversion `illegal_import` exists to catch.
- Follow-up: `NODE_ENV` and `NEXT_RUNTIME` excluded from both env rules; they are
  inlined at build time and are not configuration. Criticals unchanged at 19.

### Sample 5 — lenslab

- Category: small single app, 50 files
- Check outcome: 2 violations, 0 critical
- False positives: 1. `process.env.NODE_ENV` inside a `'use client'` component
  was reported as `leaked_server_secret`. It is inlined at build time and is not
  a secret.
- Follow-up: added to `not_matching` alongside `NEXT_PUBLIC_`. Regression test in
  `tests/unit/rules/engine.test.ts`.

## Rules still worth tuning

`scattered_process_env` remains the noisiest rule — 56 hits on HappyGen, 14 on
plink. All are true per the blueprint, but it is the first thing a new user sees.
Consider dropping it to `info`, or scoping it to `app/` only.

`oversized_extraction` at 300 LOC is aggressive: 64 hits on HappyGen, 13 on
plink. Correct, and likely the second rule people mute.
