# Architect CLI

Architect is a read-only structural health scanner for JavaScript and TypeScript projects. It finds oversized files, complex functions, dependency risks, duplicated code, architecture-skill mismatches, partial scan conditions, and optional AI concern-classification signals, then turns those findings into terminal reports, JSON output, or refactoring plans.

## Installation

```bash
npm install -g architect-cli
```

For local development in this repository:

```bash
cd architect-cli
npm install
npm run build
```

## Quick Start

```bash
architect scan .
architect scan . --provider none --no-color
architect plan . --format md
```

The first command scans the current project. The second forces metrics-only mode and plain output. The third generates a Markdown refactoring roadmap from the same scan signals.

## Command Reference

### `architect scan [directory]`

Scans a project directory. If the directory is omitted in an interactive terminal, Architect prompts for one. In non-interactive environments, pass the directory explicitly.

Options:

- `--threshold <values>`: Customize finding thresholds, for example `loc=250,complexity=12`.
- `--provider <provider>`: Choose `claude`, `openai`, `ollama`, or `none`.
- `--json`: Emit one parseable JSON object with `schemaVersion`, `command`, `run`, `result`, `warnings`, and `diagnostics`.
- `--verbose`: Include scan diagnostics such as thresholds, skipped inputs, partial states, and provider fallback reasons.
- `--no-color`: Disable ANSI color while preserving severity and status words.

Examples:

```bash
architect scan ./src --threshold loc=300,complexity=15
architect scan ./app --provider none --verbose --no-color
architect scan ./service --json > architect-scan.json
```

### `architect plan <directory>`

Generates a refactoring roadmap from scan output and matched architecture skills.

Options:

- `--format <format>`: Choose `terminal`, `md`, `json`, or `prompt`.
- `--no-color`: Disable ANSI color in terminal output.

Examples:

```bash
architect plan . --format terminal
architect plan . --format md > refactor-plan.md
architect plan . --format prompt --no-color
```

## Scoring Model

Architect reports an overall health state from available dimensions:

- **Modularity**: oversized files, complex functions, and concentration of code.
- **Duplication**: repeated blocks and duplicated line counts.
- **Separation**: optional AI classification of function concerns.
- **Consistency**: optional pattern consistency from classified concerns.

When AI classification is unavailable, Architect reports a partial health score instead of pretending every dimension was measured.

## LLM Provider Setup

Architect works without AI credentials. Use metrics-only mode explicitly with:

```bash
architect scan . --provider none
```

To enable AI concern classification, configure one provider:

```bash
export ANTHROPIC_API_KEY=...
architect scan . --provider claude

export OPENAI_API_KEY=...
architect scan . --provider openai

export ARCHITECT_LLM_PROVIDER=ollama
architect scan . --provider ollama
```

Secrets are read from environment variables and are not printed in reports, warnings, or JSON output.

## Example Output

```text
Architect scan: /path/to/project

Project overview:
- Files scanned: 1
- Total LOC: 301
- Languages: TypeScript

Concern classification:
- Skipped: No AI provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY, use --provider ollama, or run with --provider none for metrics-only mode.

Health report:
- Overall score: 58 warning (partial)

Ranked issues:
- CRITICAL modularity [server.ts]: server.ts is oversized at 301 LOC. Split this file around its dominant responsibilities before adding more features.
```

## Troubleshooting

- Missing directory: pass a path, for example `architect scan .`.
- Missing provider credentials: set `ANTHROPIC_API_KEY`, set `OPENAI_API_KEY`, use `--provider ollama`, or run `--provider none`.
- Parse failures: run with `--verbose` to see file paths and parser reasons.
- CI or accessibility output: use `--no-color` and prefer `--json` for automation.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for local setup, tests, coding expectations, pull requests, and issue reporting.

## License

MIT. See the `license` field in [package.json](./package.json).
