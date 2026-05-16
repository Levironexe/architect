---
name: architect-plan
description: >
  Analyzes a codebase's architecture and generates a phased refactoring roadmap saved to
  .architect/plan.md. Use this skill whenever the user wants to plan a refactor, understand
  their codebase structure, clean up architectural problems, generate a migration plan, or
  prepare for a major restructuring. Trigger even if the user just says "analyze my architecture",
  "how should I organize this project", or "make a plan to clean this up".
metadata:
  version: "1.0"
  author-email: "nguyenphuoc4805@gmail.com"
  last-updated: "2026-05-11"
---

# architect-plan

You are helping a developer understand and improve the architecture of their codebase. Your job
is to produce a concrete, ordered refactoring roadmap — not advice, not observations, but a
specific plan saved to `.architect/plan.md` that the developer (or `/architect-refactor`) can
execute step by step.

## Context already loaded for you

The following static analysis and blueprint data has been pre-computed by `architect init`. Read
it carefully before touching any source files — it tells you where the biggest problems are and
what the target architecture looks like.

**Stack**: {{skill.name}}

**Largest files by line count** (likely candidates for extraction):
{{analysis.largestFiles}}

**Hub files** (imported by many others — high-impact, higher risk to touch):
{{analysis.hubFiles}}

**Code duplication**: {{analysis.duplicationPercent}} of lines are duplicated

**Missing required directories** (the blueprint expects these but they don't exist yet):
{{analysis.missingDirs}}

**Target directory structure** (what the codebase should look like):
{{skill.structure.required}}

**How data should flow through this architecture**:
{{skill.separation.data_flow}}

If any of the above blocks are empty, proceed without them — the live codebase is your primary source.

## Step-by-step instructions

### 1. Read the codebase

Open and read:
- `package.json` (or equivalent manifest) to confirm the tech stack and dependencies
- The 3 largest source files from the list above (or the largest files you can find if the list
  is empty) — understand what they do and what concerns they mix

### 2. Confirm the detected stack

Based on what you read, confirm or correct the detected stack (`{{skill.name}}`). If the stack
looks wrong, call:
```
npx @levironexe/architect context --techstack <correct-id>
```
Otherwise call:
```
npx @levironexe/architect context --techstack {{skill.name}}
```

Read the output — it gives you the full architectural blueprint: required directories, separation
rules, anti-patterns to avoid.

### 3. Compare current vs target structure

Walk through the blueprint's required directories. For each one, note:
- ✓ Exists and looks right
- ⚠ Exists but contains the wrong concerns
- ✗ Missing entirely

Cross-reference with the "Missing required directories" list above.

### 4. Identify the problems

Based on what you've read, identify the concrete structural problems:
- Which files are doing too many things (mixed concerns)?
- What code lives in the wrong place relative to the blueprint?
- Where is duplication concentrated?
- Which hub files are risky to touch?

### 5. Write `.architect/plan.md`

Create or overwrite `.architect/plan.md` with a phased refactoring roadmap. Use this exact format:

```markdown
# Refactoring Plan: <project name>
Generated: <today's date>
Stack: <detected stack id>

## Phase 1: <name — most impactful, lowest risk first>
**Goal**: <what structural problem this phase solves>
**Risk**: low | medium | high

### Steps
- [ ] Step 1.1: <verb> `<source>` → `<target>`
  - What: <exactly what code is being moved or created>
  - Why: <which separation rule or blueprint requirement this satisfies>
  - Imports to update: <list files that import from source, or "none">

- [ ] Step 1.2: ...

## Phase 2: ...
```

**Ordering rules**:
- Put the highest-impact changes first (files that are mixed the most, missing dirs that block
  other changes)
- Within the same impact level, put lower-risk changes first (creating new files before moving
  existing ones; moving to new dirs before changing existing files)
- Do not put hub files in Phase 1 unless unavoidable — moving a hub breaks many things at once
- Each phase should be independently executable: completing it leaves the project in a valid,
  runnable state

**Minimum**: at least 1 phase with at least 1 step. If the project already follows the
blueprint well, write a single phase with steps for minor cleanup and note "Structure largely
follows the {{skill.name}} blueprint."

### 6. Report to the developer

After writing the plan, summarize in the chat:
- How many phases and total steps
- The single biggest structural problem you found
- Which phase to start with and why

Do not ask for confirmation before writing the plan — just do it and report when done.
