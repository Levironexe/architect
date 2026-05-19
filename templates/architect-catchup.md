---
name: architect-catchup
description: >
  Refreshes the AI assistant's architecture skill files after the codebase has changed.
  Use this skill when the user has refactored their project or written significant new code
  since the last `architect init`, and wants up-to-date guidance. Trigger when the user says
  "update my skills", "re-scan my project", "refresh architect", or "catchup".
metadata:
  version: "1.0"
---

# architect-catchup

## Purpose

Re-runs the architect project scan and rewrites the architecture skill files with fresh data.
Use this after refactoring or adding new code so your AI assistant reflects the current state
of the project — not the state it was in when you first ran `architect init`.

## Instructions

### 1. Check prerequisites

Before doing anything, check whether the architect skill files already exist:

- Look for `.claude/skills/architect-plan/SKILL.md`
- Look for `.claude/skills/architect-refactor/SKILL.md`

If either file is missing, stop immediately and output:

> ❌ Architect skills not found. Run `architect init .` first to set up guidance files before
> using catchup.

### 2. Run the update

If both files exist, run the following command from the project root:

```
npx @levironexe/architect init . --update
```

Wait for the command to complete before proceeding.

### 3. Hand off

After the update finishes, output:

> ✅ Architecture skills updated with the latest scan of your project.
>
> Ready to create a fresh refactoring plan? Run `/architect-plan` to continue.
