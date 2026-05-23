# Contributing Skills

Skills are the knowledge base behind Architect. Each skill is a SKILL.md file with YAML frontmatter that encodes architectural best practices for one tech stack or integration. If you know a stack well, you can write a skill and submit it as a PR.

## Prerequisites

```bash
# Clone the repo
git clone https://github.com/Levironexe/architect
cd architect/architect-cli

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test
```

## File Location

Skills live in:

```
architect-cli/skills/
├── stacks/          ← one SKILL.md per framework (express, nextjs, react, etc.)
├── meta/            ← language-level conventions (general-js)
└── patterns/        ← integration libraries (prisma, supabase, clerk, etc.)
```

Create a new file: `architect-cli/skills/stacks/<your-stack>/SKILL.md`

Use an existing skill as your starting point — `express-api/SKILL.md` is a good template.

## Required Fields

Every skill is a `SKILL.md` file with YAML frontmatter. The frontmatter must include:

| Field | Required | Notes |
|-------|----------|-------|
| `schema_version` | Yes | Always `"2.0.0"` |
| `id` | Yes | kebab-case, unique across all skills |
| `name` | Yes | Human-readable display name |
| `version` | Yes | Semver, start at `"1.0.0"` |
| `description` | Yes | One sentence summary |
| `category` | Yes | `stack`, `meta`, or `integration` |
| `language` | Yes | `javascript`, `python`, `csharp`, etc. |
| `frameworks` | Yes | Array; empty `[]` for meta skills |
| `detection` | Yes | At least one detection signal |
| `structure.required_dirs` | Yes | The directories this stack must have |
| `separation.rules` | Yes | At least two rules with `rule_text` and `example` |
| `anti_patterns` | Yes | At least one with `bad_example` and `good_example` |

The markdown body (after the `---` closing the frontmatter) can include additional sections:

| Section | Optional | Notes |
|---------|----------|-------|
| Service Layer | Yes | Pattern, location, and naming for service files. Triggers service extraction phase in plans. |
| Composition | Yes | Rules for when this skill is combined with others (integration skills only). |

## Detection Rules

Detection rules must be specific enough that the skill doesn't match the wrong project. Check for collisions with existing skills:

```yaml
detection:
  dependencies:
    any:
      - your-framework    # matched against package.json dependencies
    none:
      - conflicting-pkg   # exclude if this dep exists (prevents false matches)
  files:
    - config-file.js      # matched against project root files
  source_indicators:
    - "framework.init("   # matched against source file content
```

Run `architect skill list` in a fixture project to verify your skill activates correctly and doesn't false-positive on other stacks.

## Writing Good Examples

Every separation rule and anti-pattern needs real, runnable code examples — not pseudocode.

```yaml
anti_patterns:
  - id: god_file
    severity: critical     # critical | warning | info
    description: "One sentence: what the problem is."
    bad_example: |
      # The actual bad code, exactly as a developer would write it
    good_example: |
      # The corrected version with a comment explaining the structure
```

## Testing Your Skill

1. Build the CLI: `npm run build`
2. Check the skill loads: `node dist/cli/index.js skill list`
3. See the rendered blueprint:
   ```bash
   node dist/cli/index.js context --techstack your-skill-id
   ```
4. Run `architect init` against a fixture or real project:
   ```bash
   node dist/cli/index.js init ./tests/fixtures/your-fixture --integration claude
   ```
5. Open the generated SKILL.md and verify it reads clearly
6. If your skill includes a Service Layer section, verify that `architect context` includes it in the output
7. If your skill includes Composition rules, test with a fixture that has both skills active

## PR Checklist

Before submitting:

- [ ] `SKILL.md` file is in the correct directory (`stacks/`, `meta/`, or `patterns/`)
- [ ] YAML frontmatter contains all required fields
- [ ] `detection` rules are specific — no false positives on existing stacks
- [ ] `structure.required_dirs` has `purpose` filled in for every entry
- [ ] Every `separation.rules` entry has a `rule_text` and a working `example`
- [ ] Every `anti_patterns` entry has both `bad_example` and `good_example`
- [ ] `architect context --techstack <your-id>` produces clean output
- [ ] `architect init` against a real or fixture project writes a valid SKILL.md
- [ ] If Service Layer section included: pattern, location, and naming are defined
- [ ] If Composition section included: combined-with targets reference existing skills
- [ ] No existing tests broken (`npm test`)
