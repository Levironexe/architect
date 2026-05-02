# Architect CLI

Architect CLI scans JavaScript and TypeScript projects for structural signals such as file size,
function counts, cyclomatic complexity, project-local dependency risks, and substantial duplicate code blocks.
It also matches projects against bundled architecture skills, reports skill-aware structure and
full or partial health score signals, and can optionally classify function concerns with an AI provider.

## Scripts

- `npm run dev -- --help` runs the CLI from source with `tsx`
- `npm run build` compiles the CLI to `dist/`
- `npm run lint` runs ESLint
- `npm test` runs the Vitest suite

## Planned commands

- `architect scan <directory>` discovers files and reports metrics
- `architect plan` is a placeholder for future refactoring-plan generation
- `architect skill` is a placeholder for future skill management

## Development flow

```bash
cd architect-cli
npm install
npm run dev -- --help
npm run dev -- --version
```

## Current CLI behavior

- `architect --help` lists the available `scan`, `plan`, and `skill` commands
- `architect --version` prints the current package version
- `architect scan <directory>` requires a directory argument and reports invalid usage to stderr
- `architect scan <directory> --no-color` prints a plain-text metrics table, detected architecture, structure comparison, concern classification status, pattern consistency, dependency insights, duplication findings, health report, ranked issues, next-step guidance, and summary without ANSI codes

## Optional AI concern classification

`architect scan` works without any AI credentials. When no provider is configured, the scan runs in
metrics-only mode and prints a `Concern classification` section explaining that classification was
skipped. Existing file, dependency, duplication, skill, and score results remain available.

To enable classification, configure one provider:

```bash
export ANTHROPIC_API_KEY=...
# or
export OPENAI_API_KEY=...
# or use a local Ollama service
export ARCHITECT_LLM_PROVIDER=ollama
```

The classification prompt is metadata-only. It includes relative file paths, function names,
parameter counts, line ranges, imports, and matched skill separation rules. It does not include full
source files or function bodies.

Optional smoke test with a real provider:

```bash
cd architect-cli
npm run build
node dist/cli/index.js scan tests/fixtures/messy-express --no-color
```

Expected highlights:

- The `Concern classification` section reports completed, partial, failed, or skipped status
- Mixed-concern files and misplaced functions appear when the provider returns them
- API keys and environment values are not printed to stdout or stderr

## Example scans

```bash
cd architect-cli
npx tsx src/cli/index.ts scan tests/fixtures/messy-express --no-color
```

Expected highlights:

- A `Detected architecture` section identifies `Express.js REST API (express-api)`
- A `Structure comparison` section lists missing Express layers such as routes, controllers, and services
- A `Concern classification` section reports skipped mode unless an AI provider is configured
- A `Health report` section reports full or partial score state and dimension breakdown
- A `Ranked issues` section lists critical and warning findings with suggested next actions
- A `Next step` section points to `architect plan` for a refactoring roadmap

```bash
cd architect-cli
npx tsx src/cli/index.ts scan tests/fixtures/dependency-graph-project --no-color
```

Expected highlights:

- A `Dependency insights` section is printed
- `src/shared/format.ts` is reported as a hotspot depended on by 3 files
- The report includes a circular dependency and at least one unreferenced file
- The summary includes dependency hotspot and circular dependency totals

```bash
cd architect-cli
npx tsx src/cli/index.ts scan tests/fixtures/duplicate-blocks-project --no-color
```

Expected highlights:

- A `Duplication findings` section is printed
- A duplicate block is reported for `src/a.ts` and `src/b.ts`
- The summary includes duplicate finding and duplicated-line totals

## Graceful parse skips

```bash
cd architect-cli
npx tsx src/cli/index.ts scan tests/fixtures/broken-project --no-color
```

Expected highlights:

- A parse warning is written to stderr for `broken.ts`
- The scan still renders dependency and duplication sections plus the final summary
- A partial-results warning is written to stderr when skipped files may affect structural findings
- The summary reports `- Files scanned: 0` and `- Skipped files: 1`
