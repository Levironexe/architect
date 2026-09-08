#!/usr/bin/env node
/**
 * Generates ui/public/llms.txt and ui/public/llms-full.txt.
 *
 * The rule list comes from the skill YAML and the command list comes from the
 * CLI's own command registry, so these files cannot drift from the code the way
 * the hand-written prompt.txt did (it claimed 26 skills while the docs site said 35).
 *
 * Run after `npm run build`:  node scripts/generate-llms-txt.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const publicDir = join(root, 'ui', 'public');

const { loadSkills } = await import(join(root, 'dist/skills/loader.js'));
const { createProgram } = await import(join(root, 'dist/cli/index.js'));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const SITE = process.env.ARCHITECT_SITE_URL ?? 'https://leviron-architect.vercel.app';
const REPO = 'https://github.com/Levironexe/architect';
const NPM = `https://www.npmjs.com/package/${pkg.name}`;

// ---------------------------------------------------------------- source of truth

const { skills } = await loadSkills();
const stack = skills[0];
if (!stack) throw new Error('No skill blueprint found — run npm run build first.');
if (skills.length > 1) throw new Error(`Expected one stack blueprint, found ${skills.length}.`);

const noop = async () => 0;
const program = createProgram(noop, noop, noop);
const commands = program.commands.map((command) => ({
  name: command.name(),
  description: command.description(),
  args: command.registeredArguments.map((argument) => argument.name()),
  options: command.options
    .map((option) => ({ flags: option.flags, description: option.description }))
    .filter((option) => option.flags !== '-h, --help')
}));

const checkable = stack.antiPatterns.filter((rule) => rule.detect);
const guidanceOnly = stack.antiPatterns.filter((rule) => !rule.detect);

// The one rule not derived from an anti-pattern: it comes from required_dirs.
const structureRule = {
  id: 'missing_layer',
  severity: 'warning',
  summary: 'A required directory from the blueprint does not exist'
};

const NON_GOALS = `## Non-goals

Architect checks one thing: whether your code is in the right place. It does not
do these, and will not grow into them:

- Duplicate code detection — use jscpd
- Dead code and unused exports — use knip
- Secret scanning — use gitleaks
- A 0-100 health score — use fallow
- Any language but TypeScript
- Any stack but Next.js App Router
- Auto-fixing violations — that is your coding agent's job`;

// ---------------------------------------------------------------- llms.txt

const short = `# Architect

> An architecture linter for Next.js App Router projects written in TypeScript. ${checkable.length + 1} deterministic rules, no model call, exit 1 on a violation.

Architect answers one question other tools do not: given this stack's blueprint,
is this file in the layer it belongs to? Next.js App Router + TypeScript only.

## Docs

- [Overview](${SITE}/docs): what Architect is, why it exists, and its non-goals
- [Commands](${SITE}/docs/commands): ${commands.map((c) => c.name).join(', ')}, their flags and exit codes
- [Rules](${SITE}/docs/skills): all ${checkable.length + 1} checked rules and the detect: schema
- [Integrations](${SITE}/docs/integrations): GitHub Actions and the Claude Code Stop hook
- [Contributing](${SITE}/docs/contributing): how to add a rule with a detect: block

## Commands

${commands.map((c) => `- [${c.name}](${SITE}/docs/commands): ${c.description}`).join('\n')}

## Rules

${checkable.map((r) => `- \`${r.id}\` (${r.severity}): ${firstSentence(r.description)}`).join('\n')}
- \`${structureRule.id}\` (${structureRule.severity}): ${structureRule.summary}.

## Source

- [GitHub](${REPO}): source, issues and the stack blueprint
- [npm](${NPM}): \`npx ${pkg.name} check .\`
- [Full reference](${SITE}/llms-full.txt): install, flags, exit codes, detect: schema
`;

// ---------------------------------------------------------------- llms-full.txt

const full = `# Architect — full reference

> An architecture linter for Next.js App Router projects written in TypeScript.
> Version ${pkg.version}. Next.js App Router + TypeScript only.

Architect evaluates a stack blueprint against your code. Every rule is
deterministic — there is no model call, no API key and no network access.

## Install

\`\`\`bash
npx ${pkg.name} check .          # no install
npm install -g ${pkg.name}       # or install globally
\`\`\`

Requires Node.js ${pkg.engines?.node ?? '>=20.0.0'}.

## Commands

${commands.map(renderCommand).join('\n')}
## Exit codes

| Code | Meaning |
|------|---------|
| 0 | No violations, or warnings only |
| 1 | At least one critical violation |
| 2 | No supported stack detected, or the directory does not exist |

Warnings alone do not fail the command. Use \`verify --strict\` to ratchet.

## JSON output

\`\`\`json
{
  "stack": "${stack.id}",
  "files_checked": 18,
  "violations": [
    {
      "rule": "${checkable[0]?.id ?? 'direct_db_in_page'}",
      "severity": "${checkable[0]?.severity ?? 'critical'}",
      "file": "src/app/projects/page.tsx",
      "line": 24,
      "message": "...",
      "fix": "..."
    }
  ],
  "summary": { "critical": 1, "warning": 0, "info": 0 }
}
\`\`\`

## Rules

${checkable.length + 1} rules are checked. ${guidanceOnly.length} is guidance for a coding agent and is never reported.

| Rule | Severity | Checked |
|------|----------|---------|
${checkable.map((r) => `| \`${r.id}\` | ${r.severity} | yes |`).join('\n')}
| \`${structureRule.id}\` | ${structureRule.severity} | yes |
${guidanceOnly.map((r) => `| \`${r.id}\` | ${r.severity} | no — agent guidance only |`).join('\n')}

${checkable.map((r) => `### \`${r.id}\`\n\n${r.description}\n\n- Severity: ${r.severity}\n- Matcher: \`${r.detect.kind}\`\n- Message: ${r.detect.message}\n- Fix: ${r.detect.fix}`).join('\n\n')}

${guidanceOnly.map((r) => `### \`${r.id}\` (agent guidance only)\n\n${r.description}\n\n- Severity: ${r.severity}\n- Not reported by \`check\`: it needs cross-file semantic judgement.`).join('\n\n')}

## The detect: schema

Rules live in \`skills/stacks/${stack.id}/SKILL.md\` as YAML, not in TypeScript.
An anti-pattern becomes checkable by gaining a \`detect:\` block; without one it
stays guidance for a coding agent.

\`\`\`yaml
- id: direct_db_in_page
  severity: critical
  detect:
    kind: import
    paths: ["app/**/page.tsx", "app/**/layout.tsx"]
    modules: ["@prisma/client", drizzle-orm, mongoose]
    message: "Database client imported directly in a page or layout component."
    fix: "Move the query into lib/ and call that function from the page."
