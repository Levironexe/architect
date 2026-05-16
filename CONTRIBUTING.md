# Contributing

Thanks for helping make Architect sharper.

## Local Setup

```bash
cd architect-cli
npm install
npm run build
```

## Validation Commands

Run these before opening a pull request:

```bash
npm run build
npm run lint
npm test
npm audit --audit-level=high
```

## Coding Expectations

- Keep TypeScript strict and avoid `any` unless the reason is documented inline.
- Keep source files under 300 LOC and functions under 50 LOC.
- Keep CLI behavior read-only; do not modify scanned user projects.
- Write primary command output to stdout and warnings/errors to stderr.
- Preserve `--json` as parseable machine-readable output with no spinner text or ANSI styling.
- Add tests before implementing new scan, scoring, planning, or reporting behavior.

## Tests

Use focused tests while developing:

```bash
npm test -- tests/unit/cli/scan-ux.test.ts
npm test -- tests/unit/utils/thresholds.test.ts
```

Then run the full suite before submitting.

## Pull Requests

Pull requests should include:

- A clear description of the behavior change.
- Tests or documentation updates for user-facing behavior.
- Notes for any constitution limit exceptions.
- Confirmation that build, lint, tests, and audit passed.

## Issues

Use the bug report or feature request templates. Remove secrets from command output before pasting logs.