\`\`\`

### Matcher kinds

| kind | Fires when | Key fields |
|------|-----------|------------|
| \`import\` | A module is imported inside \`paths\` | \`modules\` |
| \`import_direction\` | A file under \`from\` imports one under \`to\` | \`from\`, \`to\` |
| \`directive\` | A file carries a directive prologue | \`value\` |
| \`call\` | A named function is called | \`callee\` |
| \`member\` | A member expression appears | \`object\`, \`property\` |
| \`throw\` | A throw statement appears | — |
| \`metric\` | A file metric exceeds a ceiling | \`metric\`, \`gt\` |

### Shared fields

| Field | Effect |
|-------|--------|
| \`paths\` | Globs the rule applies to. Omitted means every file. |
| \`not_paths\` | Globs excluded, applied after \`paths\` |
| \`requires_directive\` | The file must also carry this directive |
| \`requires_call\` | The file must also contain this call |
| \`not_matching\` | Matched text starting with any of these is not a violation |
| \`message\` | What is wrong |
| \`fix\` | What to do about it |

Globs anchor at a segment boundary, so \`app/**/page.tsx\` matches both
\`app/users/page.tsx\` and \`src/app/users/page.tsx\`, but not
\`src/myapp/users/page.tsx\`.

Matching runs against a real parse, so a commented-out \`alert()\` is not a
violation. Two rules never report the same \`file:line\`.

## GitHub Actions

\`\`\`yaml
name: architecture
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npx ${pkg.name} check .
\`\`\`

## Claude Code Stop hook

Runs \`check\` after every agent turn so the agent sees what it broke.
In \`.claude/settings.json\`:

\`\`\`json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          { "type": "command", "command": "npx ${pkg.name} check . --json" }
        ]
      }
    ]
  }
}
\`\`\`

${NON_GOALS}

If you want a broad codebase scanner, use fallow. Architect answers a narrower
question that scanners do not.

## Source

- GitHub: ${REPO}
- npm: ${NPM}
- Docs: ${SITE}/docs
`;

writeFileSync(join(publicDir, 'llms.txt'), short);
writeFileSync(join(publicDir, 'llms-full.txt'), full);

console.log(`llms.txt        ${short.split('\n').length} lines`);
console.log(`llms-full.txt   ${full.split('\n').length} lines`);
console.log(`stack: ${stack.id} · ${checkable.length + 1} checked rules · ${guidanceOnly.length} agent-only · ${commands.length} commands`);

function renderCommand(command) {
  const args = command.args.length > 0 ? ` ${command.args.map((a) => `[${a}]`).join(' ')}` : '';
  const options = command.options.length > 0
    ? `\n${command.options.map((o) => `| \`${o.flags}\` | ${o.description} |`).join('\n')}`
    : '';

  return `### \`architect ${command.name}${args}\`

${command.description}
${options ? `\n| Flag | Effect |\n|------|--------|${options}\n` : ''}`;
}

function firstSentence(text) {
  const match = /^(.*?[.!?])(\s|$)/.exec(text.trim());
  return (match ? match[1] : text.trim()).replace(/\s+/g, ' ');
}
